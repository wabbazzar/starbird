# Verification gates — starbird

> The single source of truth for **how to prove a change works on this
> project**. `polish-ticket` reads this file to assemble the per-phase
> verification surface; `execute-ticket` reads it to know which gates to run
> before every commit. There is no one test command that covers everything —
> a phase declares which of the classes below apply, and this file supplies
> the exact commands.
>
> The installer drops this template into `<project>/.agents/gates.md` and
> never clobbers an existing copy. Fill in the placeholders, delete the gate
> classes that don't apply, and grow the **Traps** appendix over time.

## Commands (fill these in)

| What | Command |
|---|---|
| Test suite | `npx vitest run` |
| Typecheck / lint | `npx svelte-check --threshold error` |
| Build | `npm run build` |
| Data-quality audit | `npx tsx scripts/validate-data.mjs` (schema) / `npx tsx scripts/dq-check.mjs` (schema + stray keys + FK + evidence linkage) |
| Notify (owner alert) | `$QUARTET_NOTIFY_CMD` (baked into units at install; a wrapper that pages the owner — the ONLY notification path) |
| Event stream dir | `$QUARTET_EVENTS_DIR` (append-only JSONL, one `job.*` / incident object per line) |

## Gate classes — mark which apply, keep the exact commands

Delete any class this project doesn't have. For each phase, the ticket names
which of these apply; "the code looks right" is never proof.

### Shell scripts  — APPLIES: yes
Starbird's own agent scripts (`scripts/starbird-runner.sh`, `scripts/*.mjs`
launchers) plus any sibling-repo shell scripts a ticket touches (see cross-repo
row below). `bash -n` every touched script, then **run it for real** and read
the output (exit codes + printed values, not vibes). Scripts with a
`--check` / `--dry-run` flag: run that too.

### systemd (user) units  — APPLIES: yes
Timers/units run on this machine (hostname `wabbazzar-ice`, same box this repo
is checked out on) under `~/.config/systemd/user/starbird-*.{service,timer}`.
Current units (verified 2026-07-22 via `systemctl --user list-timers | grep
starbird`): `starbird-suk` (medic, every 10 min), `starbird-chronicler`
(scribe, 01:00), `starbird-helldiver` (build, 03:30), `starbird-proctor`
(release, 04:30), `starbird-mentat` (design, 05:00). After any unit
file change: `systemctl --user daemon-reload`, then `list-timers` shows the
expected next fire, then start the service once
(`systemctl --user start <unit>`) and confirm the observable outcome — a
`job.end` line in `$QUARTET_EVENTS_DIR/$(date +%F).jsonl`, `journalctl --user
-u <unit>`, or the project's stated probe. Never wait for `OnCalendar`.
Note: `starbird-mentat.service`'s `ExecStart` invokes
`/home/wabbazzar/code/shipyard/agents/design/runner.sh` directly (the
dev checkout, not a packaged/pinned copy) — editing that sibling repo's
`main` branch is live for the next timer fire with no redeploy step.

### Served app at a port  — APPLIES: yes
- Dev port: `5173` (from `.agents/config.toml` `dev_port`)  ·  Build command:
  `npm run build`  ·  Restart: n/a (adapter-static to GitHub Pages; no
  long-running server process to restart locally — `npm run preview` serves
  the built output for a manual check)
- **Stale-bundle trap:** `npm run preview` serves the *built* `/build`
  output, not live source — rebuild before every check, then
  `curl -s -o /dev/null -w "%{http_code}\n" http://127.0.0.1:<preview-port>/<route>`
  must return 200 before "done".
- If checking a phone/PWA surface, render the changed view at **mobile
  viewport** with a headless browser and actually look at it — desktop-width
  "looks fine" is not evidence. **Kill the headless browser afterward and
  verify with `ps` it's gone** (a forgotten headless browser can poll an
  endpoint for days).

### Event stream / notifications  — APPLIES: yes
If the phase emits events, read the actual JSONL line in
`$QUARTET_EVENTS_DIR/$(date +%F).jsonl`. If it notifies, either confirm one real
`$QUARTET_NOTIFY_CMD` send or deliberately stub it (say which in the Ledger) —
don't spam the owner from a loop.

### Sibling / cross-repo work  — APPLIES: yes

| Repo | Gate command | Hazard |
|---|---|---|
| `~/code/shipyard` (agent infra shared by every project on this host; remote `git@github.com:wabbazzar/shipyard.git`) | `bash -n <script>`; `bash agents/design/runner.sh --self-test` for design-loop changes; no repo-wide CI visible from here — verification is manual per touched script | **merge-is-live**: `starbird-mentat.service` (and every other project's equivalent unit) execs scripts straight out of this checkout's `main` — a merge here is fleet-live at the next timer fire for every project using the quartet, not just starbird. Work on a branch, verify there, then merge. |
| `~/code/wabbazzar-ice` | n/a for read-only use (`$QUARTET_NOTIFY_CMD`, `$QUARTET_EVENTS_DIR` are consumed, not usually edited by starbird tickets) | only touch if a ticket explicitly changes the notify wrapper or event schema — rare; treat as its own live-system change if so |

### Live-system changes (firewall / cron / containers / packages)  — APPLIES: no
Starbird has no firewall/cron/container/package-manager surface of its own
(deploy is GitHub Actions → GitHub Pages; local agent scheduling is the
systemd class above, not cron).

## Traps that have bitten this project  (append-only; starts empty)

The accreted incident history for this project. Every burned session becomes a
line here so no future caller — agent or human — repeats it. This is the
project's **learning surface**: operator corrections and post-mortems land here
as reviewable, revertable edits.

- _(none yet)_
