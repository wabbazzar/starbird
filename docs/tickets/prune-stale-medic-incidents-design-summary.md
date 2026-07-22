# Ticket: Exclude stale medic incidents from the design-loop summary

**Created:** 2026-07-22
**Owner:** Wesley
**Assignee:** (unassigned)
**Status:** Ready for build
**Refs:** mentat:starbird:51f4f505 (approved via Daily Dispatch)

---

## Goal

`agents/design/collectors.sh`'s source-5 collector ("medic incident files
under tmp/") feeds every `<project>/tmp/*incident*.json` file it finds into
the summary handed to mentat (the design loop), with **no age bound** —
unlike every other collector in the file, which is bounded by the `days`
window. Fix source 5 so files older than the window are excluded from the
summary. Do not touch medic's incident-detection logic
(`agents/medic/runner.sh`).

## Context / pointers (verified 2026-07-22)

- **The bug, exact location:** `~/code/guardian-quartet/agents/design/collectors.sh`,
  function `collect_signals()`, lines 129–149 (comment header: `# --- (5)
  medic incident files under tmp/ ---`). It globs
  `find "$project_dir/tmp" -maxdepth 1 -type f -name '*incident*.json'` with
  no `-mtime` bound and no comparison against each file's own `detected_at`
  field. Sources 2–4 (events, fyi, usage) are all bounded by the `days` param
  via `_read_events`; source 5 is not.
- **This is shared infra, not starbird-local.** The file lives in
  `~/code/guardian-quartet` (remote `git@github.com:wabbazzar/shipyard.git`),
  used by every project's design loop on this host, not just starbird's.
  `systemctl --user cat starbird-mentat.service` shows `ExecStart=/bin/bash
  /home/wabbazzar/code/guardian-quartet/agents/design/runner.sh ...` — the
  live unit execs the dev checkout's `main` directly, no pinned/packaged copy
  and no redeploy step. A separate deployed copy exists at
  `~/code/wabbazzar-ice/packs/guardian-quartet/agents/` but **does not even
  contain an `agents/design/` directory** as of this writing — confirms the
  design role runs only from the dev checkout today.
- **`collect_signals()` already receives a `days` window** (default 7;
  `agents/design/runner.sh` invokes `collectors.sh --project "$PROJECT_DIR"
  --json` with no `--days` override, so production runs at the default).
  This ticket does not need a new parameter — source 5 just needs to start
  honoring the one that already exists.
- **`collectors.sh`'s own contract:** its header (lines 9–24) states it
  "NEVER writes anything, anywhere" — it is a read-only collector. That
  means the fix here is a **filter** (exclude old files from the emitted
  summary) — not a **prune/archive** (delete/move files on disk), which
  would violate that documented invariant if done inside this file. A true
  disk-level prune of `tmp/*incident*.json` (to stop `tmp/` from growing
  unbounded) is a distinct, separately-scoped concern belonging to medic's
  writer (`agents/medic/runner.sh`, which creates
  `$RESULT_DIR/medic-incident-$iid.json` — see line 878) — **out of scope
  here** per the approved item ("do not change medic's own
  incident-detection logic").
- **Confirmed live staleness, starbird's own `tmp/`:** 9
  `medic-incident-*.json` files dated 2026-05-19 through 2026-06-12 (40–64
  days old as of 2026-07-22, checked via `ls -la --time-style=full-iso
  tmp/medic-incident-*.json`), against the 7-day default window. Every
  nightly mentat run has been shown 2-month-old incidents as if they were
  current signal.
- **No existing test exercises source 5 at all.** `agents/design/runner.sh
  --self-test` (verified passing, 2026-07-22: `self-test OK: 2 proposals
  written, 2 design.proposal.opened events, cap<=3 held`) only synthesizes an
  event-stream line (`medic.incident.opened`) for its incident coverage — it
  never creates a `tmp/*incident*.json` fixture, so it currently proves
  nothing about this collector path either before or after this fix.
- **guardian-quartet has no `docs/tickets/`** (it tracks work via its own
  "deck"/phase commit convention — see `git log --oneline`, e.g. `feat: D-L15
  incident reroute + retire build side-door + ...`). The code fix there lands
  as a plain commit on a branch, not a new ticket file in that repo.
- Gate commands and cross-repo hazards for this project now live in
  `.agents/gates.md` (filled in as part of this polish pass — it was an
  unfilled install template before today). Read it for the exact commands
  below rather than re-deriving them.

## Decisions

### Locked

| # | Decision |
|---|----------|
| 1 | Fix lands in source 5 of `agents/design/collectors.sh` only. `agents/medic/runner.sh` is untouched — `git diff` in that repo must show no changes under `agents/medic/`. |
| 2 | The fix **filters**, it does not delete or move any file. `collectors.sh` stays read-only per its own header contract. |
| 3 | The emitted shape of `sources.medic_incidents` (`{count, examples}`) is unchanged — nothing downstream (mentat's prompt assembly in `agents/design/runner.sh` / `role.md`) needs to change. |
| 4 | No new CLI flag or config key — reuse the existing `days` parameter already threaded through `collect_signals()`. |
| 5 | Work happens on a branch in `~/code/guardian-quartet` (per the merge-is-live hazard in `.agents/gates.md`), verified there, then merged to `main`. |

### Open, with default (builder proceeds, records the choice in the Ledger)

| # | Question | Default |
|---|----------|---------|
| 1 | Filter key: file mtime vs. the incident's own `detected_at` field? | **File mtime**, via `find ... -mtime -"$days"` (or `-newermt "-$days days"` for sub-day precision, since `-mtime -7` truncates to whole days). Simplest, zero new JSON parsing, and every sample file's mtime already matches its `detected_at` closely enough that this is not the corner that matters. If a future caller needs `detected_at`-precision (e.g. a file `touch`ed by an unrelated process), that's a follow-up, not blocking. |
| 2 | Add source-5 coverage to `agents/design/runner.sh --self-test`? | **Yes, in the same commit.** The self-test currently proves nothing about this path (see Context). Add: a stale fixture (`tmp/medic-incident-stale.json`, mtime forced outside the window via `touch -d`) that must NOT appear in the summary, and a fresh fixture that MUST appear. A test that can't fail on the bug being fixed isn't a test. |

No user-decision-class items (no spend, no outward-facing surface, no
destructive/hard-to-reverse system change, no live-automation behavior change
the owner deliberately configured) — this is a pure bugfix to a read-only
collector's filtering logic.

---

## Phases

### Phase 1 — Fix + self-test coverage in `guardian-quartet` (branch)

**Slice:** In `~/code/guardian-quartet`, on a new branch (e.g.
`fix/design-collector-stale-incidents`):

1. In `agents/design/collectors.sh`, source-5 block (lines 129–149): bound
   the `find` that populates `incident_files` by the `$days` window (default
   filter key: mtime, per Decision 1 above). Update the file's header
   comment (source-5 bullet, lines 21–22) to note the window now applies.
2. In `agents/design/runner.sh`'s `--self-test` block: add a stale incident
   fixture (mtime forced outside the test's window) and a fresh one; assert
   the stale one is absent from `sources.medic_incidents` and the fresh one
   is present. Reuse the synthetic project scaffold already built by
   `--self-test` (see the `ST_TMP`/`PROJ` setup near the top of the block).

**Verification (from `.agents/gates.md` — Shell scripts + cross-repo classes apply):**
- `bash -n agents/design/collectors.sh` and `bash -n agents/design/runner.sh`
  — both clean.
- `bash agents/design/runner.sh --self-test` — must print `self-test OK` and
  exit 0, including the new stale/fresh incident assertions actually
  executing (not skipped).
- Manual real-world check against starbird's live stale files (read-only,
  no starbird changes needed): `QUARTET_DIR=~/code/guardian-quartet
  QUARTET_EVENTS_DIR=~/code/wabbazzar-ice/data/events bash
  agents/design/collectors.sh --project /home/wabbazzar/code/starbird --json
  | jq .sources.medic_incidents` must show `count: 0` (all 9 existing
  starbird files are 40+ days old). Then `touch` one of them to bring its
  mtime inside the window and re-run — `count` must become 1, proving the
  positive case, then leave the touched file's mtime as you found it (or
  note in the Ledger that you didn't bother reverting a `tmp/` scratch file
  timestamp — low stakes either way, but say which).
- `git diff` shows changes only under `agents/design/`; nothing under
  `agents/medic/`.

**Commit:** on the branch, in this repo's own convention (`fix: ...`, per
`git log --oneline` precedent) — no ticket file needed in this repo (it has
none).

