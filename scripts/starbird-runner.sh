#!/bin/bash
# starbird-runner.sh — Headless research agent that enriches Starbird's dataset.
# Usage: starbird-runner.sh [daily|dry-run]
#
# daily   = run one iteration of the research loop, commit + push results
# dry-run = same but do not commit; write proposed changes to tmp/ for review
#
# Strategy selection is DETERMINISTIC and done in Python before Claude ever
# runs. Claude receives the picked strategy as an injected fact and has no
# say in scoring itself. Ground-truth metrics are computed from a data.json
# before/after diff, not from Claude's self-report.

set -Eeuo pipefail  # -E: ERR trap (below) fires inside functions/subshells too

export WABBAZZAR_SOURCE="${WABBAZZAR_SOURCE:-system}"

MODE="${1:-daily}"
STARBIRD_DIR="/home/wabbazzar/code/starbird"
NOTIFY="/home/wabbazzar/code/wabbazzar-ice/scripts/notify.sh"
LOG_EVENT="/home/wabbazzar/code/wabbazzar-ice/scripts/log_event.sh"
PROMPT_FILE="$STARBIRD_DIR/scripts/starbird-runner-prompt.md"
LOG_FILE="$STARBIRD_DIR/tmp/starbird-runner-last-run.log"
BEFORE_SNAPSHOT="$STARBIRD_DIR/tmp/data-before.json"

cd "$STARBIRD_DIR"
mkdir -p tmp

JOB_START=$(date +%s)
[ -x "$LOG_EVENT" ] && "$LOG_EVENT" starbird-runner job.start mode="$MODE" || true

# Die loudly. Without this, any `set -e` exit is silent: no notify, no
# job.end event, nothing for medic to detect. That's exactly how the
# 2026-06-04/05 runs vanished (pinned claude binary GC'd by the updater,
# then the PATH fallback died under cron's bare PATH).
fatal() {
  local code=$1 where=$2
  trap - ERR
  echo "[starbird-runner] FATAL: aborted at $where (exit $code)" >> "$LOG_FILE"
  [ -x "$LOG_EVENT" ] && "$LOG_EVENT" starbird-runner job.end \
    mode="$MODE" status="fail" exit_code="$code" \
    duration_s="$(( $(date +%s) - JOB_START ))" reason="$where" || true
  [ -x "$NOTIFY" ] && "$NOTIFY" "Starbird Runner FAILED — $MODE" \
    "Aborted at $where (exit $code). Log tail:
$(tail -15 "$LOG_FILE" 2>/dev/null)" || true
  exit "$code"
}
# bash fires ERR traps even where the script deliberately disabled errexit
# (the claude retry loop runs under `set +e` and handles failures itself) —
# so only die when -e is actually on. Without the guard, a budget-capped
# claude exit aborts the whole run instead of flowing into retry/metrics
# (observed 2026-06-05 on the first run with this trap).
trap 'case "$-" in *e*) fatal $? "line $LINENO";; esac' ERR

echo "[starbird-runner] Starting $MODE run at $(date)" > "$LOG_FILE"

# ── Self-repair: ensure .worktrees/ is gitignored ───────────────────────
# The augur runner aborts when `git status --porcelain` shows '?? .worktrees/'.
# Commit the fix in any mode — this is a one-time structural repair, not data,
# so it must land before augur's 03:30 timer fires regardless of runner mode.
if ! grep -qxF '.worktrees/' .gitignore 2>/dev/null; then
  printf '\n# Augur worktree staging area\n.worktrees/\n' >> .gitignore
  echo "[starbird-runner] patched .gitignore: added .worktrees/" >> "$LOG_FILE"
  git add .gitignore
  git commit -m "chore: gitignore .worktrees/ (runner self-repair)

Co-Authored-By: Starbird Runner <noreply@anthropic.com>" >> "$LOG_FILE" 2>&1 || true
  git push >> "$LOG_FILE" 2>&1 || true
  echo "[starbird-runner] committed + pushed .gitignore patch" >> "$LOG_FILE"
fi

# ── Step 1: Update strategy scores from run history (deterministic) ─────
python3 "$STARBIRD_DIR/scripts/update-strategy-scores.py" >> "$LOG_FILE" 2>&1

# ── Step 2: Pick a strategy (deterministic, unless FORCE_STRATEGY is set) ─
if [ -n "${FORCE_STRATEGY:-}" ]; then
  PICKED_STRATEGY="$FORCE_STRATEGY"
  echo "[starbird-runner] FORCED strategy override: $PICKED_STRATEGY" >> "$LOG_FILE"
