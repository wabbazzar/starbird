# Starbird — Claude Code operational notes

## Stack

SvelteKit 2 + Svelte 5 + Vite 6 + TypeScript 5 + Tailwind 3 + Vitest 4, adapter-static to GitHub Pages. Matches the stack used by shredly2 and heatherandwesley.

## Runner levers

The research runner (`scripts/starbird-runner.sh`) has several env vars:

| Variable | Default | Purpose |
|----------|---------|---------|
| `TARGET_PAIRS` | 3 | Number of firm+brand pairs per run. Budget scales automatically ($0.50/pair + $0.50 overhead); daily mode has a $4.00 floor, dry-run does not. |
| `FORCE_STRATEGY` | (unset) | Override the deterministic strategy picker. When set, the runner skips `pick-strategy.py` and uses this strategy ID verbatim. Useful for testing or manually directing research at a specific value/source. |
| `MAX_ITERATIONS` | 40 | For `run-until-full.sh` only. Hard cap on loop iterations. |
| `MAX_SPEND_USD` | 150 | For `run-until-full.sh` only. Hard cap on total spend across all iterations. |

### Common invocations

```bash
# Quick dry run (no commit, no push, $2.00 budget)
TARGET_PAIRS=3 bash scripts/starbird-runner.sh dry-run

# Force a specific strategy for testing
FORCE_STRATEGY=pesp_bankruptcy_tracker TARGET_PAIRS=5 bash scripts/starbird-runner.sh dry-run

# Full sweep until all values hit 100
TARGET_PAIRS=10 MAX_ITERATIONS=25 MAX_SPEND_USD=120 bash scripts/run-until-full.sh daily
```

## Cron schedule (installed on wabbazzar-ice)

