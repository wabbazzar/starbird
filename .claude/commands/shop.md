---
description: Shop on the user's behalf without steering them toward companies misaligned with Starbird's six values. Vets every candidate against the harm database (Tier 1, offline) and researches unknowns on the web (Tier 2), then recommends a clean pick + a buy-link. Never automates checkout or payment.
allowed-tools: Read, Bash, Write, WebSearch, WebFetch
---

# /shop — values-aligned shopping

You are shopping **for** the user. Your job is to find them something good to
buy while **guaranteeing you never recommend a company misaligned with the six
Starbird values** (workers, environment, animals, health, extraction,
elite_impunity). The user transacts; you vet and recommend.

Design + locked decisions: `docs/tickets/shop-skill.md`. Read it if anything
below is ambiguous.

## Invocation

`/shop <what they want>` — e.g. `/shop running shoes`, `/shop a standing desk
under $400`, `/shop 80 bags of 5000psi cement`, `/shop Brooks Ghost 15`. The
query may name a specific brand/product or describe a need + constraints
(quantity, budget, specs). Preserve those constraints in your final pick.

## The contract (guardrails — never violate)

- **Never recommend a brand scoring ≥ 80**, even if the user names it directly.
  State the block reason instead.
- **Vet + recommend only.** No cart automation, no checkout, no payment, no
  stored credentials. End with buy-link(s); the human checks out.
- **Never auto-write `static/data.json`.** Tier-2 profiles go to the gitignored
  local cache. Promotion to the canonical DB is PR-only and human-reviewed.
- **Tags need evidence.** Any harm tag you record for a profile must cite a
  source URL. No citation → no tag.
- **Be honest about confidence.** Distinguish "verified clean" (you researched
  it) from "no data, assumed safe" (only absent from the DB). Don't overstate.

## Thresholds (locked)

Safe = absent from DB **OR** `harmScore < 40`. `40–79` → avoid, find an
alternative. `≥ 80` → hard block. (Source of truth: `scripts/shop-lib.mjs`.)

## The tool

All DB/cache logic lives in `scripts/shop-lib.mjs` so you don't reimplement
scoring. Run it via tsx. Prefix with `NODE_NO_WARNINGS=1` to mute a noisy tsx
deprecation line:

```bash
# Vet one or more candidate names against the DB + local cache:
NODE_NO_WARNINGS=1 npx tsx scripts/shop-lib.mjs resolve "Quikrete" "Sakrete"
# …add --json for machine-readable output.

# Persist Tier-2 research as proper firm/brand entries (see shape below):
echo '<json>' | NODE_NO_WARNINGS=1 npx tsx scripts/shop-lib.mjs cache-add
NODE_NO_WARNINGS=1 npx tsx scripts/shop-lib.mjs cache-list

# Merge the cache into static/data.json (promotion; then validate + PR):
NODE_NO_WARNINGS=1 npx tsx scripts/shop-lib.mjs promote
```

`resolve` applies `brandImpactScore()` (the same 5-point PE discount the site
uses) and returns one of: `OK TO BUY`, `AVOID`, `HARD BLOCK`, or `NOT IN DB`.

**Always format Tier-2 findings as proper data.json badges.** The cache
(`tmp/shop-candidates.json`) mirrors `static/data.json` exactly —
`{ version: 2, firms: [...], brands: [...] }` — so what you research is already
the canonical shape the app renders and is promotion-ready. `cache-add`
**rejects** anything that isn't schema-valid (ownership refs must resolve, ids
unique, harm tags valid), so you can't persist a malformed badge.

## Procedure

### Step 0 — Enumerate candidates

From the query, list the real brands/products that satisfy the need. For a
specific brand, that's just it (plus a couple of obvious peers in case it's
flagged). For a generic need ("running shoes", "5000psi cement"), use your own
knowledge to name the 4–8 brands a person would actually choose between.

### Step 1 — Tier 1: vet against the database (offline, always first)

Run `resolve` on every candidate. For each:

