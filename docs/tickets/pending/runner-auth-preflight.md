# Ticket: Runner pre-flight auth check — fail fast on expired OAuth session

**Created:** 2026-10-01
**Owner:** Wesley
**Assignee:** Claude (execute-ticket)
**Status:** Polished 2026-10-01 — not started
**Refs:** mentat item `mentat:starbird:2562d764` (approved via Daily Dispatch)

---

## Goal

`scripts/starbird-runner.sh` must detect an expired/invalid `claude` OAuth
session **before** the paid research loop, emit a distinct `job.end`
`reason=auth_expired`, page the owner immediately through the notify path,
and exit without retrying.

## Context (verified 2026-10-01)

- Retry loop: `scripts/starbird-runner.sh:162-187`, `MAX_RETRIES=2` → 3 paid
  attempts, `sleep 15` between. It treats every non-zero exit as transient, so
  an auth failure is retried identically. Budget flag: `--max-budget-usd "$BUDGET"`
  (daily floor $4.00).
- Binary resolution ends at `starbird-runner.sh:141` (`CLAUDE_BIN`, overridable
  by env `CLAUDE_BIN=...`). The preflight goes **after** that line and **before**
  the `BUDGET_BASE` block (~line 144).
- `fatal()` (`:35-46`) already emits `job.end status=fail reason="$where"` + notify,
  but its reason is free-form `line N`/`where`, its notify title is the generic
  "Starbird Runner FAILED", and it is not auth-specific. Do not overload it; add a
  sibling function.
- Notify path: the script hard-codes `NOTIFY=/home/wabbazzar/code/wabbazzar-ice/scripts/notify.sh`
  (`:19`). The shared wrapper `wabbazzar-ice/scripts/cron-run.sh:41` uses
  `${QUARTET_NOTIFY_CMD:-$REPO_DIR/scripts/notify.sh}`. `QUARTET_NOTIFY_CMD` was
  **empty in an interactive shell on 2026-10-01** (`echo $QUARTET_NOTIFY_CMD`); it
  is baked into units at install. The preflight page must therefore use
  `${QUARTET_NOTIFY_CMD:-$NOTIFY}`.
- Event logger: `wabbazzar-ice/scripts/log_event.sh <svc> <event> k=v…`
  (`$LOG_EVENT` in the script). Note the filename is `log_event.sh` (underscore).
- Probe facts measured 2026-10-01:
  - `claude auth status` exists (`--json` default, `--text`), exits fast, costs $0.
    It returned `{"loggedIn": true, "authMethod": "claude.ai", …}`. **Unknown:**
    whether it reports `loggedIn:false` for an *expired-but-present* token (it may
    only read local creds). Builder must find out (Phase 1) — do not assume.
  - `claude -p "ok" --max-turns 1 --output-format json` succeeded, ~2.8 s,
    `total_cost_usd` **0.1946** (dominated by cache creation of the system prompt).
    So a live probe is not free: ~$0.20/run ≈ 5% of the $4 daily budget.
- Existing test style: `tests/unit/runner-gitignore-guard.test.ts` (vitest,
  greps script source). Run with `npx vitest run`. `bats` and `shellcheck`:
  `bats` present at `/usr/bin/bats`; `shellcheck` not found on PATH (2026-10-01) —
  do not rely on it.
- No `.agents/specialists/` manifests and no `[memory]` table in
  `.agents/config.toml` → no specialist routing, no planning-memory query.
  `autonomous` is not set.

## Non-goals / hard boundaries

- **No token auto-refresh** (not available).
- **Do not touch medic/suk role files** (anything under `~/code/shipyard/agents/medic/`,
  `starbird-suk.*`, `.agents/medic*`).
- No change to `~/code/shipyard` or `~/code/wabbazzar-ice` (merge-is-live repos).
- Do not change `MAX_RETRIES` or the in-loop retry behavior for transient errors.
- Do not edit `src/lib/*.ts` or Svelte files.

## Decisions

### Locked

