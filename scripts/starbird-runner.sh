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

set -euo pipefail

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

echo "[starbird-runner] Starting $MODE run at $(date)" > "$LOG_FILE"

# ── Step 1: Update strategy scores from run history (deterministic) ─────
python3 "$STARBIRD_DIR/scripts/update-strategy-scores.py" >> "$LOG_FILE" 2>&1

# ── Step 2: Pick a strategy (deterministic, unless FORCE_STRATEGY is set) ─
if [ -n "${FORCE_STRATEGY:-}" ]; then
  PICKED_STRATEGY="$FORCE_STRATEGY"
  echo "[starbird-runner] FORCED strategy override: $PICKED_STRATEGY" >> "$LOG_FILE"
else
  PICKED_STRATEGY="$(python3 "$STARBIRD_DIR/scripts/pick-strategy.py" 2>>"$LOG_FILE")"
  if [ -z "$PICKED_STRATEGY" ]; then
    echo "[starbird-runner] FATAL: strategy picker returned empty" >> "$LOG_FILE"
    exit 1
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

# Pin the Claude Code binary. The auto-updated 2.1.123 ships a regression
# that throws "API Error: 400 due to tool use concurrency issues" on the
# runner's tool-heavy research prompt — reproduced 3/3 retries on
# 2026-04-30. 2.1.122 is the last version that ran the runner cleanly
# (yesterday, 2026-04-29). Override with `CLAUDE_BIN=...` if you need to
# test a different version. Revisit + drop this pin once Anthropic ships
# a fix on a newer version.
CLAUDE_BIN="${CLAUDE_BIN:-/home/wabbazzar/.local/share/claude/versions/2.1.122}"
if [ ! -x "$CLAUDE_BIN" ]; then
  echo "[starbird-runner] FATAL: pinned claude binary not found at $CLAUDE_BIN" >> "$LOG_FILE"
  echo "[starbird-runner] falling back to system claude on PATH" >> "$LOG_FILE"
  CLAUDE_BIN="$(command -v claude)"
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
    --output-format text \
    "$PROMPT" \
    >> "$LOG_FILE" 2>&1
  EXIT=$?
  set -e
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
TOKENS_HINT=0
COST_HINT=0
# If Claude wrote a metrics file with its own estimates, pull the token/cost
# figures (which we can't verify deterministically) but nothing else.
CLAUDE_METRICS="$STARBIRD_DIR/tmp/starbird-runner-claude-report.json"
if [ -f "$CLAUDE_METRICS" ]; then
  TOKENS_HINT=$(python3 -c "import json,sys; d=json.load(open('$CLAUDE_METRICS')); print(int(d.get('tokens_spent', 0)))" 2>/dev/null || echo 0)
  COST_HINT=$(python3 -c "import json,sys; d=json.load(open('$CLAUDE_METRICS')); print(float(d.get('cost_usd', 0)))" 2>/dev/null || echo 0)
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

  # Regenerate share card PNGs so newly-added entities get an OG image.
  # The script is idempotent and overwrites all cards deterministically;
  # `git add static/cards/` only stages files that actually changed.
  echo "[starbird-runner] regenerating share card PNGs…" >> "$LOG_FILE"
  python3 "$STARBIRD_DIR/scripts/generate-card-images.py" >> "$LOG_FILE" 2>&1 || \
    echo "[starbird-runner] WARN: card image generation failed" >> "$LOG_FILE"

  git add static/data.json static/cards/
  git commit -m "Runner: $NEW_ENTITIES entity(ies) for $PICKED_STRATEGY

strategy: $PICKED_STRATEGY
new_entities: $NEW_ENTITIES

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
