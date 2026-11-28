import { describe, it, expect } from 'vitest';
import { readFileSync } from 'fs';
import { resolve } from 'path';

// Regression test: blog/[id]/+page.svelte must use $derived() for
// the three constants that reference the `data` prop. Without $derived(),
// Svelte 5 emits state_referenced_locally warnings and the values would
// only capture data at component init time rather than reactively.
describe('blog/[id]/+page.svelte — $derived usage', () => {
	const src = readFileSync(
		resolve(process.cwd(), 'src/routes/blog/[id]/+page.svelte'),
		'utf-8'
	);

	it('ogImage is declared with $derived()', () => {
		expect(src).toMatch(/const ogImage\s*=\s*\$derived\(/);
	});

	it('postUrl is declared with $derived()', () => {
		expect(src).toMatch(/const postUrl\s*=\s*\$derived\(/);
	});

	it('appUrl is declared with $derived()', () => {
		expect(src).toMatch(/const appUrl\s*=\s*\$derived\(/);
	});
});
