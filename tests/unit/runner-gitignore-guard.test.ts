import { describe, it, expect } from 'vitest';
import { readFileSync } from 'fs';
import { resolve } from 'path';

// Regression: .worktrees/ must be in .gitignore so augur's live-mode
// dirty-checkout pre-flight doesn't abort when a worktree is active.
describe('.gitignore worktree entry', () => {
	const gitignorePath = resolve(process.cwd(), '.gitignore');
	const content = readFileSync(gitignorePath, 'utf-8');

	it('contains .worktrees/ so augur live-mode pre-flight sees a clean git status', () => {
		const lines = content.split('\n').map((l) => l.trim());
		expect(lines).toContain('.worktrees/');
	});
});

// Regression test for incident 9b3e2cf5: augur aborted because .worktrees/
// was missing from .gitignore. runner.sh now self-repairs the entry.
describe('runner.sh gitignore self-repair guard', () => {
	const runnerPath = resolve(process.cwd(), 'scripts/starbird-runner.sh');
	const source = readFileSync(runnerPath, 'utf-8');

	it('checks whether .worktrees/ is in .gitignore', () => {
		expect(source).toMatch(/grep.*\.worktrees.*\.gitignore/s);
	});

	it('appends .worktrees/ to .gitignore when missing', () => {
		const appendBlock = source.match(/printf.*\.worktrees.*>>.*\.gitignore/s);
		expect(appendBlock).not.toBeNull();
	});

	it('commits and pushes the patch unconditionally (any mode)', () => {
		// Must commit in any mode — not just daily — so the fix lands before
		// augur's 03:30 timer fires, which runs before the 07:05 daily runner.
		const guardBlock = source.match(/if.*grep.*\.worktrees.*\.gitignore[\s\S]*?fi/m);
		expect(guardBlock).not.toBeNull();
		const blockStr = guardBlock![0];
		expect(blockStr).toMatch(/git add \.gitignore/);
		expect(blockStr).toMatch(/git commit.*gitignore.*self-repair/s);
		// The commit must NOT be gated on MODE=daily
		expect(blockStr).not.toMatch(/\$MODE.*=.*daily/);
	});
});
