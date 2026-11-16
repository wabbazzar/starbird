// Executes a sed-rewritten copy of scripts/starbird-runner.sh against hermetic
// local bare-remote fixtures (see .agents/gates.md Traps). No model, network,
// Signal or live-data access: claude/npx/notify/log_event are all stubs.
import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { spawnSync } from 'node:child_process';
import { mkdtempSync, mkdirSync, writeFileSync, chmodSync, readFileSync, existsSync, rmSync, copyFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve, dirname } from 'node:path';

const ROOT = resolve(__dirname, '../..');
const RUNNER = join(ROOT, 'scripts/starbird-runner.sh');
let base: string;
beforeAll(() => { base = mkdtempSync(join(tmpdir(), 'push-fail-')); });
afterAll(() => { rmSync(base, { recursive: true, force: true }); });

const GIT_ENV = {
  GIT_AUTHOR_NAME: 't', GIT_AUTHOR_EMAIL: 't@example.invalid',
  GIT_COMMITTER_NAME: 't', GIT_COMMITTER_EMAIL: 't@example.invalid',
  GIT_CONFIG_NOSYSTEM: '1', GIT_TERMINAL_PROMPT: '0',
};
function git(cwd: string, ...args: string[]) {
  const r = spawnSync('git', args, { cwd, encoding: 'utf8', env: { ...process.env, ...GIT_ENV } });
  if (r.status !== 0) throw new Error(`git ${args.join(' ')} failed: ${r.stderr}`);
  return r.stdout.trim();
}
function put(path: string, content: string, mode = 0o644) {
  mkdirSync(dirname(path), { recursive: true });
  writeFileSync(path, content);
  chmodSync(path, mode);
}

type Opts = { gitignoreHasWorktrees: boolean; diverge: boolean; mode?: 'daily' | 'dry-run'; notifyFails?: boolean };
let n = 0;

