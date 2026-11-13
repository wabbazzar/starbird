# 002 — keep Helldiver healthy when trunk history diverges

**Created:** 2026-11-06 · **Updated:** 2026-11-12 · **Owner:** Wesley
**Status:** Executing · **Priority:** P1 · **Type:** bug · **Estimated Points:** 5 remaining
**Target:** shared Shipyard build runner plus Starbird opt-in configuration
**Refs:** approved mentat:starbird:a0c5e06b; owner direct request “Execute the ticket”; hub complete/starbird-helldiver-git-recovery.md

## Goal and current state
Prevent a future divergence from repeatedly failing Helldiver and causing Suk self_failure alerts. Capture useful bounded git diagnostics. Preserve existing behavior globally until a project explicitly enables safe reconciliation.

The operational recovery is DONE: merge c4a73b6 preserved both histories and exactly the local source/data tree, normal push synchronized Starbird,51 tests/data/type/build gates passed, real Helldiver job.end at Nov13 00:03:57Z status=ok exit_code=0, Pages run43333997099 succeeded and live data byte-matched566 firms/800 brands. Ticket ledger update661297b also deployed successfully. Do not repeat that merge or ask for its already-completed approval.

## Reproduction / root / missing coverage
Pre-recovery build log: “pushing local main ahead-of-origin commits”, push rejected main -> main (non-fast-forward), exit1 in one second. Refreshed origin/main...main was2 55. `agents/build/runner.sh` around198-204 fetched with ignored errors, checked only local-ahead commits, pushed even when remote also ahead, emitted abort/push_failed then exited1. A two-clone local bare remote reproduces this without network/model calls. Remote-only commits were a documentation PR merged on GitHub; local daily research and docs accumulated after it. Existing preflight tests cover dirty/off-trunk but not real diverged histories. Regression tests must pin data/history preservation, actionable conflict skip, and unchanged default-off behavior.

## Decisions (all locked; no open owner decision)
- D1 live reconciliation completed above. Current execution request authorizes the remaining ticket, its Starbird opt-in and standard publish/deploy steps.
- `[build] reconcile_trunk` is a strict boolean, default false. False/unset keeps the original Git preflight behavior. Only Starbird opts into true here; other fleet configs untouched. This satisfies the actual shared repo’s additive safety gate, replacing the older ticket’s unconditional auto-merge plan.
- True: successful fresh fetch required; behind-only uses ff-only; divergent history uses a normal merge, preserving both sides. Then normal push only. Never force, rebase, reset or stash caller changes.
- On merge conflict: abort the merge, keep original clean HEAD, emit one job.end status=abort reason=push_diverged with bounded detail, notify owner at most once per UTCday/project, exit0 before model work. Conflict is an actionable skipped run, not a failed systemd unit.
- Actual fetch/push errors remain nonzero and emit accurate bounded detail. JSON quoting must preserve arbitrary quotes/control cleanup. No weakening CI, caps, or recursion guard.
- Recheck branch/HEAD/clean state after fetch before mutation; if concurrent work appeared, skip safely without overwriting it. A remote push race remains a normal rejected push with diagnostics.
- Shipyard’s current CLAUDE.md supersedes old ticket branch/worktree wording: work on canonical main, no branches/worktrees. Its explicit concurrency rule permits unrelated existing edits with scoped staging. Preserve the initial unrelated medic/mentat files byte-for-byte; their hashes are in `/tmp/shipyard-002-unrelated-hashes.json`. Own only build runner/new helper/tests and docs specified below. No staging another task’s files. Remaining unrelated dirty state is reported honestly, not discarded to fake cleanliness.
- All notifications via configured script/wrapper; fixtures stub notification sinks. UTC event day, never local date. No iCloud changes.

## Phase A — fixture, diagnostic visibility and opt-in reconciliation (5points)
Delegation: subagent — own shared agents/build/runner.sh, optional narrowly scoped new helper, tests/build-trunk-reconcile.bats. Read current helpers/build-benign-abort conventions. Return at most40 lines: files, exact commands+exit codes, red/green evidence and blockers. A second subagent owns README, docs/INSTALL.md, docs/deck-editorial.json and regenerated docs/shipyard-data.json only.

