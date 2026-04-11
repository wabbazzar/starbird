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

MODE="${1:-daily}"
STARBIRD_DIR="/home/wabbazzar/code/starbird"
NOTIFY="/home/wabbazzar/code/wabbazzar-ice/scripts/notify.sh"
PROMPT_FILE="$STARBIRD_DIR/scripts/starbird-runner-prompt.md"
LOG_FILE="$STARBIRD_DIR/tmp/starbird-runner-last-run.log"
BEFORE_SNAPSHOT="$STARBIRD_DIR/tmp/data-before.json"

cd "$STARBIRD_DIR"
mkdir -p tmp

echo "[starbird-runner] Starting $MODE run at $(date)" > "$LOG_FILE"

# ── Step 1: Update strategy scores from run history (deterministic) ─────
python3 "$STARBIRD_DIR/scripts/update-strategy-scores.py" >> "$LOG_FILE" 2>&1

# ── Step 2: Pick a strategy (deterministic) ─────────────────────────────
PICKED_STRATEGY="$(python3 "$STARBIRD_DIR/scripts/pick-strategy.py" 2>>"$LOG_FILE")"
if [ -z "$PICKED_STRATEGY" ]; then
  echo "[starbird-runner] FATAL: strategy picker returned empty" >> "$LOG_FILE"
  exit 1
fi
echo "[starbird-runner] picked strategy: $PICKED_STRATEGY" >> "$LOG_FILE"

# ── Step 3: Snapshot data.json so we can diff afterwards ────────────────
cp "$STARBIRD_DIR/static/data.json" "$BEFORE_SNAPSHOT"

# ── Step 4: Assemble the prompt with injected facts ─────────────────────
PROMPT="$(cat "$PROMPT_FILE")

MODE=$MODE
TIMESTAMP=$(date -u +%Y-%m-%dT%H:%M:%SZ)
PICKED_STRATEGY=$PICKED_STRATEGY

(The launcher has already chosen the strategy for this run. You do not
decide which strategy to use, and you do not write to the scores file.
Execute the strategy above and only that strategy.)"

MODEL="sonnet"

if [ "$MODE" = "dry-run" ]; then
  BUDGET="1.00"
else
  BUDGET="4.00"
fi

# ── Step 5: Invoke Claude ───────────────────────────────────────────────
claude -p \
  --model "$MODEL" \
  --dangerously-skip-permissions \
  --max-budget-usd "$BUDGET" \
  --output-format text \
  "$PROMPT" \
  >> "$LOG_FILE" 2>&1 || true

EXIT=$?
echo "[starbird-runner] Claude exited with code $EXIT" >> "$LOG_FILE"

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
  git add static/data.json
  git commit -m "Runner: $NEW_ENTITIES entity(ies) for $PICKED_STRATEGY

strategy: $PICKED_STRATEGY
new_entities: $NEW_ENTITIES

See tmp/runner-metrics-history.jsonl for observed metrics.
Co-Authored-By: Starbird Runner <noreply@anthropic.com>" >> "$LOG_FILE" 2>&1 || true
  git push >> "$LOG_FILE" 2>&1 || true
fi

# ── Step 9: Notification ────────────────────────────────────────────────
SUMMARY="Starbird Runner ($MODE): $NEW_ENTITIES new, strategy=$PICKED_STRATEGY. exit=$EXIT"

if [ -x "$NOTIFY" ]; then
  if [ "$EXIT" = "0" ]; then
    "$NOTIFY" "Starbird Runner ($MODE)" "$SUMMARY"
  else
    "$NOTIFY" "Starbird Runner FAILED ($MODE)" "$SUMMARY"
  fi
else
  echo "[starbird-runner] notify.sh not found at $NOTIFY — skipping notification" >> "$LOG_FILE"
fi

echo "[starbird-runner] Done. $SUMMARY" >> "$LOG_FILE"
