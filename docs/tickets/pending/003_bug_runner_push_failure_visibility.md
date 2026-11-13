# 003 — surface daily research runner publish failures

**Created:** 2026-11-12 · **Owner:** Wesley
**Status:** Draft — ready for polish-ticket · **Priority:** P1 · **Type:** bug
**Estimated Points:** 3 (one implementation phase)
**Target:** Starbird research runner, not the shared Shipyard build runner
**Refs:** `002_bug_helldiver_push_failed_diverged_main.md`, Decisions D3 / follow-up boundary; hub `docs/tickets/complete/starbird-helldiver-git-recovery.md`

## Summary

When a research-runner Git push fails, exit nonzero and record a failed publish
outcome instead of announcing a successful daily run. Preserve the local commit
for recovery; do not resolve divergence or change research data in this ticket.

## Problem / Background

Ticket 002 captured a real non-fast-forward rejection: Starbird had 55 local-only
commits and two remote-only commits; Helldiver aborted at its initial push.
That operational divergence was already recovered separately. The daily research
runner can conceal the same failure and let unpublished commits accumulate:

- `scripts/starbird-runner.sh:82` suppresses the self-repair push failure with
  `git push >> "$LOG_FILE" 2>&1 || true`; line 83 then unconditionally reports
  `committed + pushed .gitignore patch`.
- `scripts/starbird-runner.sh:337` suppresses the daily data-commit push failure
  with the same expression.
- `scripts/starbird-runner.sh:374–398` builds status/notification from the earlier
  model exit variable `EXIT`, which push failures never update.
- `scripts/starbird-runner.sh:406–414` prints `Done. exit=$EXIT` and emits
  `job.end status=ok exit_code=0` when that earlier model exit was zero. The
  script ends at the best-effort event expression, without an explicit final
  `exit "$EXIT"`.
- Existing `fatal()` at lines 35–46 already provides nonzero process exit,
  failed `job.end`, and owner notification; choose a minimal coherent failure
  path rather than introducing a second reporting subsystem.

**Observable contract:** daily success means the intended local commit was
accepted by the configured remote. Failed publication must fail the process and
emit one failed terminal event with a stable publish-related reason. Research
success alone does not establish publication success.

**Root / history:** the defect is in the caller's explicit suppression of Git
push errors. The expressions remain in current source after runner commits
`830c545` and `c000989`; those identifiers are context, not a claim about which
introduced the bug. Determine introduction with blame when building if needed.
The same class exists at both push sites; include both. Coverage gap:
`tests/unit/runner-gitignore-guard.test.ts` checks source wiring but never executes
a rejected push, and auth-preflight tests do not exercise the publish stage.

## Reproduction and acceptance anchor

Use a temporary local bare Git remote and two clones with fixture identity.
Create one local-only commit in the runner clone and a different remote-only
commit pushed from the peer clone. A normal push from the runner clone must
reject as non-fast-forward. Execute the runner against that fixture with all
model, auth, image-generation, event and notification dependencies stubbed.
The model stub succeeds so the only intended failure is publication.

As documented in `.agents/gates.md` Traps, the runner hard-codes `STARBIRD_DIR`,
`NOTIFY`, and `LOG_EVENT`: execute a temporary rewritten script copy with those
paths pointed at the fixture and recorders. Never run the real daily command
against production as a test. Cover both the missing-`.worktrees/` self-repair
branch and the ordinary daily publish branch in separate fixture runs.

**Before fix:** Git rejects the push, but `|| true` suppresses that result; the
self-repair branch can claim pushed and the daily branch can report success.
**After fix:** process nonzero, one `job.end status=fail` with publish-related
reason and nonzero `exit_code`, one failed owner notification, no success
summary, and all local commit/file bytes retained. Demonstrate the new
regression failing against the original runner before changing it.

## Technical Requirements / Boundaries

- Modify `scripts/starbird-runner.sh` and add an executed regression under
  `tests/unit/` following the repository's Vitest conventions. A small sourced
  publish helper is optional only if needed for a reliable test seam.
- Preserve original command exit status before logging or notifications; never
  let best-effort reporting replace the process's nonzero exit code.
- Use the existing event logger and `${QUARTET_NOTIFY_CMD:-$NOTIFY}` owner
  notification route. Keep bounded useful Git failure detail in the private
  run log; do not print credentials or invent a new event schema.
