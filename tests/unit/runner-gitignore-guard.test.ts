import { describe, it, expect } from 'vitest';
import { readFileSync } from 'fs';
import { resolve } from 'path';

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

	it('commits and pushes the patch in daily mode', () => {
		expect(source).toMatch(/git add \.gitignore/);
		expect(source).toMatch(/git commit.*gitignore.*self-repair/s);
	});
});
