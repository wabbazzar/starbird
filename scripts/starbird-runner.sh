#!/bin/bash
# starbird-runner.sh — Headless research agent that enriches Starbird's dataset.
# Usage: starbird-runner.sh [daily|dry-run]
#
# daily   = run one iteration of the research loop, commit + push results
# dry-run = same but do not commit; write proposed changes to tmp/ for review

set -euo pipefail

MODE="${1:-daily}"
STARBIRD_DIR="/home/wabbazzar/code/starbird"
NOTIFY="/home/wabbazzar/code/wabbazzar-ice/scripts/notify.sh"
PROMPT_FILE="$STARBIRD_DIR/scripts/starbird-runner-prompt.md"
METRICS_FILE="$STARBIRD_DIR/tmp/starbird-runner-metrics.json"
PROPOSED_FILE="$STARBIRD_DIR/tmp/starbird-runner-proposed.json"
LOG_FILE="$STARBIRD_DIR/tmp/starbird-runner-last-run.log"

cd "$STARBIRD_DIR"
mkdir -p tmp

# Read the prompt and inject mode + timestamp
PROMPT="$(cat "$PROMPT_FILE")

MODE=$MODE
TIMESTAMP=$(date -u +%Y-%m-%dT%H:%M:%SZ)"

# Sonnet for extraction, Opus for hard decisions (merging conflicts, resolving unknown_pe).
MODEL="sonnet"

# Budget: give the runner real room. Research is the value-add, this is where
# we want it to spend more than the guardian. Daily runs get the most.
if [ "$MODE" = "dry-run" ]; then
  BUDGET="1.00"
else
  BUDGET="4.00"
fi

echo "[starbird-runner] Starting $MODE run at $(date)" > "$LOG_FILE"

claude -p \
  --model "$MODEL" \
  --dangerously-skip-permissions \
  --max-budget-usd "$BUDGET" \
  --output-format text \
  "$PROMPT" \
  >> "$LOG_FILE" 2>&1

EXIT=$?

echo "[starbird-runner] Claude exited with code $EXIT" >> "$LOG_FILE"

# Extract metric summary for notification
if [ -f "$METRICS_FILE" ]; then
  NEW_ENTITIES=$(python3 -c "import json; d=json.load(open('$METRICS_FILE')); print(d.get('new_entities', 0))" 2>/dev/null || echo "?")
  TOKENS=$(python3 -c "import json; d=json.load(open('$METRICS_FILE')); print(d.get('tokens_spent', 0))" 2>/dev/null || echo "?")
  STRATEGY=$(python3 -c "import json; d=json.load(open('$METRICS_FILE')); print(d.get('strategy_id', '?'))" 2>/dev/null || echo "?")
else
  NEW_ENTITIES="?"
  TOKENS="?"
  STRATEGY="?"
fi

SUMMARY="Starbird Runner ($MODE): $NEW_ENTITIES new, strategy=$STRATEGY, tokens=$TOKENS. exit=$EXIT"

# Signal notification (falls back silently if notify.sh isn't installed)
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
