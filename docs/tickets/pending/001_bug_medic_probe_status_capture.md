# 001 — Medic probe emits malformed status codes (200000 / 000000)

- **Created:** 2026-10-31
- **Owner:** build crew (cold agent / `execute-ticket`)
- **Status:** Ready
- **Priority:** P2
- **Type:** bug
- **Estimated Points:** 5 (2 phases)
- **Refs:** Mentat proposal `mentat:starbird:c8164da4` (approved via Daily Dispatch)

## Goal
Make the medic `[[medic.probes]]` status capture always yield a clean 3-digit HTTP code, and prove it with a `--self-test` case that fails on the old code. Fix lives in the **shipyard** repo, not starbird.

## Context / pointers
- Defect site: `~/code/shipyard/agents/medic/runner.sh:489-491` (`detect_scan_probes`, ≈L455-525):
  ```bash
  local curl_args=(-sS -o /dev/null -w "%{http_code}" --max-time "$p_timeout")
  [ -n "$p_resolve" ] && curl_args+=(--resolve "$p_resolve")
  status_code="$(curl "${curl_args[@]}" "$p_url" 2>/dev/null || echo "000")"
  ```
  curl's `-w` prints a code (`000` if no HTTP response) AND may exit nonzero (28 timeout, 56/92 reset, 23 write). `|| echo "000"` then appends a second `000`: `200`+`000` = `200000`; `000`+`000` = `000000`. The comparison `[ "$status_code" = "$p_expect" ]` then fails on a healthy site -> `push_incident` (≈L505-520) -> `restart_action freeze:infra` freezes the agent 24h.
- Reproduced while polishing (2026-10-31), stub curl on PATH: `printf 200; exit 28` -> `200000`; `printf 000; exit 7` -> `000000`. Command: `PATH=<stubdir>:$PATH bash -c 'echo "$(curl x || echo 000)"'`.
- Evidence: probe `starbird-live-data` (`.agents/config.toml:91-99`, `https://starbird42.com/data.json`, expect 200). Incidents: `c76e9e60427723cc3e5fbfc6636b81799cdf5c97d8640577d25371f28310a67c` (2026-09-28, 200000), `3daff3c1c21c7df1741d5aa39234ddc902cc88873c5c26347e8f2a113d97a063` (2026-09-26, 200000), `4554b29a611c2b12f9ad6780e921d899c5dc5db8bda437b80d6fc13485174fed` (2026-09-27, 000000).
- The starbird probe entry is correct; do **not** edit starbird config/data.
- Existing self-test: `medic_self_test` (`runner.sh:71-127`), dispatched at L128 via `--self-test` (flag parse L49). Baseline measured 2026-10-31: `bash agents/medic/runner.sh --self-test` -> `self-test: PASS (shapes exercised: squash, true-merge)`, rc=0.
- Toolchain check (C2): `bash`, `jq`, `curl` present; **`shellcheck` is NOT installed** — use `bash -n` only, don't require shellcheck.

## Decisions
| Locked | |
|---|---|
| Fix location | shipyard `agents/medic/runner.sh` only; no starbird files change |
| Semantics | `000` still = connection failure/no response; probe payload shape and `--resolve` support unchanged |
| Test seam | stub `curl` placed first on `PATH` inside the self-test; no network |

Open (builder applies default, records in Ledger): function name `probe_http_status` (default); invalid/garbled output -> `000` (default).
User-decision class: none. Specialists: none installed (`.agents/specialists` absent). Memory: no `[memory]` table -> no query. Project is not `autonomous`.

## Orchestration protocol
Builder is an orchestrator: delegate where marked, keep context lean, re-verify personally. Anti-cheating brief (verbatim, applies to every subagent):
> Converge honestly or report the precise blocker with the actual evidence — NEVER fake green, weaken a check, or hand-wave "should work". Run the real command, read the real file, curl the real port, and report exact output (exit codes, JSONL lines, HTTP codes), not adjectives.

**Merge-is-live hazard:** every project's medic execs `~/code/shipyard` `main`. Work on a branch `fix/medic-probe-status-capture` (use a git worktree, not the dev checkout), verify, then merge per shipyard flow. Rollback: `git revert <merge-sha>` on shipyard `main`.

