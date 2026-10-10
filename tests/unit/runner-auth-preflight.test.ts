import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { spawnSync } from 'node:child_process';
import { mkdtempSync, writeFileSync, chmodSync, readFileSync, existsSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';

const ROOT = resolve(__dirname, '../..');
let dir: string;
beforeAll(() => { dir = mkdtempSync(join(tmpdir(), 'preflight-')); });
afterAll(() => { rmSync(dir, { recursive: true, force: true }); });

let n = 0;
function run(authStatus: string, probe: string, timeoutS = '60') {
  const id = ++n;
  const bin = join(dir, `claude${id}`);
  const marker = join(dir, `probe${id}.marker`);
  const log = join(dir, `log${id}`);
  writeFileSync(bin, `#!/usr/bin/env bash
if [ "$1" = "auth" ]; then
${authStatus}
else
touch "${marker}"
${probe}
fi
`);
  chmodSync(bin, 0o755);
  const r = spawnSync('bash', ['-c', 'set -Eeuo pipefail; trap "echo ERRTRAP >&2" ERR; source scripts/lib/claude-preflight.sh; rc=0; claude_preflight_auth || rc=$?; exit $rc'], {
    cwd: ROOT, encoding: 'utf8', timeout: 30000,
    env: { ...process.env, CLAUDE_BIN: bin, MODEL: 'm', PREFLIGHT_OUT: join(dir, `out${id}`), LOG_FILE: log, PREFLIGHT_TIMEOUT_S: timeoutS },
  });
  return { rc: r.status, stderr: r.stderr, probed: existsSync(marker), log: existsSync(log) ? readFileSync(log, 'utf8') : '' };
}
const OK_STATUS = `echo '{"loggedIn": true}'; exit 0`;

describe('claude_preflight_auth', () => {
  it('(a) Not logged in on probe -> 10', () => {
    const r = run(OK_STATUS, `echo '{"is_error":true,"result":"Not logged in · Please run /login"}'; exit 1`);
    expect(r.rc).toBe(10);
    expect(r.stderr).not.toContain('ERRTRAP');
  });
  it('(b) auth status loggedIn:false -> 10 without probe', () => {
    const r = run(`echo '{"loggedIn": false}'; exit 1`, `exit 0`);
    expect(r.rc).toBe(10);
    expect(r.probed).toBe(false);
  });
  it('(c) 529 overloaded -> 0 and WARN logged', () => {
    const r = run(OK_STATUS, `echo 'API Error: 529 {"type":"overloaded_error"}'; exit 1`);
    expect(r.rc).toBe(0);
    expect(r.log).toContain('WARN');
    expect(r.stderr).not.toContain('ERRTRAP');
  });
  it('(d) success -> 0', () => {
    const r = run(OK_STATUS, `echo '{"result":"ok"}'; exit 0`);
    expect(r.rc).toBe(0);
    expect(r.probed).toBe(true);
  });
  it('(e) hang is bounded by timeout -> 0', () => {
    const t0 = Date.now();
    const r = run(OK_STATUS, `exec sleep 1000`, '1');
    expect(r.rc).toBe(0);
    expect(Date.now() - t0).toBeLessThan(15000);
  });
  it('(f) 401 invalid bearer -> 10', () => {
    const r = run(OK_STATUS, `echo 'API Error: 401 Invalid bearer token'; exit 1`);
    expect(r.rc).toBe(10);
  });
});