else
  PICKED_STRATEGY="$(python3 "$STARBIRD_DIR/scripts/pick-strategy.py" 2>>"$LOG_FILE")"
  if [ -z "$PICKED_STRATEGY" ]; then
    fatal 1 "strategy picker returned empty"
  fi
  echo "[starbird-runner] picked strategy: $PICKED_STRATEGY" >> "$LOG_FILE"
fi

# ── Step 3: Snapshot data.json so we can diff afterwards ────────────────
cp "$STARBIRD_DIR/static/data.json" "$BEFORE_SNAPSHOT"

# Target pairs per run. Can be overridden via env var. The launcher scales
# the budget with the target (rough estimate: $0.50 per pair of firm+brand
# records, plus $0.50 overhead for scoring + schema validation).
TARGET_PAIRS="${TARGET_PAIRS:-3}"

# ── Step 4: Assemble the prompt with injected facts ─────────────────────
PROMPT="$(cat "$PROMPT_FILE")

MODE=$MODE
TIMESTAMP=$(date -u +%Y-%m-%dT%H:%M:%SZ)
PICKED_STRATEGY=$PICKED_STRATEGY
TARGET_PAIRS=$TARGET_PAIRS

(The launcher has already chosen the strategy for this run and set the
target count. You do not decide which strategy to use, you do not write
to the scores file, and you do not reduce TARGET_PAIRS below the value
given. Execute the strategy above and only that strategy.)"

MODEL="sonnet"

# Claude Code binary. Was pinned to versions/2.1.122 (2026-04-30, for a
# tool-concurrency regression in 2.1.123), but the auto-updater GC'd that
# version on 2026-06-04 and the script died silently for two days. No more
# version pins: use the updater-maintained ~/.local/bin/claude symlink,
# fall back to PATH, and fail loudly if neither resolves (cron's bare PATH
# has no ~/.local/bin). Override with `CLAUDE_BIN=...` for testing.
CLAUDE_BIN="${CLAUDE_BIN:-/home/wabbazzar/.local/bin/claude}"
if [ ! -x "$CLAUDE_BIN" ]; then
  echo "[starbird-runner] WARN: $CLAUDE_BIN not executable, trying PATH" >> "$LOG_FILE"
  CLAUDE_BIN="$(command -v claude || true)"
fi
if [ -z "$CLAUDE_BIN" ] || [ ! -x "$CLAUDE_BIN" ]; then
  fatal 1 "no claude binary found"
fi
echo "[starbird-runner] using claude binary: $CLAUDE_BIN ($("$CLAUDE_BIN" --version 2>/dev/null | head -1))" >> "$LOG_FILE"

# Budget scales with target: $0.50 per pair + $0.50 overhead, capped.
BUDGET_BASE=$(python3 -c "print(max(0.50, 0.50 * $TARGET_PAIRS + 0.50))")
if [ "$MODE" = "dry-run" ]; then
  BUDGET="$BUDGET_BASE"
else
  # Daily mode has the same per-pair cost but a higher floor for safety.
  BUDGET=$(python3 -c "print(max(4.00, $BUDGET_BASE))")
fi
echo "[starbird-runner] target=$TARGET_PAIRS budget=\$$BUDGET" >> "$LOG_FILE"

# ── Step 5: Invoke Claude (with retry for transient API errors) ─────────
# We capture the CLI's JSON result so cost/usage come straight from the
# harness (authoritative) instead of relying on Claude self-reporting them.
CLAUDE_OUT="$STARBIRD_DIR/tmp/starbird-runner-claude-output.json"
CLAUDE_METRICS="$STARBIRD_DIR/tmp/starbird-runner-claude-report.json"
# Clear stale reports so a run that fails to refresh them can't silently
# inherit a previous run's (or a malformed) cost figure.
rm -f "$CLAUDE_OUT" "$CLAUDE_METRICS"
MAX_RETRIES=2
RETRY=0
EXIT=1
while [ "$RETRY" -le "$MAX_RETRIES" ]; do
  if [ "$RETRY" -gt 0 ]; then
    echo "[starbird-runner] Retry $RETRY/$MAX_RETRIES after transient failure…" >> "$LOG_FILE"
    sleep 15
  fi
  set +e
  "$CLAUDE_BIN" -p \
    --model "$MODEL" \
    --dangerously-skip-permissions \
    --max-budget-usd "$BUDGET" \
    --output-format json \
    "$PROMPT" \
    > "$CLAUDE_OUT" 2>> "$LOG_FILE"
  EXIT=$?
  set -e
  # Mirror the human-readable result into the log for debugging.
  python3 -c "import json; print(json.load(open('$CLAUDE_OUT')).get('result',''))" \
    >> "$LOG_FILE" 2>/dev/null || cat "$CLAUDE_OUT" >> "$LOG_FILE" 2>/dev/null
  echo "[starbird-runner] Claude exited with code $EXIT (attempt $((RETRY+1)))" >> "$LOG_FILE"
  if [ "$EXIT" -eq 0 ]; then
    break
  fi
  RETRY=$((RETRY + 1))
