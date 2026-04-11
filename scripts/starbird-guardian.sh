#!/bin/bash
# starbird-guardian.sh — Headless quality-gate agent for the Starbird main branch.
# Usage: starbird-guardian.sh [hook|daily]
#
# hook  = fast:        svelte-check + build + zod validation (Sonnet)
# daily = comprehensive: hook checks + stale-source audit + fix attempts (Sonnet → Opus for fixes)

set -euo pipefail

MODE="${1:-hook}"
STARBIRD_DIR="/home/wabbazzar/code/starbird"
NOTIFY="/home/wabbazzar/code/wabbazzar-ice/scripts/notify.sh"
PROMPT_FILE="$STARBIRD_DIR/scripts/starbird-guardian-prompt.md"
RESULT_FILE="$STARBIRD_DIR/tmp/starbird-guardian-result.json"
LOG_FILE="$STARBIRD_DIR/tmp/starbird-guardian-last-run.log"

cd "$STARBIRD_DIR"
mkdir -p tmp

# Read the prompt and inject mode + timestamp
PROMPT="$(cat "$PROMPT_FILE")

MODE=$MODE
TIMESTAMP=$(date -u +%Y-%m-%dT%H:%M:%SZ)"

# Sonnet for the main loop. The prompt tells the agent to call Opus subagents for fixes.
MODEL="sonnet"

# Budget: hook runs are cheap, daily runs get more headroom for fix attempts
if [ "$MODE" = "daily" ]; then
  BUDGET="2.00"
else
  BUDGET="0.50"
fi

echo "[starbird-guardian] Starting $MODE run at $(date)" > "$LOG_FILE"

claude -p \
  --model "$MODEL" \
  --dangerously-skip-permissions \
  --max-budget-usd "$BUDGET" \
  --output-format text \
  "$PROMPT" \
  >> "$LOG_FILE" 2>&1

EXIT=$?

echo "[starbird-guardian] Claude exited with code $EXIT" >> "$LOG_FILE"

# Extract pass status from the result JSON
if [ -f "$RESULT_FILE" ]; then
  PASS=$(python3 -c "import json; print(json.load(open('$RESULT_FILE')).get('pass', False))" 2>/dev/null || echo "False")
else
  PASS="False"
fi

# Build notification summary
SUMMARY=$(tail -30 "$LOG_FILE" | grep -A20 "STARBIRD GUARDIAN RESULT" | head -10)
if [ -z "$SUMMARY" ]; then
  SUMMARY="Starbird Guardian completed (mode=$MODE, exit=$EXIT). Check $LOG_FILE for details."
fi

# Signal notification (falls back silently if notify.sh isn't installed)
if [ -x "$NOTIFY" ]; then
  if [ "$PASS" = "True" ]; then
    "$NOTIFY" "Starbird Guardian ($MODE)" "$SUMMARY"
  else
    "$NOTIFY" "Starbird Guardian FAILED ($MODE)" "$SUMMARY"
  fi
else
  echo "[starbird-guardian] notify.sh not found at $NOTIFY — skipping notification" >> "$LOG_FILE"
fi

echo "[starbird-guardian] Done. Pass=$PASS" >> "$LOG_FILE"
