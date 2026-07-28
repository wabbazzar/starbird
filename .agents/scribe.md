# Scribe — starbird project block

This file is concatenated AFTER `agents/scribe/role.md`. The role file
defines the generic contract (scope, modes, result-JSON shape). This
file overrides scribe's behavior for starbird.

## IMPORTANT — Override of role.md "Page shape"

The generic role describes regenerating Learn pages from a fixed
front-matter template. **That does NOT apply here.** Starbird docs
are hand-authored — `CLAUDE.md` is the operational notes file for
this codebase, and `docs/tickets/` is a small flat folder of
human-readable install/feature tickets. Do not impose front-matter
or a canonical body shape on them.

You operate in **two modes per slug**, picked from the slug table
below:

- **Surgical patch** — specific factual claim or count, minimal
  reviewable diff. Used for `CLAUDE.md` lines that mention entity
  counts, version numbers, file paths, or feature presence; and
  for ticket Status fields.
- **Section rewrite** — when a section in `CLAUDE.md` describes a
  subsystem that has materially diverged from the code (e.g. the
  Runner levers table, the Strategy bank section), you may rewrite
  that section against the current code. Read the code first.
  Preserve the doc's existing structure, headings, and voice.
  Don't blow away the whole file. Don't add headings the
  maintainer didn't write.

## Allowed content paths (from config.toml `scribe.content_paths`)

- `CLAUDE.md`
- `docs/`
- `docs/tickets/`

Everything else is read-only — that's release / build / human
territory.

## What's actually in scope

### CLAUDE.md (the load-bearing doc)

The single most important doc to keep accurate. Slug table:

| Section                       | Mode      | Source of truth                                          |
|-------------------------------|-----------|----------------------------------------------------------|
| Stack line                    | surgical  | `package.json` dependencies, `svelte.config.js`          |
| Runner levers table           | surgical  | env-var reads in `scripts/starbird-runner.sh`            |
| Cron schedule on wabbazzar-ice| surgical  | `crontab -l` excerpt + the new systemd timers            |
| Strategy bank section         | rewrite   | `scripts/update-strategy-scores.py` STRATEGIES list + `scripts/labels.py` STRATEGY_LABELS — when these drift from the prose. |
| Legacy release-check pattern  | rewrite   | superseded by the shipyard crew — see ticket `docs/tickets/complete/install-guardian-augur-medic.md`. If the legacy standalone check script has been removed, drop this section. |
| Data schema section           | surgical  | `src/lib/schema.ts` field list                            |
| Brand ranking section         | surgical  | `brandImpactScore()` in `src/routes/+page.svelte`         |
| Key rule (tags need evidence) | surgical  | enforced in `scripts/starbird-runner-prompt.md`           |
| Deploy line                   | surgical  | `.github/workflows/deploy.yml` + `static/CNAME`           |

### docs/tickets/

Reconcile ticket `Status:` fields against reality.

- `docs/tickets/complete/install-guardian-augur-medic.md` — Status currently
  reads "Ready to install — bindings written, awaiting wire-up".
  As of the first release/medic green run, advance to
  "Installed — three of four agents green, scribe + build still
  failing first-run gates (see ticket body for follow-ups)".
  When all four agents are green for 7 consecutive days, advance
  to "Complete — close ticket and `git mv` to `docs/tickets/complete/`".

If `docs/tickets/complete/` doesn't exist yet, create it (single
empty `.gitkeep` is fine).

## Hard prohibitions (additive to config.toml content_paths)

- **Never edit code-level files.** Even when CLAUDE.md drifts because
  of a code change, do NOT "fix" the code to match the doc. Rewrite
  the doc to match the code.
- **Never delete a ticket.** Archive via `git mv` only.
- **Never change ticket dates** (`Created:`) — those are forensic.
- **Never claim a feature is "shipped" without `git log` evidence.**
  When advancing a status line in a ticket, the commit message of
  this scribe run should reference the relevant feature commit
  SHA(s).

## Self-check before commit

- Did your diff touch anything outside `content_paths`? ABORT.
- Are CLAUDE.md counts (number of strategies, value count, brand
  count) drifted from data.json + the source files? If so, this
  run should fix them — that's the dominant scribe value-add here.
- Is the change explainable in one sentence? If not, you're doing
  too much in a single run. Reduce scope.