function fixture(o: Opts) {
  const d = join(base, `f${++n}`);
  const remote = join(d, 'remote.git');
  const seed = join(d, 'seed');
  const work = join(d, 'work'); // STARBIRD_DIR
  const peer = join(d, 'peer');
  mkdirSync(d, { recursive: true });
  git(d, 'init', '--bare', '-b', 'main', remote);
  git(d, 'init', '-b', 'main', seed);
  git(seed, 'config', 'commit.gpgsign', 'false');
  const gi = 'tmp/\n' + (o.gitignoreHasWorktrees ? '.worktrees/\n' : '');
  put(join(seed, '.gitignore'), gi);
  put(join(seed, 'static/data.json'), '{"v":0}\n');
  put(join(seed, 'static/blog.json'), '{}\n');
  put(join(seed, 'static/cards/.gitkeep'), '');
  put(join(seed, 'static/posts/.gitkeep'), '');
  put(join(seed, 'scripts/starbird-runner-prompt.md'), 'prompt\n');
  mkdirSync(join(seed, 'scripts/lib'), { recursive: true });
  copyFileSync(join(ROOT, 'scripts/lib/claude-preflight.sh'), join(seed, 'scripts/lib/claude-preflight.sh'));
  put(join(seed, 'scripts/update-strategy-scores.py'), 'pass\n');
  put(join(seed, 'scripts/pick-strategy.py'), 'print("stub_strategy")\n');
  put(join(seed, 'scripts/labels.py'), 'print("x")\n');
  put(join(seed, 'scripts/compute-run-metrics.py'),
    'import json\nprint(json.dumps({"new_entities":2,"new_firms":1,"new_brands":1,"new_firm_ids":["a"],"new_brand_ids":["b"],"evidence_coverage":1.0}))\n');
  put(join(seed, 'scripts/append-blog-post.py'), 'import sys\nsys.stdin.read()\n');
  put(join(seed, 'scripts/generate-card-images.py'), 'pass\n');
  put(join(seed, 'scripts/coerce-data.mjs'), '// noop\n');
  put(join(seed, 'scripts/validate-data.mjs'), '// noop\n');
  git(seed, 'add', '-A'); git(seed, 'commit', '-m', 'seed');
  git(seed, 'remote', 'add', 'origin', remote);
  git(seed, 'push', 'origin', 'main');
  git(d, 'clone', remote, work);
  git(d, 'clone', remote, peer);
  for (const r of [work, peer]) git(r, 'config', 'commit.gpgsign', 'false');
  if (o.diverge) {
    // runner clone: one local-only commit; peer: a different remote-only commit
    put(join(work, 'local-only.txt'), 'local\n'); git(work, 'add', 'local-only.txt'); git(work, 'commit', '-m', 'local only');
    put(join(peer, 'remote-only.txt'), 'remote\n'); git(peer, 'add', 'remote-only.txt'); git(peer, 'commit', '-m', 'remote only');
    git(peer, 'push', 'origin', 'main');
  }
  // stubs
  const bin = join(d, 'bin');
  const events = join(d, 'events.jsonl');
  const notifyTitles = join(d, 'notify-titles.txt');
  const notifyBodies = join(d, 'notify-bodies.txt');
  put(join(bin, 'npx'), '#!/bin/bash\nexit 0\n', 0o755);
  put(join(bin, 'claude'), `#!/bin/bash
if [ "$1" = auth ]; then echo '{"loggedIn": true}'; exit 0; fi
main=0; for a in "$@"; do [ "$a" = --dangerously-skip-permissions ] && main=1; done
if [ "$main" = 1 ]; then printf '{"v":%s}\\n' "$RANDOM" > static/data.json; fi
echo '{"result":"stub","total_cost_usd":0.1,"usage":{}}'
`, 0o755);
  put(join(bin, 'log_event.sh'), `#!/bin/bash\necho "$*" >> "${events}"\n`, 0o755);
  put(join(bin, 'notify.sh'), `#!/bin/bash\necho "$1" >> "${notifyTitles}"\necho "$2" >> "${notifyBodies}"\n${o.notifyFails ? 'exit 1' : 'exit 0'}\n`, 0o755);
  // sed-rewritten runner copy (the three hard-coded paths)
  const script = join(d, 'runner.sh');
  const src = readFileSync(RUNNER, 'utf8')
    .replace(/^STARBIRD_DIR=.*$/m, `STARBIRD_DIR="${work}"`)
    .replace(/^NOTIFY=.*$/m, `NOTIFY="${join(bin, 'notify.sh')}"`)
    .replace(/^LOG_EVENT=.*$/m, `LOG_EVENT="${join(bin, 'log_event.sh')}"`);
  writeFileSync(script, src);
  // safety: all three paths must point inside the fixture
  expect(src).toContain(`STARBIRD_DIR="${work}"`);
  expect(src).not.toMatch(/^(STARBIRD_DIR|NOTIFY|LOG_EVENT)="\/home\//m);
  const env: NodeJS.ProcessEnv = {
    ...process.env, ...GIT_ENV, PATH: `${bin}:${process.env.PATH}`,
    CLAUDE_BIN: join(bin, 'claude'), FORCE_STRATEGY: 'stub_strategy', TARGET_PAIRS: '1',
  };
  delete env.QUARTET_NOTIFY_CMD;
  const r = spawnSync('bash', [script, o.mode ?? 'daily'], { cwd: d, encoding: 'utf8', env, timeout: 90000 });
  const lines = (p: string) => (existsSync(p) ? readFileSync(p, 'utf8').split('\n').filter(Boolean) : []);
  const logPath = join(work, 'tmp/starbird-runner-last-run.log');
  return {
    status: r.status, stderr: r.stderr, work, remote,
    jobEnds: lines(events).filter((l) => l.includes(' job.end ')),
    titles: lines(notifyTitles), bodies: readFileSync(existsSync(notifyBodies) ? notifyBodies : '/dev/null', 'utf8'),
    log: existsSync(logPath) ? readFileSync(logPath, 'utf8') : '',
    localHead: git(work, 'rev-parse', 'HEAD'), remoteHead: git(remote, 'rev-parse', 'main'),
    dataJson: readFileSync(join(work, 'static/data.json'), 'utf8'),
    committedData: git(work, 'show', 'HEAD:static/data.json'),
    ahead: git(work, 'log', '--format=%s', 'origin/main..HEAD').split('\n').filter(Boolean),
  };
}

describe('runner push failure visibility', () => {
  it('gitignore self-repair push rejected -> fail push_failed, one event, one page, commit kept', () => {
    const r = fixture({ gitignoreHasWorktrees: false, diverge: true });
    expect(r.status).not.toBe(0);
    expect(r.jobEnds).toHaveLength(1);
    expect(r.jobEnds[0]).toMatch(/status=fail/);
    expect(r.jobEnds[0]).toMatch(/reason=push_failed/);
    expect(r.jobEnds[0]).toMatch(/stage=gitignore_repair/);
    expect(r.jobEnds[0]).not.toMatch(/exit_code=0( |$)/);
    expect(r.titles).toHaveLength(1);
    expect(r.titles[0]).toMatch(/FAILED/);
    expect(r.log).not.toContain('committed + pushed');
    expect(r.log).not.toMatch(/Done\. exit=0/);
    expect(r.log).toMatch(/rejected|non-fast-forward|fetch first/);
    expect(r.ahead).toContain('chore: gitignore .worktrees/ (runner self-repair)');
    expect(r.remoteHead).not.toBe(r.localHead);
  });

  it('daily publish push rejected -> fail push_failed, one event, one page, commit kept', () => {
    const r = fixture({ gitignoreHasWorktrees: true, diverge: true });
    expect(r.status).not.toBe(0);
    expect(r.jobEnds).toHaveLength(1);
    expect(r.jobEnds[0]).toMatch(/status=fail/);
    expect(r.jobEnds[0]).toMatch(/reason=push_failed/);
    expect(r.jobEnds[0]).toMatch(/stage=daily_publish/);
    expect(r.jobEnds[0]).not.toMatch(/exit_code=0( |$)/);
    expect(r.titles).toHaveLength(1);
    expect(r.titles[0]).toMatch(/FAILED/);
    expect(r.log).not.toMatch(/Done\. exit=0/);
    expect(r.log).toMatch(/rejected|non-fast-forward|fetch first/);
    expect(r.ahead.some((s) => s.startsWith('Runner: 2 entity(ies)'))).toBe(true);
    expect(r.committedData).toBe(r.dataJson.trim()); // research bytes retained in the local commit
    expect(r.remoteHead).not.toBe(r.localHead);
  });

  it('a failing notifier never masks the nonzero exit', () => {
    const r = fixture({ gitignoreHasWorktrees: true, diverge: true, notifyFails: true });
    expect(r.status).not.toBe(0);
    expect(r.jobEnds).toHaveLength(1);
    expect(r.jobEnds[0]).toMatch(/reason=push_failed/);
  });

  it('control: successful daily push -> normal ok outcome, remote advanced', () => {
    const r = fixture({ gitignoreHasWorktrees: true, diverge: false });
    expect(r.status).toBe(0);
    expect(r.jobEnds).toHaveLength(1);
    expect(r.jobEnds[0]).toMatch(/status=ok/);
    expect(r.jobEnds[0]).toMatch(/exit_code=0/);
    expect(r.log).toMatch(/Done\. exit=0 new=2/);
    expect(r.titles).toEqual(['Starbird Runner — Daily']);
    expect(r.remoteHead).toBe(r.localHead);
  });

  it('control: successful self-repair push still reports pushed and continues', () => {
    const r = fixture({ gitignoreHasWorktrees: false, diverge: false });
    expect(r.status).toBe(0);
    expect(r.log).toContain('committed + pushed .gitignore patch');
    expect(r.jobEnds).toHaveLength(1);
    expect(r.jobEnds[0]).toMatch(/status=ok/);
    expect(r.remoteHead).toBe(r.localHead);
  });

  it('control: dry-run does not publish research changes', () => {
    const r = fixture({ gitignoreHasWorktrees: true, diverge: false, mode: 'dry-run' });
    expect(r.status).toBe(0);
    expect(r.jobEnds).toHaveLength(1);
    expect(r.jobEnds[0]).toMatch(/status=ok/);
    expect(r.ahead).toEqual([]);
    expect(r.remoteHead).toBe(r.localHead);
    expect(r.titles).toEqual(['Starbird Runner — Dry Run']);
  });
});