| # | Decision |
|---|---|
| L1 | Preflight runs in **both** `daily` and `dry-run` modes (an expired session breaks both). |
| L2 | On auth failure: no retry, no research loop, no commit/push; `exit 2`. |
| L3 | `job.end` fields: `status=fail exit_code=2 reason=auth_expired duration_s=…`. Exactly one `job.end` per run (the existing end-of-script `job.end` at `:382` must not also fire). |
| L4 | Page via `${QUARTET_NOTIFY_CMD:-$NOTIFY}` only — no direct curl. Title `Starbird Runner AUTH EXPIRED — $MODE`; body states the remedy (`run \`claude\` interactively on wabbazzar-ice and /login`) plus the last 5 log lines. |
| L5 | **Fail open on non-auth failure.** Only a failure matching an auth signature becomes `auth_expired`. Network/5xx/rate-limit/unknown probe failures log a WARN and fall through to the existing retry loop, so a transient blip never blocks the nightly run. |
| L6 | Probe logic lives in a sourced file `scripts/lib/claude-preflight.sh` (function `claude_preflight_auth`), so it is testable without running the whole runner (which commits and pushes). |

### Open, with defaults (builder applies, records in Ledger, proceeds)

| # | Question | Default |
|---|---|---|
| O1 | Probe composition | Layered: (1) `"$CLAUDE_BIN" auth status` — if it reports not logged in → `auth_expired`; (2) a live no-op `"$CLAUDE_BIN" -p "ok" --model "$MODEL" --max-turns 1 --output-format json` with `timeout 60`. If Phase 1 shows layer (1) alone detects an expired token, **drop layer (2)** and the cost is $0. |
| O2 | Auth-signature match | Derive from the real failure captured in Phase 1 (see below); default regex until then: `(?i)(401|unauthorized|authentication|oauth|token.*(expired|invalid)|not logged in|please run /login|invalid api key)` applied to probe stdout+stderr. |
| O3 | Probe timeout | `timeout 60`; a timeout is non-auth (L5, fall through). |

### User-decision class — surfaced, with the assumption used meanwhile

- **Spend:** if layer (2) must stay, the live probe adds ≈ $0.20 per run. The
  dispatch proposal asked for "a lightweight no-op call", so this ticket treats
  that as approved; it is recorded here so it is not a surprise. Phase 1's
  free-check-first design minimizes it. No other blocking decisions.

## Orchestration protocol

The builder is an orchestrator: delegate by default, keep its own context lean,
re-verify personally every gate. Every subagent brief ends with this clause:

> Converge honestly or report the precise blocker with the actual evidence —
> NEVER fake green, weaken a check, or hand-wave "should work". Run the real
> command, read the real file, curl the real port, and report exact output
> (exit codes, JSONL lines, HTTP codes), not adjectives.

No `.agents/build.md` specialist table is relied on; briefs below are generic.

## Phases

Each phase = one clean commit; the live nightly runner is never left broken
(the 05:00 timer must find a working script at every commit). Worktree clean
after each commit.

### Phase 1 — Capture the real failure signature (no repo changes)

Delegation: **subagent**. Brief: *Inputs:* none beyond this ticket. *Task:*
produce an unauthenticated/invalid-token `claude` failure safely and record
exact output. Run, each with exit code and full stdout/stderr:
1. `HOME=$(mktemp -d) claude auth status`
2. `HOME=$(mktemp -d) claude -p "ok" --max-turns 1 --output-format json`
3. `CLAUDE_CODE_OAUTH_TOKEN=invalid-token claude auth status` and the same with `-p`.
4. For comparison, the same two commands with the real session (success shape).
Confirm whether `auth status` reports not-logged-in (exit code and JSON) in cases
1 and 3. Never read or print `~/.claude/.credentials.json`; never touch the real
credentials; delete the temp HOME afterward. *Files owned:* none (write nothing
to the repo). *Return (≤40 lines):* commands + exit codes; the verbatim failure
text; whether layer (1) alone suffices; measured `total_cost_usd` of a successful
probe. Append the anti-cheating clause.

Observable DoD: the Ledger holds the verbatim signature(s) and the O1/O2
resolutions. If no safe way to reproduce an auth failure exists, record that and
keep the O2 default regex, flagged "unverified against a real expiry".

### Phase 2 — Preflight function + unit tests

