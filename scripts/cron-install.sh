#!/bin/bash
# cron-install.sh — document the cron entries for Starbird Runner + Guardian.
#
# USAGE: this script prints the crontab lines to stdout. Review them, then
# install with `crontab -e` or `crontab scripts/cron-install.sh | crontab -`.
# We do NOT auto-install because cron is a system resource and owning it
# silently from a repo script is the kind of surprise nobody enjoys.
#
# Schedule:
#   07:05 daily — runner picks a quest, researches, proposes, validates, pushes
#   07:20 daily — guardian daily mode does stale-source audit + deep checks
#
# The runner runs first so the guardian's daily audit can catch any fresh
# regressions immediately, while the notification channel is warm.

cat <<'CRON'
# ── Starbird ──────────────────────────────────────────────────────────
# Research loop: picks a quest, proposes additions, pushes to main.
# Push fires the guardian hook automatically for fast validation.
5 7 * * * /home/wabbazzar/code/starbird/scripts/starbird-runner.sh daily

# Daily guardian audit: deep checks including stale-source verification.
# Independent of the runner — runs even if the runner didn't produce output.
20 7 * * * /home/wabbazzar/code/starbird/scripts/starbird-guardian.sh daily
CRON

echo ""
echo "To install: crontab -e  and paste the above, or run:"
echo "  (crontab -l 2>/dev/null; $0 | grep -v '^#') | crontab -"
