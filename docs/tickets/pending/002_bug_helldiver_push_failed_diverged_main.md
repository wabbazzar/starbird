# 002 — helldiver aborts `push_failed` nightly: local `main` diverged from `origin/main`

- **Created:** 2026-11-06
- **Owner:** build crew (cold agent / `execute-ticket`)
- **Status:** Partial — live Git recovery complete Nov12; generic runner hardening remains pending and needs re-polish against current Shipyard instructions
- **Priority:** P1 (live site has been stale ~3 weeks)
- **Type:** bug
- **Estimated Points:** 8 (4 phases)
- **Refs:** Mentat proposal `mentat:starbird:a0c5e06b` (approved via Daily Dispatch); sibling ticket 001

## Goal
(1) Make the cause of a `push_failed` abort visible in `job.end`. (2) Make the build flow's pre-flight push survive a diverged trunk without silently stalling. (3) Reconcile the currently-diverged `main` (with owner approval). Do **not** touch `static/data.json` content or merge anything to `~/code/shipyard` `main` without a branch.

## Root cause (diagnosed 2026-11-06 while polishing — not a guess)
- Every helldiver run since 2026-10-25 ends `{"event":"job.end","status":"abort","reason":"push_failed"}` in ~1s. Command: `grep -h '"svc":"starbird-helldiver"' $QUARTET_EVENTS_DIR/2026-1*.jsonl | grep job.end` (`QUARTET_EVENTS_DIR=/home/wabbazzar/code/wabbazzar-ice/data/events`). 12 consecutive aborts 10-25 → 11-06.
- The git stderr **is** in `~/code/starbird/tmp/starbird-helldiver-last-run.log` (not in the event): `! [rejected] main -> main (non-fast-forward)`.
- `cd ~/code/starbird && git fetch origin main && git rev-list --left-right --count origin/main...main` → `2 42`: local `main` is **42 ahead / 2 behind**. Merge base `f1c1237` (2026-10-15). The 2 remote-only commits are `d037254` (scribe refresh) + merge `9c93241` (PR #27, `scribe/20261016-060016`, 2026-10-16) — scribe runs `publish = "pr"` (`.agents/config.toml:124`), so its commit goes to a PR branch that GitHub merges, while the same-night refresh also lands on local `main`.
- `git merge-tree --write-tree main origin/main` → **conflict in `CLAUDE.md`** (scribe's count lines edited on both sides). So `git pull` / plain rebase will also stop.
- Defect in the build flow: `~/code/shipyard/agents/build/runner.sh:~195-205`:
  ```bash
  git fetch origin "$TRUNK_BRANCH" --quiet 2>>"$LOG_FILE" || true
  if [ -n "$(git rev-list "origin/$TRUNK_BRANCH..$TRUNK_BRANCH" ...)" ]; then
    git push origin "$TRUNK_BRANCH" >> "$LOG_FILE" 2>&1 || {
      "$LOG_EVENT" "$SVC" job.end mode="$MODE" status="abort" reason="push_failed" || true
      exit 1 ; }
  ```
  It only fast-forward pushes; it never integrates a diverged remote, discards stderr from the event, and `exit 1` fails the unit → medic reads `self_failure` and freezes the incident 24h (cf. ticket-041 note at ~L185: benign skips exit 0).
- **Collateral:** `scripts/starbird-runner.sh:82,337` use `git push >> "$LOG_FILE" 2>&1 || true`, so the nightly runner's pushes have been rejected **silently** since 10-16 (42 local commits incl. data additions never reached `origin`; starbird42.com data is ~3 weeks stale). Fixing that file is **out of scope here** (D3) but the owner must know.
- Medic evidence: frozen incidents `d7a81d08…16b2` (10-28), `e82cdb11…7772` (10-27), `c9db485e…919f` (10-26), reason=self_failure.

## Decisions
| Locked | |
|---|---|
| Location | `~/code/shipyard/agents/build/runner.sh` (branch `fix/helldiver-diverged-push`, git worktree); merge-is-live for the whole fleet, so no direct work on shipyard `main` |
| Never | `git push --force` / `--force-with-lease` to `origin/main`; rewriting published history; editing `static/data.json` content |
| Visibility | stderr tail (≤300 chars, last non-hint lines) added to `job.end` as `detail=` and kept in the log |
| Failure class | diverged-trunk that can't be auto-integrated = benign-skip-style `exit 0` with `reason=push_diverged` **plus one `$QUARTET_NOTIFY_CMD` page per day** (not a unit failure) |

Open with defaults (builder applies, records in Ledger):
- D2: integration strategy when diverged = `git merge --no-edit origin/main` (not rebase: 42 already-local commits, avoids rewriting them); on conflict `git merge --abort` and emit `push_diverged`. Default stands.
- D3: starbird `scripts/starbird-runner.sh` silent `|| true` pushes — **leave untouched**, file a follow-up ticket; mention in Ledger.

**User-decision class (STOP, ask via `AskUserQuestion`; builder assumes "not approved" meanwhile and skips Phase 3 step "reconcile"):**
- **D1:** reconciling live `main` means resolving a `CLAUDE.md` conflict (trivial count lines; default resolution = take the local/newer counts) and then pushing **42 commits** (3 weeks of runner data + scribe) to `origin/main`, which deploys to starbird42.com via GitHub Pages — outward-facing and hard to reverse. Needs owner OK. Note `can_merge = false` (`.agents/config.toml:86`).

## Orchestration protocol
Builder is an orchestrator: delegate marked phases, keep context lean, re-verify gates personally. Verbatim brief for every subagent:
> Converge honestly or report the precise blocker with the actual evidence — NEVER fake green, weaken a check, or hand-wave "should work". Run the real command, read the real file, curl the real port, and report exact output (exit codes, JSONL lines, HTTP codes), not adjectives.

Gates (from `.agents/gates.md`): Shell scripts (`bash -n` + real run), Event stream (read the actual JSONL line), Sibling repo (shipyard branch, `bash agents/design/runner.sh --self-test` untouched-still-green; medic `--self-test` too), systemd (`systemctl --user start starbird-helldiver.service` once, never wait for OnCalendar). `shellcheck` is not installed — `bash -n` only. Traps: `starbird-runner.sh` hard-codes paths (don't run it from a worktree). Never run the build against the live starbird checkout for tests — use a throwaway clone (below).

## Phase 0 — Reproduce in a sandbox (1 pt)
Create throwaway origin/clone (`mktemp -d`; bare origin, clone A "live", clone B pushes a conflicting commit to `main` on a file A also edits; A has 2 local commits). Confirm `git push origin main` from A fails non-fast-forward, and a plain `git merge origin/main` conflicts. This becomes the fixture for Phase 2.
Delegation: subagent — builds the fixture script under `~/code/shipyard/agents/build/tests/` (or the repo's existing test dir — find it) returning: path, command, exact rejection text. + anti-cheating brief.
DoD: script exits 0 only when it observes the rejection; output pasted in Ledger.

## Phase 1 — Surface the cause in `job.end` (2 pts)
Capture push stderr to a variable (`tee` to `$LOG_FILE`), and add `detail="<tail>"` to the `push_failed` `job.end` call. Must stay one-line-safe for JSONL (strip newlines/quotes; check how `log_event.sh` encodes `k=v`).
Delegation: inline (≈10-line change in one already-read file; orchestrator must read the event line).
Gate: `bash -n`; run the Phase 0 fixture against the patched runner; read the emitted JSONL line from a temp `QUARTET_EVENTS_DIR`: `reason":"push_failed"` and `detail` contains `non-fast-forward`. Must FAIL against the unpatched file (prove by `git stash`).
DoD: that JSONL line pasted in Ledger.

## Phase 2 — Integrate-or-skip instead of abort (3 pts)
Before the push: if `origin/$TRUNK` has commits not in `$TRUNK` (`rev-list`), try `git merge --no-edit origin/$TRUNK`; on success push; on conflict `git merge --abort`, log, emit `job.end status=abort reason=push_diverged detail=…`, notify once/day (use `$QUARTET_NOTIFY_CMD`, dedupe by a date-stamped marker file), and `exit 0`. Clean working-tree and not-on-trunk guards above this block stay as is.
Delegation: subagent — implements in the shipyard worktree + extends the Phase 0 fixture with two cases (clean divergence → merged + pushed to the fixture origin; conflicting divergence → exit 0, `push_diverged` line, tree clean, no merge in progress). Returns ≤40 lines: files, commands+exit codes, JSONL lines, blockers. + anti-cheating brief.
Gate: `bash -n`; fixture both cases green; sabotage (restore old block) → fixture FAIL; shipyard other self-tests still green; stub `QUARTET_NOTIFY_CMD` (do not page the owner).
DoD: Ledger holds the two JSONL lines and the sabotage FAIL.

## Phase 3 — Live verification + reconcile (2 pts) — reconcile part requires D1
a) Merge shipyard branch per shipyard flow only after Phases 0-2 are green (rollback: `git revert <merge-sha>` on shipyard main). 
b) `systemctl --user start starbird-helldiver.service`; read `$QUARTET_EVENTS_DIR/$(date +%F).jsonl`: with the repo still diverged the line must now be `reason=push_diverged` with `detail`, unit result **not** `failed`, no `self_failure` incident on the next medic scan.
c) **Only if D1 approved:** in `~/code/starbird`: `git merge origin/main`, resolve `CLAUDE.md` (take local counts), commit, run gates (`npx tsx scripts/validate-data.mjs`, `npx tsx scripts/dq-check.mjs`, `npm run build`), `git push origin main`; confirm `git rev-list --left-right --count origin/main...main` = `0 0`, a GitHub Pages run succeeds (`gh run list -L 3`; on a flaky deploy `gh run rerun` per memory `gh-pages-deploy-flake`), `curl` `https://starbird42.com/data.json` brand count equals local `static/data.json`.
Delegation: inline (live-state gates the orchestrator must read; D1 is an owner call).
DoD: (b) JSONL line; (c) the `0 0` count + Pages run conclusion `success` + matching counts, or "D1 not approved — skipped" in Ledger.

## Testing Strategy
Fixture-based shell tests (Phase 0/2), sabotage proof, live unit run (Phase 3). Starbird app suites unaffected.

## Acceptance Criteria
- [ ] `push_failed`/`push_diverged` `job.end` lines carry `detail=` with the git stderr tail.
- [ ] Diverged-clean fixture: runner merges and pushes; diverged-conflict fixture: exit 0, `push_diverged`, no merge left in progress.
- [ ] Sabotage of the fix makes the fixture FAIL.
- [ ] Live `starbird-helldiver.service` run no longer exits non-zero on divergence; next medic scan opens no `self_failure` incident.
- [ ] No force-push anywhere; no `static/data.json` content changes by this ticket; shipyard `main` changed only via reviewed branch merge.
- [ ] If D1 approved: `origin/main...main` = `0 0` and site data matches; else the Ledger states it was left pending.
- [ ] Both repos clean, worktrees/fixture dirs removed, no stray processes.

## Risks & Mitigations
- Auto-merge of trunk by an unattended agent → only clean merges, `merge --abort` on any conflict, no force.
- Fleet-live shipyard change → branch + fixtures + revert command.
- Publishing 42 commits at once → D1 gate; they are commits the nightly runner already made and validated.
- Notification spam → once-per-day marker, stubbed in tests.

## Out of scope
Runner data, `static/data.json`, `scripts/starbird-runner.sh` silent pushes (follow-up), scribe PR-mode design (follow-up: why its refresh lands on both the PR branch and local `main`), medic escalation policy, GitHub-SSH noise in other projects.

## Ledger
(builder appends per phase: plan, commit hash, `builder: subagent (N agents)` / `builder: inline (<reason>)`, deferred notes)

Run with `execute-ticket` on this file — it will stop at D1 for an owner answer.


### 2026-11-12 owner-requested operational recovery (D1 completed)
Owner directly requested fixing the recurring Suk self_failure. Reconciled both histories with merge c4a73b6 and normal push; no force/reset and no data/source edits. Remote-only documentation count changes were older; retained newer local CLAUDE.md. `git diff 3303525 c4a73b6 --exit-code` returned0: merge tree identical to pre-recovery local tree. Queued local count had grown to55; origin/main...main now0 0.

Verified51 Vitest tests, schema (566 firms/800 brands), data-quality/evidence/score audits, svelte-check0 errors (9 pre-existing warnings), production build. Real starbird-helldiver run Nov13 00:03:46Z emitted job.end00:03:57Z status=ok exit_code=0; unit Result=success/ExecMainStatus=0. This completes the live reconciliation portion/D1; do not repeat it or ask for that already-completed repair.

The generic integrate-or-skip source change and new generic regression fixtures are NOT shipped. Shipyard currently has unrelated uncommitted mentat-proposal/medic edits and its current CLAUDE.md requires main-only work/no branches or worktrees, contradicting this older ticket's branch assumptions. Re-polish remaining phases against current instructions and coordinate a clean source checkout before building. Keep this ticket pending; the operational incident was recovered separately in the hub ticket starbird-helldiver-git-recovery.md.