done

# ── Step 6: Compute ground-truth metrics from data.json diff ────────────
# Claude's self-reported numbers (if any) are ignored here. The only
# numbers that feed back into strategy scoring are the ones that can be
# verified against the file on disk.
# Cost/tokens come from the CLI's JSON result (authoritative: total_cost_usd
# + usage). If that's somehow unavailable, fall back to Claude's optional
# self-report file, tolerating leading-dot floats like ".23" that aren't
# valid JSON. Either way, a parse failure yields 0 loudly in the log below
# rather than silently — these numbers feed strategy scoring.
read -r TOKENS_HINT COST_HINT < <(python3 - "$CLAUDE_OUT" "$CLAUDE_METRICS" <<'PY'
import json, re, sys
out_path, report_path = sys.argv[1], sys.argv[2]
tokens, cost = 0, 0.0
try:
    d = json.load(open(out_path))
    cost = float(d.get("total_cost_usd") or 0)
    u = d.get("usage") or {}
    tokens = sum(int(u.get(k) or 0) for k in (
        "input_tokens", "output_tokens",
        "cache_creation_input_tokens", "cache_read_input_tokens"))
except Exception:
    pass
if cost <= 0:  # fall back to Claude's self-report
    try:
        raw = re.sub(r":\s*\.(\d)", r": 0.\1", open(report_path).read())
        r = json.loads(raw)
        cost = float(r.get("cost_usd") or 0)
        tokens = tokens or int(r.get("tokens_spent") or 0)
    except Exception:
        pass
print(tokens, cost)
PY
)
TOKENS_HINT=${TOKENS_HINT:-0}
COST_HINT=${COST_HINT:-0}
if python3 -c "import sys; sys.exit(0 if float('$COST_HINT') > 0 else 1)"; then
  echo "[starbird-runner] cost from CLI: \$$COST_HINT / ${TOKENS_HINT} tokens" >> "$LOG_FILE"
else
  echo "[starbird-runner] WARNING: no cost captured (CLI + self-report both empty); logging \$0" >> "$LOG_FILE"
fi

GROUND_TRUTH=$(python3 "$STARBIRD_DIR/scripts/compute-run-metrics.py" \
  --before "$BEFORE_SNAPSHOT" \
  --strategy "$PICKED_STRATEGY" \
  --mode "$MODE" \
  --tokens "$TOKENS_HINT" \
  --cost-usd "$COST_HINT" 2>>"$LOG_FILE")

echo "[starbird-runner] ground-truth metrics:" >> "$LOG_FILE"
echo "$GROUND_TRUTH" >> "$LOG_FILE"

# ── Step 7: Re-score strategies now that this run is in history ─────────
python3 "$STARBIRD_DIR/scripts/update-strategy-scores.py" >> "$LOG_FILE" 2>&1

# ── Step 8: dry-run does not commit. daily commits + pushes. ────────────
NEW_ENTITIES=$(echo "$GROUND_TRUTH" | python3 -c "import json,sys; print(json.load(sys.stdin).get('new_entities', 0))" 2>/dev/null || echo 0)

