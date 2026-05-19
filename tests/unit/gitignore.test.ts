import { readFileSync } from 'fs';
import { resolve } from 'path';
import { describe, it, expect } from 'vitest';

const gitignore = readFileSync(resolve(__dirname, '../../.gitignore'), 'utf-8');
const lines = gitignore.split('\n').map((l) => l.trim());

describe('.gitignore', () => {
	it('ignores .worktrees/ so augur runner git-status check stays clean', () => {
		expect(lines).toContain('.worktrees/');
	});

	it('ignores tmp/ so runner output does not dirty the checkout', () => {
		expect(lines).toContain('tmp/');
	});
});
