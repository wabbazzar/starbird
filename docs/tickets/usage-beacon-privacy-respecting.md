# Ticket: Privacy-respecting usage beacon (page/brand/firm views + /shop resolutions)

**Created:** 2026-07-23
**Owner:** Wesley
**Assignee:** (unassigned)
**Status:** Phase 1 shipped (`a796aec`, 2026-07-23) — `/shop` emits `shop_resolve` usage lines, verified via `collectors.sh` aggregation. Phase 2 (browser beacon) still blocked on Open Decision #1 (see below).
**Refs:** mentat:starbird:278e642d (approved via Daily Dispatch)

---

## Goal

Add aggregate, no-PII usage signal so mentat's design loop and Wesley aren't
guessing about real usage. Two independent sources feed the same sink:

1. **Client-side beacon** in `src/routes/+layout.svelte`: fire-and-forget on
   page, brand, and firm views.
2. **`/shop` skill**: emit one event when it resolves a candidate (safe /
   avoid / block verdict reached).

Both land as lines in `<project>/data/usage/*.jsonl` — the format
`agents/design/collectors.sh` source 4 already reads (see Context). No
per-user tracking, no third-party analytics SaaS, no dashboard — just
aggregate counts collectors.sh can fold into `by_action` / `by_path`.

## Context / pointers (verified 2026-07-23)

- **The expected line shape, read directly from the consumer**
  (`~/code/shipyard/agents/design/collectors.sh`, source 4, "usage beacons"):
  each `data/usage/*.jsonl` line is parsed as `{ts, action, path}` — `jq -R
  'fromjson?' | jq -s '{count, by_action: reduce .action, by_path: reduce
  .path, examples: [...]}'`. Any extra fields are ignored (safe to add more),
  but `ts`/`action`/`path` **must** be present for the aggregation to count
  the line at all — a line missing `action` buckets under `"unknown"`, not
  an error, so a subtly wrong beacon fails silently. Test against the real
  jq pipeline, not just "valid JSON."
- **`data/` is gitignored** (`.gitignore:29`, `/data/`) and currently has
  only `data/fyi-requests.jsonl` (empty) — no `data/usage/` directory exists
  yet. It's created on first write; no scaffolding needed beyond `mkdir -p`
  in whatever writes the first line.
- **Two very different runtime contexts, two different transports:**
  - The `/shop` skill runs **inside a Claude Code session on this host**
    (`wabbazzar-ice`) — it has direct filesystem access. Emitting its event
    is a local `echo '{...}' >> data/usage/$(date +%F).jsonl` (or an
    `mkdir -p` + append), no network involved. Low-risk, no new
    infrastructure.
  - The `+layout.svelte` beacon runs **in an anonymous visitor's browser**,
    on the deployed static site (`starbird42.com`, GitHub Pages —
    confirmed via `CLAUDE.md`'s Deploy section: adapter-static, no SvelteKit
    server). A static site cannot write `data/usage/*.jsonl` itself; the
    browser has to `fetch()` a real network endpoint that writes it. That
    endpoint has to live somewhere reachable from the public internet — this
    is the piece that isn't "just code," see Open Decision below.
- **Caddy precedent for this exact shape already exists on this host.**
  `/etc/caddy/Caddyfile` already runs `api.heatherandwesley.com { reverse_proxy
  localhost:8089 {...} }` plus similar blocks for `api.bopthere.com`,
  `aurora.wabbazzar.com` — i.e., this machine already publicly serves
  several `api.<project>.com`-style small backing services over HTTPS with
  standard security headers. Checked `/etc/caddy/Caddyfile`: **no existing
  block for any `*.starbird42.com` subdomain** — starbird has zero public
  surface on this host today (its whole app is GitHub Pages, no reverse
  proxy through this box). Adding `api.starbird42.com` would be a new site
  block following an established pattern, not a first-of-its-kind exposure
  — but it IS new DNS (a record at the registrar, Porkbun per `CLAUDE.md`
  user-level notes) + a new Caddy site block + a new local service + a new
  open code path that accepts anonymous internet POSTs. That combination is
  exactly the "outward-facing or public (DNS, exposed ports, publishing)"
  class polish-ticket's own contract says never gets a silent default.
- **No existing usage-beacon precedent** in sibling projects (`shredly2`,
  `heatherandwesley`) to copy wholesale — this is new design, not a port.

