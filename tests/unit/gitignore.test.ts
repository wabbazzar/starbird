import { readFileSync } from 'fs';
import { resolve } from 'path';
import { describe, test, expect } from 'vitest';

describe('.gitignore', () => {
	const gitignore = readFileSync(resolve(__dirname, '../../.gitignore'), 'utf8');

	test('excludes .worktrees/ so augur dirty-checkout check passes', () => {
		expect(gitignore).toMatch(/^\.worktrees\/$/m);
	});

	test('excludes tmp/ runtime output', () => {
		expect(gitignore).toMatch(/^tmp\/$/m);
	});
});