Converge honestly or report the precise blocker with the actual evidence — NEVER fake green, weaken a check, or hand-wave “should work”. Run the real command, read the real file, curl the real port, and report exact output (exit codes, JSONL lines, HTTP codes), not adjectives.

Fixture topology: real local bare origin, two clones with isolated config/user identity, no network/GitHub/model. Exhaust budget deliberately after preflight to avoid a model. Cover true clean divergence (both commits preserved/pushed), behind ff, ahead push, conflict abort cleanliness and no model, repeat UTCday notification dedup, fetch fail, push reject, concurrent caller edits, absent/false legacy rejection, valid/invalid config and check-config read-only. Prove new expected behavior red on original code before changing it; sabotage using a temporary source copy, never stash somebody else’s work. Details <=300chars; strip hint/control noise before truncation; use existing JSON-safe event arguments.

Gate baseline and commit gate (personally rerun by orchestrator): `bats tests/` (full suite); `bats tests/build-trunk-reconcile.bats tests/build-benign-abort.bats tests/token-caps.bats`; `bash -n agents/build/runner.sh` and any new helper; configured syntax sweep; `bash scripts/leak-check.sh`; `bash scripts/check-deck-fresh.sh`; `bash scripts/check-deck-complete.sh`; `bash agents/design/runner.sh --self-test`; `bash agents/medic/runner.sh --self-test`. New files must be intent-to-add/staged before leak-check (tracked-only scan). README/INSTALL/deck describe the new flag and behavior; regenerate deck from editorial, never hand-edit generated data.

Rollout: direct main commit after green gates per actual Shipyard instructions; push and inspect CI. Rollback is a normal revert of this task’s commit on main. No environment/unit knobs added. All existing projects remain default-off during this source rollout. Confirm primary published deck JSON bytes match committed source; configured mirror cascade is bounded to its own paths. Record mirror limitation if any.

## Phase B — enable Starbird and verify live (1point)
Delegation: inline (single already-read config edit under30lines, live gates operator must inspect).
Set `.agents/config.toml` `[build] reconcile_trunk = true` with comment. `runner.sh --project <Starbird> --check-config` must show true, parse correctly and stay read-only. Commit/push owner-authorized config; `systemctl --user start starbird-helldiver.service` once; inspect real job.end/Result/ExecMainStatus and scheduled timer. Do NOT manufacture divergence in production: isolated Git fixtures exercise actual conflict paths; healthy production run verifies installed integration. Inspect subsequent normal Suk scan for new same-unit self_failure, preserving historical frozen records. No unit file edit, so no daemon-reload needed. Rollback Starbird opt-in via normal config revert. App/data unchanged; do not rerun app UI suites for config/docs-only work already covered by previous recovery.

## Completion / Definition of Done
- [ ] New true-path fixtures red before source change, then green, including real merge/push outcomes and conflict cleanup/dedup.
- [ ] False/unset legacy behavior and model invocation caps preserved; actual errors remain observable/nonzero.
- [ ] Shared full suite, syntax/leak/deck and self-tests pass; CI checked; published deck matches committed bytes.
- [ ] Starbird true effective config and real unit success; timer intact; no new same-unit failure in following scan.
- [ ] No force/history loss/data edits; no unrelated changes staged; fixture processes cleaned up.
- [ ] Starbird tree clean; Shipyard clean apart from identified pre-existing concurrent work. Ticket graduated with lifecycle engine in final commit.

## Dependencies / boundaries
No new packages or network services. Shared code is fleet-live on next timer; opt-in isolates rollout. Broad data-runner push suppression and scribe PR design remain separate concerns. Silent daily research runner pushes are NOT changed here; record follow-up. Conflict remains a human-resolution condition (one daily actionable notice); this ticket makes it safe/visible rather than pretending every conflict can be merged automatically.

## Ledger
- Execution preflight: re-read actual repo instructions/config/gates; no specialist manifests or memory table in Starbird/Shipyard configs. Changed old branch plan and unconditional merge plan to current main-only + default-off contract. Operational D1 remains complete. Full Shipyard baseline started; leak/syntax/deck gates green so far.