Delegation: **subagent** (single new file + tests). Brief: *Task:* create
`scripts/lib/claude-preflight.sh` defining `claude_preflight_auth` that returns
0 (ok), 10 (auth failure), 0 with a logged WARN (non-auth failure, per L5). It
takes `CLAUDE_BIN`, `MODEL`, and writes the probe output to a path given by
`$PREFLIGHT_OUT`. Probe layers per O1/O2/O3. Add tests with a **stub
`CLAUDE_BIN`** (a temp executable script printing canned output / exit codes):
(a) stub emits the Phase-1 auth failure → returns 10; (b) stub emits a
network-timeout / 529 style error → returns 0 and logs WARN; (c) stub succeeds →
returns 0; (d) stub hangs → bounded by `timeout`, returns 0. Put them in
`tests/unit/runner-auth-preflight.bats` (bats exists) **or** a vitest file that
`spawnSync`s `bash -c 'source … && claude_preflight_auth'` — pick whichever runs
under the project's standard gate (`npx vitest run`) if bats is not wired in.
*Return shape:* ≤40 lines — files, commands + exit codes, test counts, blockers.
Append the anti-cheating clause.

Gates: `bash -n scripts/lib/claude-preflight.sh`; `npx vitest run` (full suite
green); the failing-case test (a) **must fail** when the function's auth-match
is deliberately broken (mutate, run, see red, restore, see green — record it).
Observable DoD: new tests green; mutation check recorded; runner itself
untouched in this commit.

### Phase 3 — Wire into `starbird-runner.sh`

Delegation: **inline** (≈25-line edit in an already-read file; the orchestrator
must read the gate output itself). Edits:
- `source "$STARBIRD_DIR/scripts/lib/claude-preflight.sh"` after `CLAUDE_BIN`
  resolution (`:141`).
- Add `auth_expired()` beside `fatal()`: `trap - ERR`; log; `job.end
  status=fail exit_code=2 reason=auth_expired duration_s=…`; page via
  `${QUARTET_NOTIFY_CMD:-$NOTIFY}` (L4); `exit 2`.
- Call `claude_preflight_auth || auth_expired` before the `BUDGET_BASE` block,
  guarded so `set -e` / the ERR trap do not route it through `fatal` (use an
  explicit `if ! …; then auth_expired; fi`).
- Add a source-grep guard test in the style of `runner-gitignore-guard.test.ts`
  (phrases that fit on one source line): preflight call appears **before** the
  `while [ "$RETRY"` loop; `reason=auth_expired` present; the page uses
  `QUARTET_NOTIFY_CMD`. Show this guard **passing on the new file and failing on
  the pre-change file** (`git stash`/`git show HEAD:scripts/starbird-runner.sh`).

Gates: `bash -n scripts/starbird-runner.sh`; `npx vitest run`;
`npx svelte-check --threshold error`. Observable DoD: guard test green, and red
against `HEAD~1`'s script.

### Phase 4 — End-to-end proof (real script, simulated expiry)

Delegation: **inline** (the orchestrator must read the event line itself).
Run the real script in dry-run with a stub that fails like an expired session
and a **stubbed notifier** (do not page the owner from a loop; say so in the
Ledger):
```bash
export QUARTET_NOTIFY_CMD=/tmp/fake-notify.sh   # writes "$@" to /tmp/notify.out
CLAUDE_BIN=/tmp/stub-claude-expired.sh bash scripts/starbird-runner.sh dry-run; echo "exit=$?"
tail -n 3 "$QUARTET_EVENTS_DIR/$(date +%F).jsonl"    # set QUARTET_EVENTS_DIR to the real dir
cat /tmp/notify.out
```
Required observations: `exit=2`; exactly one `job.end` line with
`reason=auth_expired`; `/tmp/notify.out` has the AUTH EXPIRED title; the claude
stub was invoked **only by the preflight** (count its invocations — it must not
see the `--dangerously-skip-permissions` research call, and `tmp/starbird-runner-claude-output.json`
must not exist); `git status` shows no data/commit changes. Then the control:
`CLAUDE_BIN=/tmp/stub-claude-ok.sh` proceeds past preflight into Step 5
(observe the stub receiving the research invocation, then stop it) — proving the
check does not false-positive. Finally one real, un-stubbed
`bash scripts/starbird-runner.sh dry-run` is **optional** and costs up to the
dry-run budget; skip unless the user wants it.

