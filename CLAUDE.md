# Starbird — Claude Code operational notes

## Stack

SvelteKit 2 + Svelte 5 + Vite 6 + TypeScript 5 + Tailwind 3 + Vitest 4, adapter-static to GitHub Pages. Matches the stack used by shredly2 and heatherandwesley.

## Runner levers

The research runner (`scripts/starbird-runner.sh`) has several env vars:

| Variable | Default | Purpose |
|----------|---------|---------|
| `TARGET_PAIRS` | 3 | Number of firm+brand pairs per run. Budget scales automatically ($0.50/pair + $0.50 overhead). |
| `FORCE_STRATEGY` | (unset) | Override the deterministic strategy picker. When set, the runner skips `pick-strategy.py` and uses this strategy ID verbatim. Useful for testing or manually directing research at a specific value/source. |
| `MAX_ITERATIONS` | 40 | For `run-until-full.sh` only. Hard cap on loop iterations. |
| `MAX_SPEND_USD` | 150 | For `run-until-full.sh` only. Hard cap on total spend across all iterations. |

### Common invocations

```bash
# Quick dry run (no commit, no push, $1.50 budget)
TARGET_PAIRS=3 bash scripts/starbird-runner.sh dry-run

# Force a specific strategy for testing
FORCE_STRATEGY=pesp_bankruptcy_tracker TARGET_PAIRS=5 bash scripts/starbird-runner.sh dry-run

# Full sweep until all values hit 50
TARGET_PAIRS=10 MAX_ITERATIONS=25 MAX_SPEND_USD=120 bash scripts/run-until-full.sh daily

# Manual Guardian check (hook mode = fast)
bash scripts/starbird-guardian.sh hook

# Manual Guardian check (daily mode = deep audit including stale sources)
bash scripts/starbird-guardian.sh daily
```

## Cron schedule (installed on wabbazzar-ice)

- **6:15 AM daily** — Guardian daily mode (stale-source audit, harm-score rubric check, schema validation)
- **7:05 AM daily** — Runner daily mode (one research iteration, auto-commits + pushes, fires Guardian hook)

Install/reinstall: `bash scripts/cron-install.sh` prints the entries; they're also live in `crontab -l`.

## Strategy bank

24 strategies across 6 values (4 per value). Defined in three parallel files that must stay in sync:

1. `scripts/update-strategy-scores.py` — STRATEGIES list (id + parent value)
2. `scripts/labels.py` — STRATEGY_LABELS (human-readable label + description + primary source URL)
3. `scripts/starbird-runner-prompt.md` — strategy bank section (execution instructions per strategy)

Strategy scoring is deterministic: `new_entities / cost_usd` over the last 10 runs, weighted by per-value progress (linear falloff to 0 at target). Scores in `tmp/starbird-runner-strategy-scores.json`, history in `tmp/runner-metrics-history.jsonl`. Claude never writes to either — the launcher computes ground-truth metrics from a `data.json` diff.

## Guardian pattern

Mirrors shredly2. Files:

- `scripts/starbird-guardian.sh` — bash launcher (hook or daily mode)
- `scripts/starbird-guardian-prompt.md` — agent instructions
- `tests/starbird-guardian-checklist.md` — curated regression guards
- `.claude/hooks/post-push-starbird-guardian.sh` — PostToolUse hook, fires on any `git push`
- `.claude/settings.json` — registers the hook

Signal notifications via `/home/wabbazzar/code/wabbazzar-ice/scripts/notify.sh`.

## Data schema

- `static/data.json` — version 2, firms[] + brands[]
- `src/lib/schema.ts` — zod validation (run at page load + by Guardian)
- `src/lib/values.ts` — 6 values (workers, environment, animals, health, extraction, elite_impunity)
- `src/lib/quests.ts` — 11 quests, each rolls up to one value
- `src/lib/categories.ts` — 9 categories (tech, food, coffee, retail, health, pets, home, hospitality, finance)
- `src/lib/harmScore.ts` + `src/lib/harm-score-rubric.json` — harm score rubric (single source of truth, 6 buckets spanning 0–100)

## Brand ranking: 5-point inheritance discount

Brands are sorted by the max `harmScore` of their parent firm(s), but PE-owned brands get a **5-point inheritance discount** (firm `aumVal > 0` = PE fund). Self-owned brands (`aumVal` = 0, e.g. Palantir, Clearview AI, ExxonMobil) use the raw score. This prevents a brand that is merely a *victim* of PE over-leveraging (e.g. The Container Store via Leonard Green at 97) from outranking a brand that is itself the harmful actor (e.g. Palantir at 98). The discount is applied in `brandImpactScore()` in `src/routes/+page.svelte` and is display-only — it does not change the stored `harmScore` in `data.json`.

## Key rule: tags need evidence

Every harm tag on a brand or firm MUST have corresponding evidence in the `why` (brands) or `summary` (firms) field. When the runner adds a new tag to an existing entry, it must also append evidence text. A tag without evidence is a data quality violation. The Guardian checklist enforces this.

## Deploy

Push to main → GitHub Actions build + deploy to GitHub Pages at `wabbazzar.github.io/starbird/`. The push also fires the Guardian hook locally.
