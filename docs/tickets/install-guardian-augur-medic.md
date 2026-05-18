# Ticket: Install Guardian + Augur + Medic for Starbird

**Created:** 2026-05-18
**Owner:** Wesley
**Assignee:** ice-agent
**Status:** Ready to install — bindings written, awaiting wire-up

---

## Problem

The runner (Claude Sonnet, scripted via `scripts/starbird-runner.sh`,
fires daily at 07:05) has produced schema-invalid `static/data.json`
updates **four times in three weeks**:

| Date       | Hotfix commit                                | Shape error                                                   |
|------------|----------------------------------------------|---------------------------------------------------------------|
| 2026-04-25 | `de6d777`                                    | numeric `since` + free-text `stake "majority (2010-2021)"`    |
| 2026-04-29 | `8b69ec6`                                    | `stake "IP owner"`                                            |
| 2026-05-10 | `577bc80`                                    | numeric `since` on 3 brands                                   |
| 2026-05-18 | `f8df056`                                    | numeric `since` + `stake "self-owned"` (3 brands)             |

A pre-commit schema gate (`scripts/validate-data.mjs`, added
`171c015` on 2026-05-10) now blocks bad data from reaching `main`,
so the site no longer breaks. But the runner gets stuck — same
shape error reproduces, same strategy gets re-picked, a human has to
salvage each run.

The fix-the-runner pattern (tighten the prompt, add examples) isn't
holding: Sonnet keeps improvising shapes that aren't in
`OwnershipSchema`. Higher-leverage prevention is needed.

## What's been written

Four binding files live at `.agents/` in this repo, matching the
shredly2 convention:

| File                       | Purpose                                                   |
|----------------------------|-----------------------------------------------------------|
| `.agents/config.toml`      | paths, budgets, test/typecheck/audit commands, probes     |
| `.agents/guardian.md`      | starbird checks (tests + typecheck + data audit + build)  |
| `.agents/augur.md`         | starbird triage rules + in/forbidden paths                |
| `.agents/medic.md`         | starbird classification cues (schema-gate failures, etc.) |

The schema-gate script (`scripts/validate-data.mjs`) already exists
and is what guardian's data-audit step and medic's live-data probe
both invoke.

## What ice-agent needs to install

Mirror the shredly2 installation. Concretely:

### 1. systemd timers + services on wabbazzar-ice

Three service+timer pairs, modeled after the shredly equivalents:

```
starbird-guardian.service / starbird-guardian.timer
  ExecStart=/home/wabbazzar/code/wabbazzar-ice/agents/guardian/runner.sh \
            --project=starbird --mode=daily
  OnCalendar=*-*-* 06:00:00          # 65 min before runner fires
  Wants=network-online.target

starbird-medic.service / starbird-medic.timer
  ExecStart=/home/wabbazzar/code/wabbazzar-ice/agents/medic/runner.sh \
            --project=starbird --mode=scan
  OnCalendar=*-*-* *:0/10:00         # every 10 min
  # The poll interval matches config.toml medic.poll_interval_sec=600

starbird-augur.service / starbird-augur.timer
  ExecStart=/home/wabbazzar/code/wabbazzar-ice/agents/augur/runner.sh \
            --project=starbird --mode=live
  OnCalendar=*-*-* 03:30:00          # nightly, off-peak
```

### 2. Pre-commit hook (optional, defense in depth)

The runner already calls `scripts/validate-data.mjs` before commit.
A git pre-commit hook calling the same script would catch human
edits that bypass the runner. Install at
`.git/hooks/pre-commit` (or via `husky` / `pre-commit` framework).
Low priority — the runner gate covers 95% of cases.

### 3. Replace the existing `.claude/hooks/post-push-starbird-guardian.sh`

The current post-push hook (referenced in `CLAUDE.md`) is a
homegrown shim. The wabbazzar-ice Guardian replaces it. Either
remove the hook or have it shell out to the new
`agents/guardian/runner.sh --mode=hook`.

### 4. Verify config.toml is loadable

```bash
cd /home/wabbazzar/code/wabbazzar-ice
bash agents/lib/load-config.sh starbird   # or equivalent dry-run
```

Should print the project config without errors. If the loader
expects fields that aren't in `.agents/config.toml`, file a
follow-up — the binding may need a tweak.

## What augur should build once installed (the high-leverage fix)

`scripts/coerce-data-shapes.mjs` — runs between Claude's edit pass
and `scripts/validate-data.mjs` in the runner pipeline. Mechanically
normalizes the four known-recoverable shape errors documented above:

1. Integer `since` / `until` → stringified
2. `stake: "self-owned"` → `stake: "majority"` (per CLAUDE.md
   convention)
3. `stake: "majority (YYYY-YYYY)"` → `stake: "former"` + `until: "YYYY"`
4. `stake: "IP owner" | "licensee" | "trademark holder"` →
   `stake: "post_bankrupt"`

After coercion runs, the schema gate runs unchanged; any
non-recoverable error still fails the build. The wire-up is a
single line in `scripts/starbird-runner.sh` between the
`claude -p` invocation and the validator call.

The Python sweeps in the four hotfix commits (`de6d777`, `8b69ec6`,
`577bc80`, `f8df056`) are the reference implementations. Augur can
read them out of git history.

## Acceptance criteria

- [ ] `systemctl --user status starbird-guardian.timer` shows active
- [ ] `systemctl --user status starbird-medic.timer` shows active
- [ ] `systemctl --user status starbird-augur.timer` shows active
- [ ] `journalctl --user -u starbird-guardian.service -n 50` shows
      a clean run since install (no parse errors loading config.toml)
- [ ] `journalctl --user -u starbird-medic.service -n 50` shows the
      scan tick firing and the `starbird-live-data` probe returning
      green
- [ ] Augur's first autonomous PR has opened
      `scripts/coerce-data-shapes.mjs` and the runner script change
      to wire it in
- [ ] The next runner pass that would have produced a shape error
      coerces successfully and the entry lands without a hotfix
