# Build — starbird project block

This file is concatenated AFTER `agents/build/role.md` (live/dry-run
mode) or `agents/build/incident-role.md` (incident mode). The role
files cover generic protocol (worktree discipline, PR rules,
result-JSON schema). Below is starbird-specific: feedback sources,
triage criteria, and the dominant fixable failure mode.

The reviewer name on PRs is `wabbazzar`. The owner field in the
project config (`config.toml`) carries this.

---

## Dominant failure mode you exist to fix

Four times in three weeks the runner (Claude Sonnet, scripted via
`scripts/starbird-runner.sh` daily at 07:05) has produced
`static/data.json` updates with the same class of schema violation:

| Date       | Shape error                                                    |
|------------|----------------------------------------------------------------|
| 2026-04-25 | `since: 2010` (int) + `stake: "majority (2010-2021)"`          |
| 2026-04-29 | `stake: "IP owner"`                                             |
| 2026-05-10 | `since: 2010` (int) on 3 brands                                 |
| 2026-05-18 | `since: 2016` (int) + `stake: "self-owned"`                     |

The pattern is clear: Sonnet improvises shapes that aren't in the
zod schema (`OwnershipSchema` in `src/lib/schema.ts`) despite the
explicit enum + type rules in `scripts/starbird-runner-prompt.md`.

The pre-commit gate (added 2026-05-10) catches these before they
reach main, so the site never breaks — but the runner gets stuck:
the entry is rejected, no commit happens, the same strategy
gets re-picked tomorrow and may reproduce the same shape error.
A human has to manually salvage the run each time.

**The high-leverage fix you should build:**
`scripts/coerce-data-shapes.mjs` — runs between Claude's edit pass
and `scripts/validate-data.mjs` in the runner pipeline. Mechanically
normalizes the known-recoverable shape errors:

1. Integer `since` / `until` → stringified
2. `stake: "self-owned"` → `stake: "majority"` (per CLAUDE.md)
3. `stake: "majority (YYYY-YYYY)"` → `stake: "former"` + `until: "YYYY"`
4. `stake: "IP owner" | "licensee" | "trademark holder"` →
   `stake: "post_bankrupt"`

The Python sweep in `tmp/elon-audit.py` and the hotfix commits
`de6d777`, `8b69ec6`, `577bc80`, `f8df056` are the reference
implementations — each one fixes the same recurring shapes.

After coercion runs, the schema gate runs unchanged; if any
non-recoverable error remains, the runner fails as before.

Wire-up: add one line to `scripts/starbird-runner.sh` between the
Claude invocation and the validator call:

```bash
npx tsx "$STARBIRD_DIR/scripts/coerce-data-shapes.mjs" >> "$LOG_FILE" 2>&1
```

## Feedback sources for triage

Starbird is one-actor (wabbazzar) and has no in-app chat surface,
so most triage signals come from:

1. **Failed runner jobs** — `tmp/starbird-runner-last-run.log` tail
   shows the gate-failure mode. Medic surfaces these.
2. **Live-site probe** — `medic.probes.starbird-live-data` fires
   when the deployed `data.json` fails schema parsing. If the
   pre-commit gate is working this should never fire; if it
   does, that's a higher-severity incident (gate bypassed).
3. **GitHub Actions deploy failures** — adapter-static prerender
   blowing up on a duplicate ID or missing reference.
4. **Direct user reports** — wabbazzar pasting an error message
   into a session.

## In-scope vs forbidden

The config.toml `in_scope_paths` and `forbidden_paths` are the source
of truth. Highlights worth restating:

**In scope:**
- `scripts/starbird-runner-prompt.md` — tighten the prompt rules
- `scripts/starbird-runner.sh` — wire up the coercion shim
- `scripts/coerce-data-shapes.mjs` — build this, it doesn't exist yet
- `src/lib/components/**`, `src/routes/**`, `src/lib/**` (UI bugs)
- `tests/**` — pin every fix with a failing test first

**Forbidden:**
- `src/lib/schema.ts` — the schema is the contract; if data fails
  it, fix the data-producer (the runner), not the schema
- `static/data.json` — only the runner or a human writes data;
  the build agent fixes the runner or the coercion shim, never the
  data directly
- `.agents/**` — you do not get to redefine your own role
- `.github/workflows/**` — deploy pipeline is human-only

## Project conventions worth knowing

- Self-owned brands (Palantir, Tesla, SpaceX) use `stake: "majority"`
  pointed at a firm with `aumVal: 0`. PE-owned brands use the same
  stake but the firm has `aumVal > 0`. The 5-point inheritance
  discount in `src/routes/+page.svelte` keys off this.
- Every harm tag MUST have evidence in `why`/`summary`. The runner
  prompt enforces this; if you're touching either, preserve the
  invariant.
- Date sort (added 2026-05-05) keys off `addedAt`. If you update an
  existing entry, bump `addedAt` to today so it surfaces.
- Schema validation: `npx tsx scripts/validate-data.mjs` is the gate.
  Don't ship a runner-pipeline change without re-running it.

## Red-flag self-checks before opening a PR

- Did your change touch `src/lib/schema.ts`? → ABORT. Forbidden.
- Did your change touch `static/data.json` directly? → ABORT
  unless you're encoding a hotfix the human explicitly asked for
  via incident mode; even then prefer the coercion shim.
- Did you skip writing a test? → write one. Every fixable bug
  should pin its repro with a vitest case.
- Is your PR description copy-pasted from the incident? → rewrite
  it to explain the fix in the project owner's vocabulary.
