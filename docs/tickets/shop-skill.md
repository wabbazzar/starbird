# Ticket: `/shop` — values-aligned shopping skill

**Created:** 2026-06-21
**Owner:** Wesley
**Assignee:** (unassigned)
**Status:** Design — approved decisions locked, ready to implement

---

## Problem / goal

Starbird already knows *which* companies harm the six values
(`workers`, `environment`, `animals`, `health`, `extraction`,
`elite_impunity`). What it doesn't do yet is help a person **act on
that knowledge at the point of purchase.**

Ship a committed, repo-local slash command — `/shop` — that lets Claude
shop on the user's behalf while guaranteeing it never steers them toward
a company misaligned with the project's vectors. The skill is the
consumer-facing inverse of the runner: the runner *builds* the harm
database; `/shop` *spends* it.

Because Starbird is an open-source project, the skill must work for
anyone who clones the repo with **zero machine-specific setup** — no API
keys, no `~/.env`, no hub paths. `git clone` → `/shop` → it works.

## Scope (v1) — locked decisions

These four were decided up front; the implementation must honor them.

| # | Decision | Choice |
|---|----------|--------|
| 1 | **How far does it go?** | **Vet + recommend.** Claude vets candidates against the vectors and returns a recommended pick + alternatives with a buy-link. The *user* checks out. No cart automation, no payment, no stored credentials in v1. |
| 2 | **"Good region" threshold** | **Safe = absent from DB, OR present with `harmScore < 40`** (Minimal/Moderate). `40+` (Significant and up) triggers "find an alternative." `80+` is a hard block — never recommended even if the user asks. |
| 3 | **Where Tier 2 writes** | **Local staging file + optional PR.** New profiles go to a gitignored `tmp/shop-candidates.json` for instant reuse; promotion to canonical `static/data.json` happens only via an explicit, human-reviewed PR. No silent writes to the shared dataset. |
| 4 | **Tier 2 lookup source** | **Built-in `WebSearch` / `WebFetch` only.** No keys, no external accounts. Same toolset the runner effectively relies on. |

**Explicitly out of scope for v1:** browser cart automation, checkout,
payment, price comparison/optimization, multi-retailer fulfillment,
recurring orders. (Tracked as future work below.)

## How it works — the two tiers

The user invokes `/shop <what they want>` — e.g. `/shop running shoes`,
`/shop a standing desk under $400`, `/shop Brooks Ghost 15`. The query
can name a specific brand/product or describe a need.

### Tier 1 — vet against the existing database (always runs first)

For each candidate brand the query implies:

1. **Resolve to a company.** Match the candidate against
   `static/data.json` `brands[].avoid` (display name) and `brands[].id`,
   and against `firms[].name` / `firms[].brands[]`. Fuzzy/alias match —
   "Brooks Running" → "Brooks".
