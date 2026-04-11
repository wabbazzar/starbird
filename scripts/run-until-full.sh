#!/bin/bash
# run-until-full.sh — Loop the Starbird Runner until every value hits its
# target. Delegates all scoring, picking, and metric computation to the
# existing runner pipeline. Exits when pick-strategy.py reports that all
# values are complete (exit code 3), or when the overall spend budget is
# exhausted, or when the max iteration count is reached.
#
# Usage:
#   bash scripts/run-until-full.sh [daily|dry-run]
#
# Optional env vars:
#   TARGET_PAIRS    pairs per iteration (default 10)
#   MAX_ITERATIONS  hard cap on number of runner invocations (default 40)
#   MAX_SPEND_USD   hard cap on total spend across iterations (default 150)

set -euo pipefail

MODE="${1:-daily}"
STARBIRD_DIR="/home/wabbazzar/code/starbird"
RUNNER="$STARBIRD_DIR/scripts/starbird-runner.sh"
HISTORY="$STARBIRD_DIR/tmp/runner-metrics-history.jsonl"
LOOP_LOG="$STARBIRD_DIR/tmp/run-until-full.log"
TARGET_PAIRS="${TARGET_PAIRS:-10}"
MAX_ITERATIONS="${MAX_ITERATIONS:-40}"
MAX_SPEND_USD="${MAX_SPEND_USD:-150}"

cd "$STARBIRD_DIR"
mkdir -p tmp

echo "[run-until-full] Starting loop at $(date) — mode=$MODE target=$TARGET_PAIRS max_iter=$MAX_ITERATIONS max_spend=\$$MAX_SPEND_USD" > "$LOOP_LOG"

ITER=0
while [ "$ITER" -lt "$MAX_ITERATIONS" ]; do
  ITER=$((ITER + 1))
  echo "" >> "$LOOP_LOG"
  echo "[run-until-full] ── iteration $ITER ──" >> "$LOOP_LOG"

  # Check total spend so far (sum over history)
  if [ -f "$HISTORY" ]; then
    TOTAL_SPEND=$(python3 -c "
import json, sys
total = 0.0
try:
    with open('$HISTORY') as f:
        for line in f:
            line = line.strip()
            if not line:
                continue
            try:
                total += float(json.loads(line).get('cost_usd', 0.0))
            except Exception:
                pass
except FileNotFoundError:
    pass
print(total)
")
  else
    TOTAL_SPEND="0.0"
  fi
  echo "[run-until-full] total spend so far: \$$TOTAL_SPEND" >> "$LOOP_LOG"

  OVER=$(python3 -c "print(1 if float('$TOTAL_SPEND') >= float('$MAX_SPEND_USD') else 0)")
  if [ "$OVER" = "1" ]; then
    echo "[run-until-full] HALTING: total spend \$$TOTAL_SPEND >= cap \$$MAX_SPEND_USD" >> "$LOOP_LOG"
    break
  fi

  # Pre-check: if pick-strategy would return exit 3 (all values complete),
  # we don't need to invoke the full runner at all.
  python3 scripts/update-strategy-scores.py >> "$LOOP_LOG" 2>&1
  # Run the picker and capture its exit code explicitly. The previous
  # "if ! cmd; then RC=$?" form didn't reliably preserve the original
  # exit code inside the then-block, so the exit-3 branch never fired
  # and the loop spun through empty iterations.
  python3 scripts/pick-strategy.py >/dev/null 2>&1
  RC=$?
  if [ "$RC" = "3" ]; then
    echo "[run-until-full] HALTING: all values complete (picker exit 3)" >> "$LOOP_LOG"
    break
  fi
  if [ "$RC" != "0" ]; then
    echo "[run-until-full] WARN: picker returned unexpected exit $RC, continuing" >> "$LOOP_LOG"
  fi

  # Fire one runner iteration. TARGET_PAIRS is passed through via env.
  echo "[run-until-full] invoking runner ($MODE, TARGET_PAIRS=$TARGET_PAIRS)" >> "$LOOP_LOG"
  TARGET_PAIRS="$TARGET_PAIRS" bash "$RUNNER" "$MODE" || true
  echo "[run-until-full] runner iteration $ITER finished" >> "$LOOP_LOG"

  # Short pause so transient fs state settles and so we don't flood git.
  sleep 2
done

echo "" >> "$LOOP_LOG"
echo "[run-until-full] Loop ended at $(date) after $ITER iterations" >> "$LOOP_LOG"

# Final summary of where each value landed
python3 scripts/update-strategy-scores.py >> "$LOOP_LOG" 2>&1
python3 -c "
import json
d = json.load(open('tmp/starbird-runner-strategy-scores.json'))
print('=== FINAL VALUE COUNTS ===')
for v, c in d['current_counts'].items():
    target = d['targets_per_value'][v]
    status = '✓' if c >= target else f'({target - c} short)'
    print(f'  {v}: {c}/{target} {status}')
" >> "$LOOP_LOG" 2>&1

echo "[run-until-full] Done. See $LOOP_LOG for full trace." >> "$LOOP_LOG"
tail -20 "$LOOP_LOG"
