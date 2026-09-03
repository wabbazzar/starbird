# Ticket: Harm score recalibration — scope, role, and cohort drift

**Created:** 2026-09-02
**Owner:** Wesley
**Assignee:** Claude
**Status:** Built 2026-09-02 — all six phases done, uncommitted. Open for tuning (see "Open for iteration").

---

## Problem

An audit of all 451 firms / 607 brands against `src/lib/harm-score-rubric.json`
found the rank order is not measuring what the rubric says it measures.

### 1. Scope is ignored — the rubric's #1 input has no effect

| Entity | Score | Reality |
|---|---|---|
| Lemoine Disaster Recovery, LLC | 83 | one ICE-adjacent contract, 1 evidence entry |
| Edge Ops LLC / KVG, LLC / ISS Action | 83–86 | single-contract shells |
| **Blackstone** | **60** | $1T AUM, portfolio-wide sale-leasebacks, 6 tracked brands |
| **BlackRock** | **55** | $10T AUM |
| Roark Capital | 55 | $38B AUM, franchised food empire |

A single-contract LLC outranks the largest PE firm on earth by 23 points.
Blackstone at 60 sits *below the median firm* (median 68).

### 2. Score inflation over time

Median `harmScore` by `addedAt` month:

```
2026-04  n=181  median 60
2026-05  n= 55  median 70
2026-06  n= 63  median 70
2026-07  n= 69  median 79   <- peak
2026-08  n= 79  median 68
2026-09  n=  4  median 68
```

There is no re-scoring pass, so rank order partly encodes *when the runner
found an entity*, not how bad it is. Root cause: `scripts/starbird-runner-prompt.md`
line 227 is the runner's entire scoring instruction —
`harmScore (0–100, 50=neutral)`. No anchors, no worked examples, no caps.

### 3. Distribution is a lump, not a rank

373 of 451 firms (83%) sit in 50–85. Modal scores: 68 (n=35), 62 (n=31),
55 (n=27). Only 5 firms live in 15–45; the 61 entries at 5–9 are the
*aligned* "good guys". The rubric's Minimal/Moderate buckets (0–39) are
dead — the real scale is 50–98. Inside that band evidence density barely
varies (80+ firms average 1.43 evidence entries; 55–79 average 1.20), which
is not enough signal to justify a 25-point spread.

### 4. Duplicate firm records split the top of the list

| id | name | score | aumVal | brands |
|---|---|---|---|---|
| `leonard_green_and_partners` | Leonard Green & Partners | 97 | 70 | Container Store, Crunch, J.Crew |
| `leonard_green` | Leonard Green & Partners | 92 | 85 | Joann, Prospect Medical |
| `clorox_company` | The Clorox Company | 55 | 0 | Pine-Sol |
| `clorox` | The Clorox Company | 55 | 0 | Clorox, Glad |
| `georges` | George's, Inc. | 70 | 0 | — |
| `georges_inc` | George's, Inc. | 62 | 0 | — |

Same firm, split brands, contradictory scores and AUM. Both Leonard Green
records appear in the top 10 with a 5-point gap between them. The rubric's
own Catastrophic example cites all five Leonard Green brands as *one*
firm's record.

### 5. The PE inheritance discount discounts the wrong entities

`brandImpactScore()` in `src/lib/ranking.ts` subtracts 5 points when
`firm.aumVal > 0`. It was built so an active perpetrator (Palantir, 98)
outranks a PE *victim* (The Container Store). But it keys on "is this a
fund?", not "is this the actor?" — so Leonard Green, the perpetrator, gets
the victim discount, and so do Blackstone and KKR. Meanwhile 5 points is far
too small a haircut for pure inheritance: **The Container Store ranks 92,
above BlackRock at 55.** A housewares retailer that was *bought and
over-levered* should not out-rank the entity that did it to it, nor a $10T
asset manager.

---

## Goal

Make the rank order mean "how much documented harm does this entity cause,
at what scale" — consistently, regardless of when the entity entered the
database — and make the brand list mean "how much harm does buying here
fund", not "who happens to own this".

## Locked decisions