**DoD:** self-test green, manual `--collect-only`-equivalent check above
shows `count: 0` against starbird's actual stale files and `count: 1` after
touching one, `bash -n` clean on both touched scripts, diff scoped to
`agents/design/` only.

### Phase 2 — Merge and confirm live behavior

**Slice:** Merge the branch to `main` in `~/code/guardian-quartet` (this is
the merge-is-live hazard from `.agents/gates.md` — confirm Phase 1's
verification is solid before merging, since it takes effect for every
project's design loop at the next timer fire, not just starbird's).

**Verification (systemd + event-stream classes apply):**
- After merge, manually fire it once rather than waiting for `OnCalendar`:
  `systemctl --user start starbird-mentat.service`.
- `systemctl --user list-timers | grep starbird-mentat` still shows the next
  scheduled fire (05:00 daily) — the manual start doesn't disturb the timer.
- Read the actual result: `cat
  /home/wabbazzar/code/starbird/tmp/starbird-mentat-result.json` (or the
  `$SVC-result.json` path `agents/design/runner.sh` writes) and the day's
  event-stream file
  (`~/code/wabbazzar-ice/data/events/$(date +%F).jsonl`) for a `job.end`
  line for `starbird-mentat` with `status=ok`.
- Confirm no notification fired unexpectedly (`$QUARTET_NOTIFY_CMD` is only
  for genuine alerts) — a normal design run completing is not a page-worthy
  event; if the run's own logic sends one, that's pre-existing behavior, not
  something this ticket changes.

**DoD:** `main` in guardian-quartet contains the fix, a real
`starbird-mentat` run after merge completes with `job.end status=ok`, and
the acceptance criterion below is independently confirmed against starbird's
real `tmp/`.

---

## Acceptance criteria (roll-up)

- `sources.medic_incidents.count == 0` when `collect_signals` runs against
  starbird's `tmp/` as it stands today (9 files, all 40+ days old, 7-day
  window) — down from non-zero before the fix.
- A file within the window still appears (positive case, proven in Phase 1's
  manual touch-and-recheck and in the new self-test fixture).
- `agents/design/runner.sh --self-test` passes, now exercising source 5.
- `agents/medic/runner.sh` has zero diff.
- A real `starbird-mentat` run after merge completes (`job.end status=ok`)
  and its result file's `medic_incidents` count reflects the fix.

## Ledger

_(builder appends: plan notes, commit hash per phase, any deferred item, per
phase, as it lands)_

---

Build with: `execute-ticket docs/tickets/prune-stale-medic-incidents-design-summary.md`