if [ "$MODE" = "daily" ] && [ "$NEW_ENTITIES" -gt 0 ]; then
  cd "$STARBIRD_DIR"

  # Coerce well-known nuisance type mismatches (numeric since/until on
  # ownership records) before the schema gate. The coercion pass only
  # touches unambiguous fixes; structural problems still fall through
  # to the hard gate below.
  echo "[starbird-runner] coercing data.json (numeric since/until → string)…" >> "$LOG_FILE"
  node "$STARBIRD_DIR/scripts/coerce-data.mjs" >> "$LOG_FILE" 2>&1 || \
    echo "[starbird-runner] WARN: coerce-data.mjs exited non-zero" >> "$LOG_FILE"

  # Pre-commit schema gate. Three runner passes have shipped invalid
  # ownership records (numeric since/until, free-text stake) that broke
  # the page until manually hotfixed. Reject the run before commit if
  # zod can't parse data.json — the diff stays in the working tree for
  # post-mortem and the next cron pass picks a fresh strategy.
  echo "[starbird-runner] validating data.json against schema…" >> "$LOG_FILE"
  if ! npx tsx "$STARBIRD_DIR/scripts/validate-data.mjs" >> "$LOG_FILE" 2>&1; then
    echo "[starbird-runner] FATAL: schema validation failed — refusing to commit" >> "$LOG_FILE"
    if [ -x "$NOTIFY" ]; then
      "$NOTIFY" "Starbird Runner BLOCKED — schema validation" \
        "Strategy $PICKED_STRATEGY produced data.json that fails DataFileSchema. Diff left uncommitted in $STARBIRD_DIR. See $LOG_FILE."
    fi
    [ -x "$LOG_EVENT" ] && "$LOG_EVENT" starbird-runner job.end \
      mode="$MODE" status="fail" exit_code=1 \
      duration_s="$(( $(date +%s) - JOB_START ))" reason="schema validation failed" || true
    exit 1
  fi

  # Refresh counts come from compute-run-metrics.py — used in both the
  # commit message and the Signal notification so updates are visible.
  REFRESHED_FIRMS_PRE=$(echo "$GROUND_TRUTH" | python3 -c "import json,sys; print(json.load(sys.stdin).get('refreshed_firms', 0))" 2>/dev/null || echo 0)
  REFRESHED_BRANDS_PRE=$(echo "$GROUND_TRUTH" | python3 -c "import json,sys; print(json.load(sys.stdin).get('refreshed_brands', 0))" 2>/dev/null || echo 0)
  REFRESHED_TOTAL=$((REFRESHED_FIRMS_PRE + REFRESHED_BRANDS_PRE))

  # ── Blog: append one dispatch for this run ────────────────────────────
  # Authoritative facts (which entities, date, value) come from GROUND_TRUTH;
  # Claude only contributes prose via tmp/blog-draft.json (best-effort, with a
  # mechanical fallback inside the script). A failure here must not block the
  # data commit, so it's tolerant.
  echo "[starbird-runner] appending blog dispatch…" >> "$LOG_FILE"
  echo "$GROUND_TRUTH" | python3 "$STARBIRD_DIR/scripts/append-blog-post.py" \
    --ground-truth - >> "$LOG_FILE" 2>&1 || \
    echo "[starbird-runner] WARN: blog post append failed" >> "$LOG_FILE"
  rm -f "$STARBIRD_DIR/tmp/blog-draft.json"

  # Regenerate share OG PNGs so newly-added entities and the new blog
  # dispatch each get an image. Runs after the blog append so the post
  # written above is included. The script is idempotent and overwrites
  # deterministically; `git add` only stages files that actually changed.
  echo "[starbird-runner] regenerating share OG PNGs…" >> "$LOG_FILE"
  python3 "$STARBIRD_DIR/scripts/generate-card-images.py" >> "$LOG_FILE" 2>&1 || \
    echo "[starbird-runner] WARN: card image generation failed" >> "$LOG_FILE"

  git add static/data.json static/cards/ static/posts/ static/blog.json
  git commit -m "Runner: $NEW_ENTITIES entity(ies) for $PICKED_STRATEGY

strategy: $PICKED_STRATEGY
new_entities: $NEW_ENTITIES
refreshed: $REFRESHED_TOTAL ($REFRESHED_BRANDS_PRE brand, $REFRESHED_FIRMS_PRE firm)

See tmp/runner-metrics-history.jsonl for observed metrics.
Co-Authored-By: Starbird Runner <noreply@anthropic.com>" >> "$LOG_FILE" 2>&1 || true
  git push >> "$LOG_FILE" 2>&1 || true
fi