## Phase 1 — Fix the capture (2 pts)
Slice: add `probe_http_status <url> <timeout> [resolve]` before `detect_scan_probes`: build the curl args as today, run `out="$(curl "${args[@]}" "$url" 2>/dev/null || true)"`, then `[[ "$out" =~ ^[0-9]{3}$ ]] && printf '%s' "$out" || printf 000`. Replace L489-491 with a call to it. Nothing else in the function changes.
Files: `~/code/shipyard/agents/medic/runner.sh`.
Delegation: inline (≈15-line change in one file; the builder must read the diff itself).
Gates (shell class): `bash -n agents/medic/runner.sh` exit 0; `grep -n 'echo "000")' agents/medic/runner.sh` shows no curl-capture hit; `bash agents/medic/runner.sh --self-test` still PASS (2 existing shapes).
DoD: those three commands show the stated results; one commit `medic: probe status capture yields clean 3-digit code` on the branch.

## Phase 2 — Self-test regression + live dry-run (3 pts)
Slice: extend `medic_self_test` with a `probe-status` shape. In a temp dir create a stub `curl` (arg-agnostic) that prints `$STUB_OUT` and `exit $STUB_RC`; prepend to `PATH`; call `probe_http_status` and assert exactly:
| STUB_OUT | STUB_RC | expect |
|---|---|---|
| 200 | 0 | 200 |
| 200 | 28 | 200 (old: 200000) |
| 000 | 7 | 000 (old: 000000) |
| (empty) | 6 | 000 |
| abc | 0 | 000 |
Each assertion prints `self-test: probe-status <case> OK|FAIL`; include it in the final `PASS (shapes exercised: …, probe-status)` line. Honor the existing `MEDIC_REVERT_LIB`-style test-hook pattern if a sabotage hook is cheap; otherwise sabotage manually below.
Files: `~/code/shipyard/agents/medic/runner.sh`.
Delegation: subagent — brief: "On branch `fix/medic-probe-status-capture` in `~/code/shipyard`, add the `probe-status` shape to `medic_self_test` in `agents/medic/runner.sh` per the table above (stub curl on PATH, no network). Own only that file. Then (1) run `bash agents/medic/runner.sh --self-test` and report the output; (2) sabotage: temporarily make `probe_http_status` use `|| echo 000` again, rerun, confirm the `200`/`000` cases print FAIL and overall FAIL, then restore with `git checkout -p`/`git diff` check showing the fix intact. Return (≤40 lines): files changed; commands + exit codes; both transcripts' key lines; blockers." + anti-cheating brief above.
Gates: `bash -n`; `--self-test` PASS with `probe-status` listed; sabotage run FAIL (builder re-runs it personally once); live dry-run: `bash agents/medic/runner.sh --project ~/code/starbird --mode scan --dry-run` then read the medic log line `[medic] probe starbird-live-data OK (200)` (or a clean 3-digit status) — locate log path via the script's `LOG_FILE`; do not trigger a real incident/notification.
DoD: all above observed; commit `medic: self-test probe status capture (regression for 200000/000000)`.

## Phase 3 — End-to-end gate and merge (0 pts, verification only)
Re-run: `bash -n`, `--self-test` (PASS), `git diff main --stat` shows only `agents/medic/runner.sh`, `git status` clean in both repos. Merge branch to shipyard `main` (per shipyard's flow), confirm `systemctl --user list-timers | grep starbird-suk` shows next fire, and `systemctl --user start starbird-suk.service` then `journalctl --user -u starbird-suk -n 20` shows a 3-digit probe status and no `freeze:infra` incident. Delegation: inline (gate output must be read by the orchestrator).

## Testing Strategy
Deterministic stub-curl self-test (above) is the regression; it must fail on the old expression (proven by sabotage). Starbird app suites (`npx vitest run` etc.) are not affected and need not run.

## Acceptance Criteria
- [ ] No `curl … -w "%{http_code}" … || echo "000"` capture remains in `runner.sh`.
- [ ] `--self-test` asserts all five stub cases and prints PASS with `probe-status` listed.
- [ ] Sabotage (old expression restored) makes the self-test FAIL; fix restored afterward.
- [ ] Existing squash/true-merge shapes still PASS.
- [ ] Dry-run scan logs a clean 3-digit status for `starbird-live-data`.
- [ ] Diff touches only `~/code/shipyard/agents/medic/runner.sh`; no starbird file changed except this ticket's Ledger.
- [ ] Both worktrees clean; no stray stub dirs/processes.

## Risks & Mitigations
- Fleet-live merge breaks other projects -> branch + self-test + dry-run before merge; revert command above.
- Real `000` (hairpin NAT, comment at L469) is still `000` — intended.
- `shellcheck` unavailable -> rely on `bash -n` + executed tests.

## Out of scope
Other probes, escalation/freeze policy, `post_check` handling, retry logic, starbird site/data.json.

## Ledger
(builder appends per phase: plan, commit hash, `builder: subagent (N agents)` / `builder: inline (<reason>)`, deferred notes)

Run with `execute-ticket` on this file.
