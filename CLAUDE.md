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

## Brand ranking: 5-point inheritance discount

When sorted by harm impact, brands rank by the max `harmScore` of their parent firm(s), but PE-owned brands get a **5-point inheritance discount** (firm `aumVal > 0` = PE fund). Self-owned brands (`aumVal` = 0, e.g. Palantir, Clearview AI, ExxonMobil) use the raw score. This prevents a brand that is merely a *victim* of PE over-leveraging (e.g. The Container Store via Leonard Green at 97) from outranking a brand that is itself the harmful actor (e.g. Palantir at 98). The discount is applied in `brandImpactScore()` in `src/lib/ranking.ts` and is display-only — it does not change the stored `harmScore` in `data.json`.

## Key rule: tags need evidence

Every harm tag on a brand or firm MUST have corresponding evidence in the `why` (brands) or `summary` (firms) field. Since the Phase 3 evidence backfill (`48f6736`), every firm and brand also carries a structured `evidence[]` array — one entry per tag, with `text`/`date`/`amountUsd`/`amountKind`/`actor`/`sourceUrl` — currently 377/377 firms and 521/521 brands. `scripts/dq-check.mjs` enforces tag→evidence linkage against this array (fails on any harm/align tag missing a matching `evidence.tag`) and is one of the data-quality gate commands in `.agents/gates.md`. When the runner adds a new tag to an existing entry, it must append both the prose evidence and a matching `evidence[]` entry. Note: the nightly release pass (`.agents/release.md` step 4) still only describes a `scripts/check-evidence-coverage.py` sampling check that was never written — `dq-check.mjs` has since covered that gap for any entity carrying `evidence[]`.

## `/shop` skill

`/shop <what you want>` shops on your behalf without steering you toward
companies misaligned with the six values. Committed at
`.claude/commands/shop.md`; shared logic in `scripts/shop-lib.mjs` (reuses
`brandImpactScore()` + the harm buckets). Two tiers:

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
cloners: no API keys, just `git clone` → `/shop`. Design: `docs/tickets/shop-skill.md`.

## Deploy

Push to main → GitHub Actions build + deploy to GitHub Pages (custom domain: `starbird42.com`).