# ── Step 9: Build rich notification from ground-truth metrics + labels ──
# We pull human-readable labels for the strategy and quest so Signal users
# don't have to decode underscores. Everything here comes from files on
# disk, not from Claude's self-report.
STRATEGY_LABEL=$(python3 "$STARBIRD_DIR/scripts/labels.py" strategy "$PICKED_STRATEGY")
STRATEGY_DESC=$(python3 "$STARBIRD_DIR/scripts/labels.py" strategy-desc "$PICKED_STRATEGY")
# Derive the value from the picked strategy so the notification reports the
# correct value system — not a hardcoded ICE label.
STRATEGY_VALUE=$(python3 "$STARBIRD_DIR/scripts/labels.py" strategy-value "$PICKED_STRATEGY")
VALUE_LABEL=$(python3 "$STARBIRD_DIR/scripts/labels.py" value "$STRATEGY_VALUE")

# Extract the specific new entity IDs and counts from the ground-truth record
# (not from Claude's self-report — these numbers are derived from the diff).
NEW_FIRMS=$(echo "$GROUND_TRUTH" | python3 -c "import json,sys; print(json.load(sys.stdin).get('new_firms', 0))" 2>/dev/null || echo 0)
NEW_BRANDS=$(echo "$GROUND_TRUTH" | python3 -c "import json,sys; print(json.load(sys.stdin).get('new_brands', 0))" 2>/dev/null || echo 0)
REFRESHED_FIRMS=$(echo "$GROUND_TRUTH" | python3 -c "import json,sys; print(json.load(sys.stdin).get('refreshed_firms', 0))" 2>/dev/null || echo 0)
REFRESHED_BRANDS=$(echo "$GROUND_TRUTH" | python3 -c "import json,sys; print(json.load(sys.stdin).get('refreshed_brands', 0))" 2>/dev/null || echo 0)
EVIDENCE=$(echo "$GROUND_TRUTH" | python3 -c "import json,sys; print(int(100 * json.load(sys.stdin).get('evidence_coverage', 0)))" 2>/dev/null || echo 0)
NEW_IDS=$(echo "$GROUND_TRUTH" | python3 -c "
import json, sys
d = json.load(sys.stdin)
# Dedupe across firm+brand since single-company entities appear in both arrays
# with the same ID. We care about unique entities, not records.
ids = list(dict.fromkeys(d.get('new_firm_ids', []) + d.get('new_brand_ids', [])))
print(', '.join(ids) if ids else 'none')
" 2>/dev/null || echo 'none')

MODE_LABEL="Dry Run"
if [ "$MODE" = "daily" ]; then
  MODE_LABEL="Daily"
fi

if [ "$EXIT" = "0" ] && [ "$NEW_ENTITIES" -gt 0 ]; then
  STATUS="added $NEW_ENTITIES"
elif [ "$EXIT" = "0" ]; then
  STATUS="no additions"
else
  STATUS="failed (exit $EXIT)"
fi

SUMMARY="Status: $STATUS
Value: $VALUE_LABEL
Strategy: $STRATEGY_LABEL
  → $STRATEGY_DESC
New: $NEW_BRANDS brand(s), $NEW_FIRMS firm(s) [$NEW_IDS]
Refreshed: $REFRESHED_BRANDS brand(s), $REFRESHED_FIRMS firm(s)
Evidence coverage: ${EVIDENCE}%
Cost: \$$COST_HINT / ${TOKENS_HINT} tokens"

if [ -x "$NOTIFY" ]; then
  if [ "$EXIT" = "0" ]; then
    "$NOTIFY" "Starbird Runner — $MODE_LABEL" "$SUMMARY"
  else
    "$NOTIFY" "Starbird Runner FAILED — $MODE_LABEL" "$SUMMARY"
  fi
else
  echo "[starbird-runner] notify.sh not found at $NOTIFY — skipping notification" >> "$LOG_FILE"
fi

{
  echo ""
  echo "=== NOTIFICATION SUMMARY ==="
  echo "$SUMMARY"
  echo "============================"
} >> "$LOG_FILE"

echo "[starbird-runner] Done. exit=$EXIT new=$NEW_ENTITIES" >> "$LOG_FILE"

JOB_DUR=$(( $(date +%s) - JOB_START ))
if [ "$EXIT" = "0" ]; then JOB_STATUS="ok"; else JOB_STATUS="fail"; fi
[ -x "$LOG_EVENT" ] && "$LOG_EVENT" starbird-runner job.end \
  mode="$MODE" status="$JOB_STATUS" exit_code="$EXIT" duration_s="$JOB_DUR" \
  strategy="$PICKED_STRATEGY" value="$STRATEGY_VALUE" \
  new_firms="$NEW_FIRMS" new_brands="$NEW_BRANDS" evidence_pct="$EVIDENCE" || true
