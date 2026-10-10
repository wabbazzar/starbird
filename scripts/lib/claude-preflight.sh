#!/usr/bin/env bash
# Sourced library: no top-level side effects. Safe under set -Eeuo pipefail.
# claude_preflight_auth: returns 0 (ok / non-auth failure, fail open) or 10 (auth expired).
# Env: CLAUDE_BIN, MODEL, PREFLIGHT_OUT (required); LOG_FILE, PREFLIGHT_TIMEOUT_S (optional, default 60).
claude_preflight_auth() {
  local bin="${CLAUDE_BIN:?CLAUDE_BIN required}" model="${MODEL:-}" out="${PREFLIGHT_OUT:?PREFLIGHT_OUT required}"
  local t="${PREFLIGHT_TIMEOUT_S:-60}" t1=20 rc=0 st=""
  local re='Not logged in|Please run /login|Failed to authenticate|API Error: 401|Invalid bearer token|"api_error_status":401'
  [ "$t" -lt "$t1" ] && t1="$t"

  # Layer 1: free local check.
  st="$(timeout "$t1" "$bin" auth status 2>&1)" || rc=$?
  if [ "$rc" -ne 0 ] && printf '%s' "$st" | grep -Eq '"loggedIn":[[:space:]]*false'; then
    return 10
  fi

  # Layer 2: live no-op probe.
  rc=0
  timeout "$t" "$bin" -p "ok" --model "$model" --max-turns 1 --output-format json >"$out" 2>&1 || rc=$?
  [ "$rc" -eq 0 ] && return 0
  if grep -Eq "$re" "$out" 2>/dev/null; then
    return 10
  fi
  local hit
  hit="$(grep -Eo '"?(api_error_status|subtype|result)"?:[^,}]{0,120}|[A-Za-z ]*(overloaded|529|timeout)[^"]{0,80}' "$out" 2>/dev/null | head -n1)" || true
  [ -n "$hit" ] || hit="exit=$rc (no match line)"
  if [ -n "${LOG_FILE:-}" ]; then
    printf '%s WARN preflight probe failed (non-auth, failing open) rc=%s: %s\n' "$(date -u +%FT%TZ)" "$rc" "$hit" >>"$LOG_FILE" || true
  fi
  return 0
}
