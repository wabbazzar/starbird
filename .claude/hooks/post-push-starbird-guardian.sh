#!/bin/bash
# Claude Code PostToolUse hook: trigger Starbird Guardian after git push.
# Only fires on Bash commands containing "git push".

set -euo pipefail

INPUT=$(cat)
COMMAND=$(echo "$INPUT" | jq -r '.tool_input.command // ""')

if ! echo "$COMMAND" | grep -q 'git push'; then
  exit 0
fi

RUNNER="/home/wabbazzar/code/wabbazzar-ice/agents/guardian/runner.sh"
if [ -x "$RUNNER" ]; then
  nohup bash "$RUNNER" --project /home/wabbazzar/code/starbird --mode hook > /dev/null 2>&1 &
fi

exit 0