2. **Decide using the locked threshold (Decision #2):**
   - **Not in DB** → *provisionally safe* (Tier 1 ends here for this
     candidate; Tier 2 may deep-check it, see below).
   - **In DB**, compute the brand's effective score via
     `brandImpactScore(brand, firmById)` from `src/lib/ranking.ts`
     (this already applies the 5-point PE inheritance discount):
     - `< 40` → **OK to buy.** Surface the score + one line of why.
     - `40–79` → **avoid; find an alternative** (see Tier 1 alts +
       Tier 2 search).
     - `≥ 80` → **hard block.** Never recommend; state the reason
       plainly (e.g. "Extreme: portfolio-wide bankruptcies").
3. **Pull alternatives the cheap way first.** If the avoided brand is in
   the DB, its `brands[].alts[]` array is a curated, human-written list
   of replacements — surface those before doing any web work.

Tier 1 is **fully offline** — it only reads `static/data.json`. If every
candidate is either absent or `< 40`, the skill answers without touching
the network.

### Tier 2 — research, profile, and find a clean alternative

Triggered when (a) a candidate is **absent from the DB** and the user
wants it verified rather than assumed-safe, or (b) the chosen brand is
`≥ 40` and we need a replacement that isn't already covered by
`alts[]`.

1. **Check the local candidate cache first.** Read
   `tmp/shop-candidates.json`. If this company was profiled in a prior
   `/shop` run, reuse that verdict — no re-research.
2. **Research ownership** with built-in `WebSearch` / `WebFetch`: who
   owns the brand, is the parent a PE fund, what's the documented harm.
   Reuse the entity-shape and **"tags need evidence"** rules from
   `scripts/starbird-runner-prompt.md` — every harm tag must carry a
   sourced evidence line. No citation → no tag.
3. **Score it** against `src/lib/harm-score-rubric.json` (the same 6
   buckets the runner uses), producing a `harmScore` and `harms[]`.
4. **Write the profile to `tmp/shop-candidates.json`** (gitignored,
   schema-shaped like a `data.json` firm/brand pair). This is the
   "save that profile" step:
   - If **good** (`< 40`) → recommend it.
   - If **not good** (`≥ 40`) → **keep the profile** (so we never
     re-research it) **and keep searching** for another alternative.
     Loop until a clean option is found or the search space is
     exhausted.
5. **Offer promotion (optional, never automatic).** At the end of a run
   that produced new profiles, offer: *"Add N vetted companies to the
   canonical database? (opens a PR for review)"*. On yes, run the
   existing validate/coerce gate and `gh pr create` against
   `static/data.json` — **human reviews and merges.** This is the only
   path from a personal lookup to the shared dataset (Decision #3),
   which keeps ad-hoc, possibly-wrong lookups out of `main`.

### Worked example

```
/shop running shoes

Tier 1 (offline):
  Brooks      → in DB, parent Berkshire, effective score 62  → AVOID (Severe)
  New Balance → not in DB                                     → check
  Allbirds    → not in DB                                     → check

Tier 2 (web, only for the unknowns + replacing Brooks):
  New Balance → researched: privately held, no PE, clean      → score 12  ✓ cached
  Allbirds    → researched: public, B-Corp, no harms found    → score 8   ✓ cached

Recommendation: New Balance or Allbirds
  Avoided: Brooks (Berkshire Hathaway, harmScore 62 — Severe)
  Buy: newbalance.com/... | allbirds.com/...   (you check out)

Add the 2 new profiles to the canonical DB? [opens a PR] (y/N)
```

## Files to create

| Path | Purpose | Committed? |
|------|---------|-----------|
| `.claude/commands/shop.md` | The slash command itself — frontmatter (`description`, `allowed-tools: Read, WebSearch, WebFetch, Bash, Write`) + the Tier 1 / Tier 2 procedure. | yes |
| `scripts/shop-lib.mjs` | Pure helpers so the skill isn't reimplementing logic in prose: `resolveCandidate(query, data)`, `verdictFor(brand, firmById)` (wraps `brandImpactScore` + the 40/80 thresholds), `readCandidateCache()` / `writeCandidate()`. Imports the existing `src/lib/ranking.ts` + `src/lib/schema.ts` so the skill and the site share one source of truth. | yes |
| `tmp/shop-candidates.json` | Per-user local cache of Tier 2 profiles. Created on first run. | **no — add to `.gitignore`** |

Reuse, don't fork: `src/lib/ranking.ts` (`brandImpactScore`),
`src/lib/schema.ts` (Zod shapes for any profile we persist),
`src/lib/harm-score-rubric.json` (scoring buckets),
`scripts/validate-data.mjs` + `scripts/coerce-data.mjs` (the PR-promotion
gate), and the entity/evidence rules in
`scripts/starbird-runner-prompt.md`.

## Open-source setup story (acceptance-critical)

A cloner must get a working `/shop` from `git clone` alone:

- `.claude/commands/shop.md` and `scripts/shop-lib.mjs` are committed, so
  they arrive with the repo.
- The only runtime dependency is Claude Code's built-in `WebSearch` /
  `WebFetch` (Decision #4) — **no keys, no `~/.env`, no hub paths.**
- The candidate cache is created lazily on first run; absence is normal,
  not an error.
- The skill must degrade gracefully when web tools are unavailable
  (sandbox / offline): Tier 1 still works fully; Tier 2 says "couldn't
  research X — treat as unverified" rather than crashing.
- A short `## /shop` section is added to `CLAUDE.md` (and/or `README`)
  documenting invocation and the two tiers.

## Guardrails

- **Never recommend a brand scoring `≥ 80`**, even on direct request —
  state the block reason instead.
- **No checkout, no payment, no stored credentials** in v1. The skill
  hands back a buy-link; the human transacts.
- **Never auto-commit to `static/data.json`.** Promotion is PR-only and
  human-reviewed (Decision #3).
- **Tags need evidence** carries over from the runner: any harm tag the
  skill writes to a profile must cite a source.
- When Tier 1 says "not in DB → safe," **say so honestly** — distinguish
  "verified clean" (Tier 2 researched it) from "no data, assumed safe"
  (Tier 1 only). Don't overstate confidence.

## Acceptance criteria

- [ ] `/shop <known-bad brand>` (e.g. a brand whose parent scores 60+)
      avoids it, names the parent firm + score + bucket, and offers
      alternatives from `alts[]`.
- [ ] `/shop <brand scoring <40>` returns "OK to buy" with the score and
      a one-line why.
- [ ] `/shop <unknown brand>` runs Tier 2, researches ownership via
      built-in web tools, writes a profile to `tmp/shop-candidates.json`,
      and a second `/shop` for the same brand reuses the cache without
      re-researching.
- [ ] A Tier 2 run that finds the first pick is `≥ 40` keeps its profile
      and continues searching until it surfaces a `< 40` alternative (or
      reports the space exhausted).
- [ ] A brand scoring `≥ 80` is never recommended, even when named
      directly.
- [ ] Tier 1 runs with the network disabled (offline) and still produces
      a verdict for in-DB brands.
- [ ] `tmp/shop-candidates.json` is gitignored; no `/shop` run mutates
      `static/data.json` without an explicit PR.
- [ ] Fresh clone on a second machine: `git clone` → `/shop running
      shoes` works with no additional setup.

## Future work (explicitly deferred)

- **Tier 1.5 — cart drafting** via the `dev-browser` skill: vet, then
  add to the retailer cart and stop at checkout for the human to pay.
  (This was the "Vet + draft cart" option; revisit once v1 is proven.)
- Price/availability comparison across retailers.
- Promote the `tmp/shop-candidates.json` → `data.json` PR flow into the
  runner's metrics loop so community lookups feed strategy scoring.
- A `/shop --audit <cart-or-receipt>` mode that vets an existing
  basket/order history rather than a single query.