Observable DoD: the above lines pasted in the Ledger; temp files removed.

### Phase 5 — Full gate, docs, roll-up

Delegation: **inline**. Run `npx vitest run`, `npx svelte-check --threshold error`,
`npx tsx scripts/dq-check.mjs`, `python3 scripts/verify-harm-score.py`,
`bash -n` on every touched script. Add one line to `CLAUDE.md` (Runner section)
and a Traps entry in `.agents/gates.md`: "runner now pre-flights auth; a missing
`QUARTET_NOTIFY_CMD` in the unit env falls back to `wabbazzar-ice/scripts/notify.sh`."
Confirm `systemctl --user list-timers | grep starbird` unchanged (no unit edits
are expected; if the unit env must change to bake `QUARTET_NOTIFY_CMD`, that is a
separate live-system change — stop and report instead of editing units).
Pre-existing uncommitted changes in the worktree (as of 2026-10-01: `.agents/gates.md`,
several `src/lib/*`, scripts — from the harm-score work) are **not** this
ticket's; stage only this ticket's files (`git add <paths>`, never `-A`).

## Verification traps pinned for this ticket

- A grep-style guard must match a phrase within one source line (hard-wrapped prose).
- A guard must be shown passing post-change **and failing pre-change** (Phase 3).
- The ERR trap fires under `set -E` — the preflight must not let a probe's non-zero
  exit trip `fatal` ("line N"); wrap in `if`, or `set +e` locally (see the comment
  at `:47-52`).
- Probe output can contain request IDs; log only the matched line, not full JSON.
- No background process is started; if any is, verify with `ps` it is gone.

## Ledger

- **Phase 1** — builder: subagent (1 agent). No commit (no repo changes). Captured 2026-10-10:
  - `HOME=<empty> claude auth status` → exit 1, `loggedIn:false`.
  - `HOME=<empty> claude -p ok` → exit 1, `is_error:true`, result `Not logged in · Please run /login`, cost 0.
  - `CLAUDE_CODE_OAUTH_TOKEN=invalid-token claude auth status` → exit 0, `loggedIn:true` (presence only).
  - Same token with `-p` → exit 1, `api_error_status:401`, `Failed to authenticate. API Error: 401 Invalid bearer token`, cost 0.
  - **O1 resolved:** layer 1 alone is NOT sufficient (misses invalid tokens); keep the live `-p` probe. A failed probe costs $0; only a successful one costs ~$0.19.
  - **O2 resolved:** `Not logged in|Please run /login|Failed to authenticate|API Error: 401|Invalid bearer token|"api_error_status":401`. Do not match bare `401`/`oauth`. Expired-but-present token **unverified against a real expiry** (could not reproduce safely).
  - Worktree: `.worktrees/auth-preflight` on branch `ticket/runner-auth-preflight` (main tree is dirty with unrelated work; user chose isolated worktree).

_(builder appends per phase: plan, commit hash, `builder: subagent (N agents)` /
`builder: inline (<reason>)`, deferrals, and the Phase-1 captured signatures.)_
- **Phase 2** — builder: subagent (1 agent). `scripts/lib/claude-preflight.sh` + `tests/unit/runner-auth-preflight.test.ts` (6 cases a–f). `bash -n` ok; `npx vitest run` 4 files / 29 tests green (re-run by orchestrator). Mutation check (auth regex → `ZZZNEVERMATCH`) turned (a) and (f) red, restored → green. Added `PREFLIGHT_TIMEOUT_S` override (default 60; layer 1 uses min(20, it)).

## Definition of Done (roll-up)

- Expired/invalid session → preflight returns before the research loop; one
  `job.end reason=auth_expired exit_code=2`; one page through the notify path;
  zero research-loop invocations (Phase 4 evidence).
- Healthy session and transient probe errors still reach the existing loop.
- All phases committed, worktree clean of this ticket's changes, all gates green,
  no medic/suk files touched.

Run with `execute-ticket docs/tickets/pending/runner-auth-preflight.md`.
