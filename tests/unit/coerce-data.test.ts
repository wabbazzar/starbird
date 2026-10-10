import { describe, it, expect } from 'vitest';
import { applyCoercions } from '../../scripts/coerce-data.mjs';

// Minimal brand fixture for testing ownership coercions
function brand(stake: string, since?: string | number, until?: string | number) {
	return {
		id: 'test',
		ownership: [{ firmId: 'test-firm', stake, ...(since !== undefined ? { since } : {}), ...(until !== undefined ? { until } : {}) }]
	};
}

describe('coerce-data applyCoercions', () => {
	it('no-ops on already-valid data', () => {
		const data = { version: 2, firms: [], brands: [brand('majority', '2020')] };
		const { fixes } = applyCoercions(structuredClone(data));
		expect(fixes).toBe(0);
	});

	it('restores missing version to 2', () => {
		const data = { firms: [], brands: [] } as Record<string, unknown>;
		const { data: out, fixes } = applyCoercions(data);
		expect(fixes).toBeGreaterThan(0);
		expect(out.version).toBe(2);
	});

	it('stringifies numeric since', () => {
		const data = { version: 2, firms: [], brands: [brand('majority', 2010)] };
		const { data: out, fixes } = applyCoercions(data);
		expect(fixes).toBeGreaterThan(0);
		expect(out.brands[0].ownership[0].since).toBe('2010');
	});

	it('stringifies numeric until', () => {
		const data = { version: 2, firms: [], brands: [brand('former', '2010', 2021)] };
		const { data: out, fixes } = applyCoercions(data);
		expect(fixes).toBeGreaterThan(0);
		expect(out.brands[0].ownership[0].until).toBe('2021');
	});

	it('coerces stake "self-owned" → "majority"', () => {
		const data = { version: 2, firms: [], brands: [brand('self-owned', '2020')] };
		const { data: out, fixes } = applyCoercions(data);
		expect(fixes).toBeGreaterThan(0);
		expect(out.brands[0].ownership[0].stake).toBe('majority');
	});

	it('coerces stake "majority (2010-2021)" → "former" with until set', () => {
		const data = { version: 2, firms: [], brands: [brand('majority (2010-2021)', '2010')] };
		const { data: out, fixes } = applyCoercions(data);
		expect(fixes).toBeGreaterThan(0);
		expect(out.brands[0].ownership[0].stake).toBe('former');
		expect(out.brands[0].ownership[0].until).toBe('2021');
	});

	it('coerces stake "IP owner" → "post_bankrupt"', () => {
		const data = { version: 2, firms: [], brands: [brand('IP owner', '2020')] };
		const { data: out, fixes } = applyCoercions(data);
		expect(fixes).toBeGreaterThan(0);
		expect(out.brands[0].ownership[0].stake).toBe('post_bankrupt');
	});

	it('coerces stake "licensee" → "post_bankrupt"', () => {
		const data = { version: 2, firms: [], brands: [brand('licensee', '2020')] };
		const { data: out, fixes } = applyCoercions(data);
		expect(fixes).toBeGreaterThan(0);
		expect(out.brands[0].ownership[0].stake).toBe('post_bankrupt');
	});

	it('coerces stake "trademark holder" → "post_bankrupt"', () => {
		const data = { version: 2, firms: [], brands: [brand('trademark holder', '2020')] };
		const { data: out, fixes } = applyCoercions(data);
		expect(fixes).toBeGreaterThan(0);
		expect(out.brands[0].ownership[0].stake).toBe('post_bankrupt');
	});

	it('handles multiple coercions in one pass', () => {
		const data = {
			version: 2,
			firms: [],
			brands: [
				brand('self-owned', 2019),
				brand('majority (2015-2022)', '2015'),
				brand('IP owner', '2020')
			]
		};
		const { data: out, fixes } = applyCoercions(data);
		expect(fixes).toBe(4); // 1 numeric since + 1 self-owned + 1 majority-range + 1 IP owner
		expect(out.brands[0].ownership[0].stake).toBe('majority');
		expect(out.brands[0].ownership[0].since).toBe('2019');
		expect(out.brands[1].ownership[0].stake).toBe('former');
		expect(out.brands[1].ownership[0].until).toBe('2022');
		expect(out.brands[2].ownership[0].stake).toBe('post_bankrupt');
	});
});
