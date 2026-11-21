import { describe, it, expect } from 'vitest';
import { readFileSync } from 'fs';
import { resolve } from 'path';

describe('pick-strategy.py datetime hygiene', () => {
	const src = readFileSync(
		resolve(process.cwd(), 'scripts/pick-strategy.py'),
		'utf-8'
	);

	it('does not use deprecated datetime.utcnow()', () => {
		expect(src).not.toMatch(/datetime\.utcnow\s*\(/);
	});

	it('imports timezone from datetime module', () => {
		expect(src).toMatch(/from datetime import.*timezone/);
	});

	it('uses timezone-aware datetime.now(timezone.utc)', () => {
		expect(src).toMatch(/datetime\.now\(timezone\.utc\)/);
	});
});