- Default stable reason: `push_failed`, with stage detail distinguishing
  `gitignore_repair` from `daily_publish`; implementation details remain for
  polish-ticket. Emit exactly one terminal `job.end` per run.
- Keep successful research counts, successful push behavior, auth preflight,
  model budgets/retries and existing dry-run behavior intact. The existing
  gitignore self-repair runs in either mode; include its failure handling without
  adding data publication to dry-run mode.
- No edits to `static/data.json`, `static/blog.json`, generated cards/posts,
  schema, shared Shipyard code, crew configuration, timers or live cron.
- No force push, automatic merge/rebase, reset, stash, data conflict policy, or
  repeated paid research to repair publication. Retain the unpublished commit
  and clearly name the necessary manual or ticket-002 recovery path.

## Implementation Plan

### Phase 1 — fail publication honestly and close the execution coverage gap (3 points)

Delegation: subagent — own only the Starbird runner and focused Vitest fixture;
return exact red/green evidence, exit codes, emitted terminal event and preserved
Git/file state. Orchestrator independently verifies before committing.

1. Build hermetic local-remote fixtures and prove the two failure paths against
   the original script. Stub paid/auth/network calls and notification sinks.
2. Replace suppressed push failures with one consistent failed-publish path.
   Preserve local work and propagate its nonzero status to the scheduler.
3. Add successful push and dry-run controls, ensure reporting failures do not
   mask the primary exit, and keep existing auth/gitignore cases green.

Files: `scripts/starbird-runner.sh`, new
`tests/unit/runner-push-failure.test.ts`, optional narrowly scoped helper only.
Applicable gate classes: shell, executed Vitest regression, events/notifications.
No served-UI, systemd or live public-data mutation gate applies to this scope.

## Testing Strategy

Run `bash -n` on touched shell files and `npx vitest run`; focused iteration may
use `npx vitest run tests/unit/runner-push-failure.test.ts` alongside existing
runner auth-preflight and gitignore cases. Tests must inspect process status,
real local Git state and captured JSONL/notify records, not merely source regex
or a mocked function's call arguments. Use temporary directories and local Git
remotes only; forbid live GitHub/model/Signal calls. No new dependencies.

## Acceptance Criteria / Definition of Done

- [ ] Rejected self-repair and daily pushes each produce a nonzero process
  exit, exactly one failed terminal event and one failed owner notification.
- [ ] Failed push never yields `Done. exit=0`, a successful daily notification,
  or the unconditional `committed + pushed` claim.
- [ ] Local unpublished commits and their tree bytes survive failures intact;
  no forced/history-rewriting operation occurs.
- [ ] Successful push still emits the normal successful outcome; normal dry-run
  does not publish research changes; existing auth handling remains covered.
- [ ] New executed regression fails on original source and passes on the fix;
  shell syntax and the full existing Vitest suite pass.
- [ ] Tests use isolated local remotes and captured event/notify sinks; no live
  data, model invocation, production scheduler or public site is touched.
- [ ] Changes are committed with scoped staging after verification; record
  exact test results and remaining limitations in the build Ledger.

## Dependencies

Ticket 002 provides the incident evidence and safe Helldiver reconciliation;
this follow-up neither blocks nor reopens that recovered operational work.
No package, schema, infrastructure or paid-service dependency is introduced.

## Risks & Mitigations

- Testing a copied runner could target production because of hard-coded paths:
  rewrite all three documented paths and assert fixture roots before execution.
- Duplicate ERR-trap and explicit failure reporting: prove exactly one terminal
  event/notification for each rejection and preserve the original push status.
- A notification failure could hide failed publication: keep reporting
  best-effort and assert the process still exits nonzero.
- Divergence remains unresolved after detection: preserve local commits and
  make failure actionable; recovery policy stays outside this minimal scope.

## Out of scope

Automatic history reconciliation, the shared Helldiver runner, scribe publication
design, research data/schema changes, UI work and changing the existing
self-repair mode policy. This is a draft follow-up only: no implementation or
automatic polish/build is authorized by creation of this file.

## Ledger

- Drafted from current source and ticket-002 evidence; no application code was
  changed and no production runner or regression fixture was executed here.

Next: `polish-ticket` when this separate follow-up is selected for execution.
