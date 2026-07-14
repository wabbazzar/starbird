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
- **5:00 AM daily** — Runner (`scripts/starbird-runner.sh`), daily mode — auto-commits + pushes. *(Note: `scripts/cron-install.sh` currently emits `5 7 * * *` / 7:05 AM — the live crontab and the install script have drifted; reconcile with `crontab -e` or update the script before the next reinstall.)*

Systemd timers (agent infrastructure, installed 2026-05-19):
- **Every 10 min around the clock (skips 01:00–04:59 while the other agents run)** — Medic (`starbird-medic.timer`) — live-data probe + runner success heartbeat
- **1:00 AM daily** — Scribe (`starbird-scribe.timer`) — doc refresh
- **3:30 AM daily** — Augur (`starbird-augur.timer`) — nightly incident triage
- **4:30 AM daily** — Guardian (`starbird-guardian.timer`) — full daily audit

Reinstall cron: `bash scripts/cron-install.sh`. Check timers: `systemctl --user list-timers | grep starbird`.

## Strategy bank

24 strategies across 6 values (4 per value). Defined in three parallel files that must stay in sync:

1. `scripts/update-strategy-scores.py` — STRATEGIES list (id + parent value)
2. `scripts/labels.py` — STRATEGY_LABELS (human-readable label + description + primary source URL)
3. `scripts/starbird-runner-prompt.md` — strategy bank section (execution instructions per strategy)

Strategy scoring is deterministic: `new_entities / cost_usd` over the last 10 runs, weighted by per-value progress (linear falloff to 0 at target). Scores in `tmp/starbird-runner-strategy-scores.json`, history in `tmp/runner-metrics-history.jsonl`. Claude never writes to either — the launcher computes ground-truth metrics from a `data.json` diff.

## Data schema

- `static/data.json` — version 2, firms[] + brands[]
- `static/blog.json` — per-run runner dispatches; one post per nightly run, appended by `scripts/append-blog-post.py`
- `src/lib/schema.ts` — zod validation (run at page load + by Guardian)
- `src/lib/blog.ts` — BlogPost type + zod BlogFileSchema (version + posts[])
- `src/lib/values.ts` — 6 values (workers, environment, animals, health, extraction, elite_impunity)
- `src/lib/quests.ts` — 17 quests, each rolls up to one value
- `src/lib/categories.ts` — 9 categories (tech, food, coffee, retail, health, pets, home, hospitality, finance)
- `src/lib/harmScore.ts` + `src/lib/harm-score-rubric.json` — harm score rubric (single source of truth, 6 buckets spanning 0–100)

## Brand ranking: 5-point inheritance discount

When sorted by harm impact, brands rank by the max `harmScore` of their parent firm(s), but PE-owned brands get a **5-point inheritance discount** (firm `aumVal > 0` = PE fund). Self-owned brands (`aumVal` = 0, e.g. Palantir, Clearview AI, ExxonMobil) use the raw score. This prevents a brand that is merely a *victim* of PE over-leveraging (e.g. The Container Store via Leonard Green at 97) from outranking a brand that is itself the harmful actor (e.g. Palantir at 98). The discount is applied in `brandImpactScore()` in `src/lib/ranking.ts` and is display-only — it does not change the stored `harmScore` in `data.json`.

## Key rule: tags need evidence

Every harm tag on a brand or firm MUST have corresponding evidence in the `why` (brands) or `summary` (firms) field. When the runner adds a new tag to an existing entry, it must also append evidence text. A tag without evidence is a data quality violation. The Guardian checklist enforces this.

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