Cron entries (still active):
- **5:00 AM daily** — Runner (`scripts/starbird-runner.sh`), daily mode — auto-commits + pushes. Invoked via the shared `wabbazzar-ice/scripts/cron-run.sh` wrapper, not directly. *(Note: `scripts/cron-install.sh` still prints a standalone `5 7 * * *` / 7:05 AM line — that script has not been reconciled with the live crontab entry or the cron-run.sh wrapper; don't paste its output verbatim.)*

Systemd timers (agent infrastructure; renamed to the shipyard/spacetime theme, see `51e5da0`/`7a2d1b3`): the pre-rename display names are gone — units are named for the spacetime theme:
- **1:00 AM daily** — Scribe (`starbird-chronicler.timer`) — doc refresh (this agent)
- **3:30 AM daily** — Build (`starbird-helldiver.timer`) — nightly user-feedback triage + autonomous fixer
- **4:30 AM daily** — Release (`starbird-proctor.timer`) — daily tests + typecheck + data audit + build
- **5:00 AM daily** — Design (`starbird-mentat.timer`) — pre-build design/architecture pass (new; no predecessor)
- **Every 10 min, hours 00 and 05–23 (skips 01:00–04:59 while the other agents run)** — Medic (`starbird-suk.timer`) — failure-triggered triage / live-data probe + runner success heartbeat

Check timers: `systemctl --user list-timers | grep starbird`.

Standing (non-timer) service: **`starbird-proctor-watch.service`** — the shoulder-mode release critic. Runs continuously (`Restart=on-failure`), watching a per-session edit queue (`.claude` PostToolUse hook → `critic-queue.sh`) and firing one cold-context critique batch via `shipyard/agents/release/critic-watch.sh` when a session goes quiet or enough files pile up. Config in `.agents/shoulder.env` (gitignored). Check: `systemctl --user status starbird-proctor-watch.service`.

## Strategy bank

24 strategies across 6 values (4 per value). Defined in three parallel files that must stay in sync:

1. `scripts/update-strategy-scores.py` — STRATEGIES list (id + parent value)
2. `scripts/labels.py` — STRATEGY_LABELS (human-readable label + description + primary source URL)
3. `scripts/starbird-runner-prompt.md` — strategy bank section (execution instructions per strategy)

Strategy scoring is deterministic: `new_entities / cost_usd` over the last 10 runs, weighted by per-value progress (linear falloff to 0 at target). Scores in `tmp/starbird-runner-strategy-scores.json`, history in `tmp/runner-metrics-history.jsonl`. Claude never writes to either — the launcher computes ground-truth metrics from a `data.json` diff.

## Data schema

- `static/data.json` — version 2, firms[] + brands[]
- `static/blog.json` — per-run runner dispatches; one post per nightly run, appended by `scripts/append-blog-post.py`
- `src/lib/schema.ts` — zod validation (run at page load + by the release battery)
- `src/lib/blog.ts` — BlogPost type + zod BlogFileSchema (version + posts[])
- `src/lib/values.ts` — 6 values (workers, environment, animals, health, extraction, elite_impunity)
- `src/lib/quests.ts` — 17 quests, each rolls up to one value
- `src/lib/categories.ts` — 9 categories (tech, food, coffee, retail, health, pets, home, hospitality, finance)
- `src/lib/harmScore.ts` + `src/lib/harm-score-rubric.json` — harm score rubric (single source of truth, 6 buckets spanning 0–100)

## Harm scoring: scope caps, role-aware inheritance (rubric v2)

`firms[].harmScore` in `data.json` is the *researched judgment*. Two structured
fields bound it. Both are **required** on every firm; `dq-check.mjs` fails on a
missing one and `verify-harm-score.py` fails on an out-of-band score.

**`scope`** — how far the harm reaches. Caps and floors the score:

| scope | cap | floor | typical |
|---|---|---|---|
| `narrow` | 65 | — | one contract / site / incident; small vendor or shell |
| `single_company` | 79 | — | one substantial operator's own conduct |
| `multi_company` | 94 | 60 | portfolio, conglomerate, multi-subsidiary; PE funds < $100B AUM |
| `systemic` | 100 | 70 | economy-wide reach or historic scale |

**`role`** — `actor` (own conduct) / `owner` (via portfolio companies; every PE
fund) / `both`. Sets the brand inheritance discount: 0 / 25 / 10 points.

Brand rank = `max(ownerEffectiveScore − INHERIT_DISCOUNT[role] − STAKE_DISCOUNT[stake])`.
`STAKE_DISCOUNT`: majority 0, minority 5, former 10, post_bankrupt 10. All
constants are named exports in `src/lib/ranking.ts` — that file is the single
tuning surface, and `firmEffectiveScore()` / `brandImpactScore()` are the single
source of truth for every ranked surface (Brands list, Firms list, ChartsPanel,
FirmCard, AumTreemap, StatStrip, `aggregations.ts`, `scripts/shop-lib.mjs`).

This replaced a flat 5-point discount keyed on `aumVal > 0`, which keyed on "is
this a fund?" rather than "is this the actor?" — so Leonard Green, the
perpetrator, got the victim's discount, and The Container Store (a PE victim)
ranked 92, above BlackRock at 55. It now ranks 62.

Backfill and audit trail:
- `scripts/backfill-scope-role.mjs` — deterministic rules (aumVal; sole
  `workers_ice_cooperation` tag → `narrow`) then `scripts/scope-overrides.json`,
  a reviewed per-firm map with a written note for every non-default assignment.
  **Any 80+ score requires an entry there**, because the default cap is 79.
- `scripts/recalibrate-harm-scores.mjs` — clamps stored scores into their band.
  Ran 2026-09-02: 31 capped down, 19 floored up. See
  `docs/harm-score-recalibration-2026-09.md`.
- `scripts/merge-duplicate-firms.mjs` — merged three duplicate firm records
  (Leonard Green ×2, Clorox ×2, George's ×2); firm count 451 → 448 at the time
  of that merge (the runner has since added new firms; 454 as of this writing).

Per-cohort median `harmScore` was 60 (Apr) → 79 (Jul), i.e. rank order encoded
*research date*. After the scope pass it is 66–70 across all cohorts;
`dq-check.mjs` now fails above a 10-point spread. The fix at source is the
Scoring section in `scripts/starbird-runner-prompt.md` — pick scope *before*
picking a number.

## Key rule: tags need evidence

Every harm tag on a brand or firm MUST have corresponding evidence in the `why` (brands) or `summary` (firms) field. Since the Phase 3 evidence backfill (`48f6736`), every firm and brand also carries a structured `evidence[]` array — one entry per tag, with `text`/`date`/`amountUsd`/`amountKind`/`actor`/`sourceUrl` — currently 454/454 firms and 616/616 brands. `scripts/dq-check.mjs` enforces tag→evidence linkage against this array (fails on any harm/align tag missing a matching `evidence.tag`) and is one of the data-quality gate commands in `.agents/gates.md`. When the runner adds a new tag to an existing entry, it must append both the prose evidence and a matching `evidence[]` entry. Note: the nightly release pass (`.agents/release.md` step 4) still only describes a `scripts/check-evidence-coverage.py` sampling check that was never written — `dq-check.mjs` has since covered that gap for any entity carrying `evidence[]`.

## `/shop` skill

`/shop <what you want>` shops on your behalf without steering you toward
companies misaligned with the six values. Committed at
`.claude/commands/shop.md`; shared logic in `scripts/shop-lib.mjs` (reuses
`brandImpactScore()` / `firmEffectiveScore()` + the harm buckets). Two tiers:

- **Tier 1 (offline):** vet candidates against `static/data.json`. Safe = absent
  **or** `harmScore < 40`; `40–79` → find an alternative; `≥ 80` → hard block.
- **Tier 2 (web):** research unknowns via built-in `WebSearch`, cache profiles to
  the gitignored `tmp/shop-candidates.json`, keep searching until a clean pick.

The **whole buy path is vetted, not just the product**: the retailer behind each
buy-link is `resolve`d like any other candidate, so a clean item is never routed
through a flagged storefront (e.g. Amazon, Severe) — it gets a clean retailer or
the manufacturer's page instead.

Recommends + buy-link only — no checkout/payment. New profiles reach canonical
`data.json` by PR only (human-reviewed), never auto-write. Zero setup for
cloners: no API keys, just `git clone` → `/shop`. Design: `docs/tickets/complete/shop-skill.md`.

## Deploy

Push to main → GitHub Actions build + deploy to GitHub Pages (custom domain: `starbird42.com`).