| # | Decision | Choice |
|---|---|---|
| 1 | Keep the 0–100 scale and the 6 rubric buckets? | **Yes.** The buckets and their public meaning stay; the *inputs* that produce a score change. Rubric goes to `version: 2`. |
| 2 | Recompute scores algorithmically from signals, or keep the researched number and constrain it? | **Constrain, don't replace.** `harmScore` stays the researched judgment; scope imposes a hard **cap** and a **floor**. A model built on 1.4 evidence entries per firm would be worse than the judgments it replaced. |
| 3 | Where does the brand discount live? | **`src/lib/ranking.ts` only** — still display-only, never written back into `data.json`. Single source of truth stays intact. |
| 4 | Do we rewrite stored `harmScore` values? | **Yes, for cap/floor violations and the April cohort** (Phase 4). Rewrites are recorded so they're auditable, not silent. |
| 5 | How is `scope` assigned to 451 firms? | Deterministic rules from `aumVal` / brand count / evidence count, **plus a checked-in override list** for known large operating companies. Judgment lives in a reviewable file, not in a heuristic. |

## The model

### New required firm fields

**`scope`** — how far the harm reaches. Drives a hard cap and floor.

| `scope` | cap | floor | meaning |
|---|---|---|---|
| `narrow` | 65 | — | one contract, one site, one incident; small vendor |
| `single_company` | 79 | — | one company's own conduct; thousands affected |
| `multi_company` | 94 | 60 | portfolio or multi-subsidiary pattern |
| `systemic` | 100 | 70 | economy-wide reach or historic scale |

Caps fix Lemoine LLC (83 → 65). Floors fix Blackstone (60 → 70) and
BlackRock (55 → 70).

**`role`** — whose conduct the score describes.

| `role` | meaning | brand inheritance discount |
|---|---|---|
| `actor` | the harm is this entity's own conduct (Palantir, GEO Group, ExxonMobil, Purdue) | 0 |
| `both` | operates *and* owns harmful subsidiaries (Adani, Tyson) | 10 |
| `owner` | harm realized through portfolio companies (all PE funds) | 25 |

### Brand impact score (replaces the flat 5-point discount)

```
inherited = ownerEffectiveScore − INHERIT_DISCOUNT[owner.role]
                               − STAKE_DISCOUNT[ownership.stake]
brandImpactScore = max(inherited) over all owners
```

`STAKE_DISCOUNT`: `majority` 0, `minority` 5, `former` 10, `post_bankrupt` 10.

Worked: The Container Store, owned `majority` by Leonard Green
(merged: 97, `role: owner`) → 97 − 25 − 0 = **72**. Severe, not
Catastrophic — and below every self-owned actor in the top 20.

All four constants are named exports in `ranking.ts` so retuning is a
one-line change. **Expect to iterate on these numbers after seeing the
first ranked output.**

---

## Phases

Each phase ends green on its named gates (`.agents/gates.md`) and is
committed separately.

### Phase 1 — Merge the three duplicate firms
- Merge `leonard_green` → `leonard_green_and_partners`; `clorox_company` →
  `clorox`; `georges_inc` → `georges`. Union `brands[]`, `harms[]`,
  `aligns[]`, `evidence[]`, `cats[]`; keep the higher `harmScore` and the
  richer `summary`; repoint every `brands[].ownership[].firmId`.
- **Gates:** `npx tsx scripts/dq-check.mjs`, `npx vitest run`.
- **Done when:** zero duplicate firm names, zero dangling `firmId`, firm
  count 451 → 448.

### Phase 2 — Add `scope` + `role` to the schema and backfill
- `src/lib/schema.ts`: add both as optional enums (additive; data version
  stays 2), plus `src/lib/types.ts`.
- `scripts/backfill-scope-role.mjs` — deterministic rules:
  - `aumVal >= 100` → `systemic` / `owner`
  - `aumVal > 0` → `multi_company` / `owner`
  - `aumVal == 0`, aligned (`harmScore < 20`) → `single_company` / `actor`
  - `aumVal == 0`, otherwise → `narrow` / `actor` (the ICE-vendor default)
  - then apply `scripts/scope-overrides.json` — a checked-in map of
    `firmId → {scope, role, note}` for known large operators (ExxonMobil,
    Chevron, Amazon, Alphabet, Palantir, GEO Group, CoreCivic, Purdue,
    McKinsey, Tyson, Nestlé USA, Adani, Rostec, NSO Group, FTX, …).
- `scripts/dq-check.mjs`: fail on any firm missing `scope` or `role`.
- **Gates:** `dq-check.mjs`, `npx svelte-check --threshold error`, `vitest`.
- **Done when:** 448/448 firms carry both fields; the override file
  explains every non-default assignment.

### Phase 3 — Rework `src/lib/ranking.ts`
- `firmEffectiveScore(firm)` — applies `SCOPE_CAP` / `SCOPE_FLOOR`.
- `brandImpactScore(brand, firmById)` — role- and stake-aware inheritance,
  built on `firmEffectiveScore`. Delete the `aumVal > 0` 5-point rule.
