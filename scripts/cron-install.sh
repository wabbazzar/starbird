#!/bin/bash
# cron-install.sh — document the cron entry for the Starbird research runner.
#
# USAGE: prints the crontab line to stdout. Review then install:
#   (crontab -l 2>/dev/null; $0 | grep -v '^#') | crontab -
#
# The guardian, augur, medic, and scribe agents are NO LONGER cron-driven —
# they live as systemd user timers on wabbazzar-ice, installed via
# /home/wabbazzar/code/wabbazzar-ice/scripts/install-quartet.sh --project .
# Don't re-add a `starbird-guardian.sh` cron line here or it will race the
# 06:00 timer (see ticket: docs/tickets/install-guardian-augur-medic.md).

cat <<'CRON'
# ── Starbird research runner ──────────────────────────────────────────
# Picks a quest, proposes additions, validates against schema, pushes.
# The push fires the post-push guardian hook (`.claude/hooks/post-push-starbird-guardian.sh`)
# which routes to the wabbazzar-ice generic guardian runner.
5 7 * * * /home/wabbazzar/code/starbird/scripts/starbird-runner.sh daily >> /tmp/starbird-runner.log 2>&1
CRON

echo ""
echo "To install: crontab -e  and paste the above, or run:"
echo "  (crontab -l 2>/dev/null; $0 | grep -v '^#') | crontab -"
