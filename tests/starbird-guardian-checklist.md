# Starbird Guardian Checklist

Permanent regression guards. Starbird Guardian runs these on every invocation.
Edit this file to add new checks. Dev agent adds entries when new data features are built.

## Always run (hook + daily)

- [ ] `npm run check` — svelte-check must report 0 errors (0 warnings is nice-to-have but not required)
- [ ] `BASE_PATH='/starbird' npm run build` — must exit 0, `build/index.html` must exist
- [ ] `static/data.json` must parse cleanly against `DataFileSchema` in `src/lib/schema.ts`
  - [ ] version field equals 2
  - [ ] every `firm.id` is unique and matches `^[a-z0-9][a-z0-9_]*$`
  - [ ] every `brand.id` is unique and matches the same slug pattern
  - [ ] every `brand.ownership[].firmId` references an existing `firm.id`
  - [ ] every `firm.harms[]` and `brand.harms[]` entry is a valid `QuestId`
  - [ ] every `firm.cats[]` entry is a valid `CategoryId`
  - [ ] every `brand.cat` is a valid `CategoryId`
  - [ ] every `firm.harmScore` is an integer 0–100
  - [ ] every `firm.source` is a valid URL
- [ ] No runner-injected entry has `firmId: "unknown_pe"` without a `note` explaining why (the runner should always resolve to a specific firm or add one)
- [ ] `python3 scripts/verify-harm-score.py` exits 0 (rubric in `src/lib/harm-score-rubric.json` spans 0–100 with no gaps/overlaps, every required bucket field is present, and every `firm.harmScore` in `static/data.json` maps to exactly one defined bucket — catches drift between the rubric and the data layer)
- [ ] `src/lib/components/AboutPanel.svelte` imports `HARM_SCORE_BUCKETS` and `HARM_SCORE_INPUTS` from `$lib/harmScore`, not inlined — the rubric has ONE source of truth at `src/lib/harm-score-rubric.json` and the About page must render from it directly, so drift between the two is impossible by construction

## Daily only

- [ ] Stale source audit: every `firm.source` URL returns 2xx/3xx on HEAD request
- [ ] Stale source audit: URLs referenced in `brand.why` still resolve (best-effort)
- [ ] Runner freshness: `tmp/starbird-runner-metrics.json` modified in the last 48 hours (warns if runner hasn't executed recently)
- [ ] Data freshness: at least one new brand or firm added in the last 14 days (warns otherwise — means the runner is not producing)

## Context from dev agent

_One-time investigation tasks go in `scripts/starbird-guardian-prompt.md`, not here._

_Quest coverage targets go in `scripts/starbird-runner-prompt.md`, not here._