- **NOT IN DB** → provisionally safe. If the user wants real assurance (or you
  have nothing left that's confirmed clean), send it to Tier 2; otherwise you
  may recommend it labeled *"no data — assumed safe, not verified."*
- **OK TO BUY (`< 40`)** → eligible. Keep it.
- **AVOID (`40–79`)** → drop it. If it's an in-DB brand, its curated `alts[]`
  (shown in `resolve` output) are pre-vetted replacements — prefer those.
- **HARD BLOCK (`≥ 80`)** → drop it; never resurface it.

If at least one candidate is `OK TO BUY` or credibly NOT-IN-DB, you can often
stop here without touching the network.

### Step 2 — Tier 2: research unknowns & find a clean alternative

Trigger when an unknown needs verifying, or every in-DB candidate is `≥ 40`
and you need a replacement not already in `alts[]`.

For each company to research:

1. **Check the cache first** — `resolve` already consulted it; don't re-research
   a name it resolved from `source: cache`.
2. **Research ownership** with `WebSearch` / `WebFetch`: who owns the brand, is
   the parent a PE fund / public conglomerate / private, and is there
   documented harm across the six values. Cite every claim.
3. **Score it** against the six harm buckets (Minimal 0–19, Moderate 20–39,
   Significant 40–59, Severe 60–79, Extreme 80–94, Catastrophic 95–100) using
   the rubric dimensions: scope, permanence, intentionality, pattern, evidence.
4. **Save it as a proper firm + brand badge** via `cache-add` (shape below).
   If the brand inherits `< 40` → recommend it. If `≥ 40` → keep the entry (so
   it's never re-researched) **and keep searching** for another option. Loop
   until you have a clean pick or you've exhausted reasonable candidates.

Badge shape (`cache-add`) — a `firm` (the owner; carries `harmScore`) plus a
`brand` (consumer-facing; inherits the firm's score). Match `static/data.json`
conventions: operating companies (private or public, not PE funds) use
`aumVal: 0` + `aum: "N/A"`; building materials use `cat: "home"`; every harm
tag needs a matching `evidence[]` entry with a `sourceUrl`.

```json
{
  "firm": {
    "id": "quikrete_companies", "name": "The Quikrete Companies",
    "aum": "N/A", "aumVal": 0,
    "blurb": "Largest U.S. manufacturer of packaged concrete and cement mixes.",
    "summary": "Harm narrative with sourced claims. Tagged environment_general.",
    "brands": ["Quikrete"], "layoffs": "N/A", "notableBk": "N/A",
    "harmScore": 18, "source": "https://…",
    "cats": ["home"], "harms": ["environment_general"], "aligns": [],
    "addedAt": "2026-06-21",
    "evidence": [{ "tag": "environment_general", "text": "…", "sourceUrl": "https://…" }]
  },
  "brand": {
    "id": "quikrete", "avoid": "Quikrete",
    "ownership": [{ "firmId": "quikrete_companies", "stake": "majority", "since": "1940" }],
    "cat": "home", "alts": [],
    "blurb": "Bagged concrete, cement, and mortar mixes for DIY and trade.",
    "why": "Same harm narrative, brand-facing. Tagged environment_general.",
    "harms": ["environment_general"], "aligns": [],
    "addedAt": "2026-06-21",
    "evidence": [{ "tag": "environment_general", "text": "…", "sourceUrl": "https://…" }]
  }
}
```

Valid harm tags (QuestIds): `workers_general`, `workers_ice_cooperation`,
`workers_mass_layoffs`, `workers_positive`, `environment_general`,
`environment_positive`, `animals_general`, `animals_positive`,
`health_general`, `health_positive`, `extraction_general`,
`extraction_sale_leaseback`, `extraction_debt_loading`, `extraction_positive`,
`elite_impunity_general`, `elite_impunity_epstein_network`,
`elite_impunity_positive`. Categories: `tech food coffee retail health pets
home hospitality finance`.

If web tools are unavailable (sandbox/offline), say so and fall back to Tier 1
only — label unknowns "unverified" rather than guessing.

### Step 3 — Recommend

Give the user:

- **The pick(s)** that satisfy their constraints (quantity, budget, specs),
  each with a one-line "why it's clean" and a **buy-link** (manufacturer or a
  major retailer's product page). They check out themselves.
- **What you avoided and why** — name the flagged brand, its parent firm, score,
  and bucket, so the recommendation is auditable.
- **Confidence label** per pick: *verified clean* vs *no data, assumed safe*.

### Step 4 — Offer promotion (optional, never automatic)

If Tier 2 produced new badges, offer once: *"Add N vetted companies to the
canonical Starbird database? (opens a PR for human review)."* Only on an
explicit yes: branch, run `promote` (merges the cache badges into
`static/data.json`), then `npx tsx scripts/validate-data.mjs`, commit, and
`gh pr create` — a human merges. Never push to `static/data.json` directly.
