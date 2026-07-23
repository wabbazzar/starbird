# Release — starbird project block

This file is concatenated AFTER `agents/release/role.md`. The role file
covers the generic protocol (modes, hard rules, result-JSON schema,
fail→medic handoff). Below is starbird-specific: the actual checks to
run, the special-case data handling, and the project-specific result
fields.

The recurring failure mode you are most responsible for: the runner
periodically writes `static/data.json` with shapes that fail
`src/lib/schema.ts`. Specifically — numeric `since` / `until` instead
of strings, and free-text `stake` values like `"self-owned"`,
`"IP owner"`, or `"majority (2010-2021)"` that aren't in the
ownership enum. This has happened four times in three weeks. The
runner already has a pre-commit gate, but the release agent is the second
layer of defense — pre-merge + nightly deep-audit.

---

## Step 1: Run tests + typecheck

```bash
npx vitest run 2>&1
npx svelte-check --threshold error 2>&1
```

If both green, continue. If either fails, that's a regression — record
the failures in the result JSON and (in daily mode) attempt up to 3
fixes.

## Step 2: Data schema gate (BOTH modes)

This is the most important check for this project. Run the same zod
validator the runner uses at commit time:

```bash
npx tsx scripts/validate-data.mjs 2>&1
```

The validator exits 0 on success ("schema OK — N brands, M firms")
or 1 with a list of `path: message` lines on failure.

On failure:
- Record `{"dataSchema": {"ok": false, "issues": [...]}}` in the result JSON.
- In **hook mode**: do not attempt to fix. Fail fast. The runner's
  own gate should have caught this — the release agent is here for the
  case where a human commit slipped past or the schema itself changed.
- In **daily mode**: attempt a coercion fix. The known-recoverable
  cases are:
  1. `since` or `until` as integer → stringify (`2010` → `"2010"`)
  2. `stake: "self-owned"` → `stake: "majority"` (per CLAUDE.md
     convention: self-owned brands point at a firm with aumVal=0
     and use stake='majority')
  3. `stake: "majority (YYYY-YYYY)"` → `stake: "former"` with
     `until: "YYYY"` appended
  4. `stake: "IP owner" | "licensee" | "trademark holder"` →
     `stake: "post_bankrupt"` (per the Forever 21 precedent on
     2026-04-29)
  Any other invalid stake or unknown shape: report, do not attempt.
  See `docs/tickets/archive/install-guardian-augur-medic.md` for the
  proposed standalone coercion shim that the build agent should build.

## Step 3: Build + adapter-static sanity (daily only)

```bash
npm run build 2>&1
```

The build pre-renders every `/card/<id>/` page from `static/data.json`,
so a build failure usually surfaces a structural data issue the schema
gate missed (e.g. duplicate IDs that pass per-record validation but
break SvelteKit's entries() generator). Record build pass/fail.

## Step 4: Evidence coverage check (daily only)

Every harm tag on a brand or firm MUST have corresponding evidence in
the `why` (brands) or `summary` (firms) field. This is enforced by the
runner prompt but never validated automatically. Run a sampling check:

```bash
python3 scripts/check-evidence-coverage.py 2>&1   # TODO: write this
```

If the script doesn't exist yet, skip this step and note `evidenceCoverage:
"skipped — script not implemented"` in the result JSON. The build agent
should build it (see ticket).

## Step 5: Stale-source audit (daily only)

The runner cites URLs in `why` and `summary` fields. Some of those URLs
4xx/5xx over time. Pull a random sample of 5 entries' source URLs and
HEAD-request them; record any non-2xx responses. Don't fix — just log.

## Project-specific result-JSON fields

In addition to the generic schema, write:

```json
{
  "dataSchema": { "ok": true|false, "issues": ["brands.291.ownership.0.stake: ...", ...] },
  "coercionAttempts": [ { "path": "brands.291.ownership.0.stake", "from": "self-owned", "to": "majority" } ],
  "build": { "ok": true|false, "duration_s": 12.3 },
  "evidenceCoverage": { "checked": 50, "missing": [...] } | "skipped — reason",
  "staleSources": [ { "id": "tesla", "url": "...", "status": 404 } ]
}
```

## Hard prohibitions

- **Never edit `src/lib/schema.ts`.** The schema is the contract.
  If data fails the gate, fix the data (within the coercion rules
  above) — not the schema.
- **Never delete entries from `static/data.json`** even if they're
  broken. Coerce in place or escalate to medic.
- **Never bypass `npx tsx scripts/validate-data.mjs`** — if it
  fails, the commit doesn't happen, period.