## Decisions

### Locked (from the approved item, non-negotiable)

| # | Decision |
|---|----------|
| 1 | Aggregate counts only — no per-user identifiers, no IP logging beyond what Caddy already logs for every site, no session/cookie/fingerprint. |
| 2 | No third-party analytics SaaS (Plausible, GA, etc.) — self-hosted only, consistent with the project's anti-surveillance values. |
| 3 | No dashboard in this ticket — landing in `usage/*.jsonl`, readable by the existing `collectors.sh`, is the entire deliverable. |
| 4 | Beacon calls are fire-and-forget: a failed/blocked beacon must never affect the page experience (no loading state, no retry-blocking render). |
| 5 | `/shop` event fires once per resolved candidate (on reaching a safe/avoid/block verdict), not per raw lookup attempt. |

### Open — genuinely blocks Phase 2, not defaulted

| # | Question | Why it can't default |
|---|----------|----------------------|
| 1 | **Expose a new public endpoint (`api.starbird42.com` or similar) on wabbazzar-ice to receive anonymous beacon POSTs from every starbird42.com visitor's browser?** | This is new DNS + a new Caddy site block + a new always-on local service accepting unauthenticated internet input — the definition of the outward-facing/live-system class this project's own gate contract says never gets a silent default. Concretely needs a yes/no plus, if yes: (a) subdomain name, (b) rate-limiting/abuse posture for an endpoint literally anyone can POST to (a spam flood writes into `data/usage/*.jsonl` and pollutes mentat's telemetry — worth at least a body-size cap and a coarse per-IP rate limit even for a "small" collector), (c) whether it also needs basic origin-checking (`Origin: https://starbird42.com` allow-list) so it's not a trivially reusable open beacon for anyone. |

**Until #1 is answered, only Phase 1 (the `/shop` skill event, which needs no
network exposure at all) can be built autonomously.** Phase 2 (the browser
beacon) is where the real design work is, and it's gated on this answer.

---

## Proposed phases (draft — NOT yet hardened; re-run through polish-ticket once Decision 1 is answered)

### Phase 1 — `/shop` skill emits a local usage event (no new infra, buildable now)

- In `scripts/shop-lib.mjs`'s `resolve()` (or the `.claude/commands/shop.md`
  flow that calls it), append one line to
  `data/usage/$(date -u +%F).jsonl`: `{"ts": "<ISO8601>", "action":
  "shop_resolve", "path": "<verdict>"}` (verdict = `safe` / `avoid` /
  `block`, not the candidate name — avoid landing arbitrary user-typed
  product names in a beacon file meant for aggregate counts only; if
  per-candidate detail is wanted later that's a separate, deliberate
  decision, not a side effect of this ticket).
- Verify: run `/shop <anything>` once, confirm a line lands in
  `data/usage/<today>.jsonl`, then run `agents/design/collectors.sh
  --project . --json | jq .sources.usage` (per `.agents/gates.md`) and
  confirm `count` and `by_action.shop_resolve` increment.

### Phase 2 — browser beacon (BLOCKED on Open Decision #1)

- Only scoped once #1 is answered. If yes: add the Caddy site block + local
  ingest service (append-only, size-capped, rate-limited) + the
  `+layout.svelte` `fetch()` calls (page/brand/firm view, `action` values
  distinguishing each, `path` = route/brand-id/firm-id, `keepalive: true`,
  swallow all errors). If no: this ticket ships as Phase 1 only, and
  page/brand/firm view counts stay unmeasured — say so explicitly rather
  than silently dropping the requirement.

---

## Status

Phase 1 shipped (`a796aec`, 2026-07-23) — `/shop`'s `resolve()` appends a
`shop_resolve` line to `data/usage/*.jsonl` per candidate resolution;
verified end-to-end against `agents/design/collectors.sh`'s usage
aggregation (source 4). Phase 2 (the browser-side `+layout.svelte` beacon
for page/brand/firm views) is still queued — it requires Wesley to answer
Open Decision #1 (expose a new public endpoint on wabbazzar-ice, yes/no +
abuse posture) before it can be hardened into an autonomous build, since
that's a live, outward-facing change this project's gate contract
explicitly reserves for a human. Recommend: confirm Decision #1, then
re-run Phase 2 through polish-ticket for the full phased/verified build.
