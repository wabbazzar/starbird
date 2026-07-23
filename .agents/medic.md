# Medic — starbird project notes

This file is concatenated AFTER `agents/medic/role.md`. The role.md has the
generic detect/classify/act protocol and the result-JSON schema. Everything
below is starbird-specific judgment that the role can't have.

## Surfaces this project actually has

- **Runners** (always present): `starbird-runner.{service,timer}` (07:05
  daily research pass), `starbird-proctor.{service,timer}` (daily
  deep audit), plus any `starbird-*` entries in `ops.json`. Failed or
  stale units are yours to triage.
- **Chats** — NONE. Starbird has no in-app chat surface. The chat-source
  classification logic in role.md §3 does not apply here; just skip it.
- **Probes** (declared in config.toml): `starbird-live-data` HEAD-fetches
  `https://wabbazzar.com/starbird/data.json` and pipes the body through
  `scripts/validate-data.mjs`. Fires when the live site is serving
  zod-invalid JSON.

## Project-specific classification cues

### Runner schema-gate failures — REGRESSION, escalate to build

The dominant failure mode. Signature in
`tmp/starbird-runner-last-run.log`:

```
[starbird-runner] validating data.json against schema…
schema FAILED — N issue(s):
  - brands.291.ownership.0.stake: Invalid option: ...
  - brands.291.ownership.0.since: Invalid input: expected string, received number
  ...
[starbird-runner] FATAL: schema validation failed — refusing to commit
```

Classify as **regression** with `route = "scripts/coerce-data-shapes.mjs"`.
The build agent is in scope to build the coercion shim (see
`.agents/build.md` "Dominant failure mode"). If the shim already
exists and is being bypassed, that's an upgrade to **forbidden**
(someone disabled the gate) — notify hard, do not escalate to build.

After two consecutive schema-gate failures within 48 hours on the
same shape (e.g. integer-since on two different runs), treat as
**high-priority regression** — with token caps there is no per-incident
budget to bump; flag the recurrence prominently in the escalation so
the build agent prioritizes it.

### Runner "API Error: 400 due to tool use concurrency issues" — INFRA / transient

The 2026-04-30 incident pinned the runner's claude binary to 2.1.122
because 2.1.123 had a tool-use serialization regression. If you see
this error again with the pinned binary, it means either:

1. Anthropic shipped a backend change (transient, retry tomorrow)
2. The pin got reverted (check `scripts/starbird-runner.sh` for the
   CLAUDE_BIN var — if it's gone, that's the cause)

Classify as **infra** for case 1, **regression** for case 2. The pin
should remain until a known-good newer version is verified manually.

### Live-data probe failure — INFRA (severe) or REGRESSION

If `starbird-live-data` fires, the deployed site is broken for users.
That's higher severity than a runner-failure because:

- Runner failures stay in the working tree and don't affect users.
- Live-data failures mean the pre-commit gate was bypassed somehow.

Classify as **regression** and escalate to build with the failing
record IDs in the hypothesis. If the build itself is failing on
GitHub Pages, that's **infra** and notify-hard — the build agent cannot
fix GitHub Actions per `forbidden_paths`.

### GitHub Pages deploy failure — INFRA

`gh run list` shows failure on the `Deploy Starbird to GitHub Pages`
workflow. Almost always caused by:
1. `static/data.json` schema break that the runner gate missed
   (handle as regression above)
2. SvelteKit prerender hash-anchor check (covered by the
   `handleMissingId: 'ignore'` config; if it regresses, that's
   forbidden_paths territory — `svelte.config.js` is human-edited)

Classify as **infra** with notify-only unless the cause is the
prerender check, which is **regression** routed at `svelte.config.js`.

### Build-time data corruption — REGRESSION

If `npm run build` fails with a duplicate-id error or missing
firmId reference, but `scripts/validate-data.mjs` passes — that's
a gap in the schema: zod's per-record `superRefine` should be
catching duplicates but might be missing a case. The build agent is in scope:
tighten `src/lib/schema.ts`'s cross-reference checks (this is the
ONE legitimate reason to edit schema.ts; ratify with the human first
via PR review).

## Hypothesis-writing tips for this codebase

- Always include the failing IDs (e.g. `brands[291] byheart`,
  `brands[293] spring_mulberry`) — the build agent uses these to locate the
  exact records in `static/data.json`.
- Reference the prior hotfix commit shas (`de6d777`, `8b69ec6`,
  `577bc80`, `f8df056`) when classifying recurring schema breaks —
  pattern recognition helps the build agent scope the fix.
- Mention whether the build pipeline ALSO failed (gh runs) or just
  the local gate. A green build with a red gate means the gate is
  doing its job and the failure is contained.

## Not your problem

- The data CONTENT (whether a particular brand's harms tags are
  accurate, whether the why text is well-sourced) — that's the
  runner's job and the human's editorial role. You only triage
  shape/structure failures.
- The runner's strategy scoring (`scripts/update-strategy-scores.py`).
- UI bugs — those route to build via the standard triage flow if
  the human reports them; not your monitoring scope.