- Update consumers: `ChartsPanel.svelte`, `FirmCard.svelte`,
  `AumTreemap.svelte`, `StatStrip.svelte`, `aggregations.ts`,
  `scripts/shop-lib.mjs` (its `≥ 80` hard block now reads effective scores).
- New `src/lib/ranking.test.ts` covering: cap, floor, each `role`
  discount, each `stake` discount, multi-owner max, missing-field fallback.
- **Gates:** `vitest`, `svelte-check`, `npm run build`, plus a served-app
  check at `5173` that the Brands list and the top-brands chart agree.
- **Done when:** Container Store is out of the top 10 and Blackstone/
  BlackRock are above the firm median.

### Phase 4 — Rewrite stored scores: caps, floors, and the April cohort — **DONE, one decision changed**

**The planned April-cohort rescale was not applied, and should not be.** After
the cap/floor pass, per-cohort medians of harmful firms are 68 / 70 / 70 / 70 /
66 / 68 (Apr–Sep) — a 4-point spread against a ≤5 target. The drift was never a
cohort artefact; it was single-contract vendors scoring 78–90, which the
`narrow` cap now bounds at 65. A monotone rescale on top of that would have
been a fudge correcting a problem that no longer exists. Stored scores *are*
clamped into their scope band (31 down, 19 up) so Phase 6's gate can be strict
rather than advisory. Original plan follows.


- `scripts/recalibrate-harm-scores.mjs`:
  - clamp every stored `harmScore` into its scope's `[floor, cap]`;
  - correct the April-cohort drift (n=181, median 60 vs 68–79 for later
    cohorts) with a monotone recalibration so identical conduct scores the
    same regardless of research date — rank order *within* the cohort is
    preserved.
  - `--dry-run` prints a before/after diff table and writes nothing.
- Writes `docs/harm-score-recalibration-2026-09.md`: every changed firm,
  old score, new score, and which rule moved it.
- **Gates:** `dq-check.mjs`, `python3 scripts/verify-harm-score.py`,
  `vitest`, `npm run build`. Manual review of the diff table before commit.
- **Done when:** median `harmScore` per `addedAt` month varies by ≤ 5
  points, and no firm violates its scope cap or floor.

### Phase 5 — Teach the rubric and the runner the new scale
- `src/lib/harm-score-rubric.json` → `version: 2`: add `scope` and `role`
  to `inputs`, add the cap/floor table, refresh every bucket `example` to a
  post-recalibration firm.
- `scripts/starbird-runner-prompt.md`: replace the bare
  `harmScore (0–100, 50=neutral)` with the scoring section — the cap/floor
  table, three worked examples (a narrow ICE vendor, a mid PE fund, a
  systemic actor), and a requirement to emit `scope` + `role` on every new
  firm.
- `src/lib/components/AboutPanel.svelte` renders the new inputs (it already
  reads `HARM_SCORE_INPUTS` / `HARM_SCORE_BUCKETS`, so this should be
  free — verify, don't assume).
- **Gates:** `svelte-check`, `verify-harm-score.py`, `npm run build`, served
  check of the About panel at `5173`.
- **Done when:** a `FORCE_STRATEGY=... TARGET_PAIRS=1 bash
  scripts/starbird-runner.sh dry-run` produces a firm carrying `scope` +
  `role` and a score inside its cap.

### Phase 6 — Lock the invariants so they can't regress
- `scripts/verify-harm-score.py`: fail if any firm's `harmScore` violates
  its scope cap/floor, or if any firm is missing `scope`/`role`.
- `scripts/dq-check.mjs`: report per-cohort median drift; fail above a
  10-point spread.
- Add both to `.agents/gates.md` under the data-quality row.
- **Gates:** run both scripts; confirm each fails on a deliberately
  corrupted copy of `data.json` before passing on the real one.
- **Done when:** the release battery would catch a re-introduction of any
  of the five problems above.

---

## Out of scope

- Per-brand `harmScore` (brands still inherit; no independent brand score).
- Re-researching evidence for any firm — this ticket changes *scoring*, not
  *facts*. Thin evidence stays thin; it just can no longer buy an 85.
- Backfilling `layoffs` / `notableBk` (N/A on 410 of 451 firms).

## Open for iteration

Explicitly expected to change after the first ranked output is reviewed:

1. The four `SCOPE_CAP` / `SCOPE_FLOOR` values.
2. The three `INHERIT_DISCOUNT` values — 25 for `owner` is a first guess.
3. Whether `narrow` needs to split (a one-contract vendor vs a regional
   operator are both `narrow` today).
4. Whether the 61 aligned firms at 5–9 should move off the harm scale
   entirely rather than share it.
