import { describe, it, expect } from 'vitest';
import { coerceData } from '../../scripts/coerce-data.mjs';

function ownership(overrides: object) {
	return [{ firmId: 'test_firm', stake: 'majority', since: '2020', ...overrides }];
}

describe('coerceData — numeric since/until', () => {
	it('stringifies numeric since', () => {
		const d = { version: 2, firms: [], brands: [{ ownership: ownership({ since: 2017 }) }] };
		const { fixes, data } = coerceData(d);
		expect(fixes).toBe(1);
		expect(data.brands[0].ownership[0].since).toBe('2017');
	});

	it('stringifies numeric until', () => {
		const d = { version: 2, firms: [], brands: [{ ownership: ownership({ since: '2015', until: 2021 }) }] };
		const { fixes, data } = coerceData(d);
		expect(fixes).toBe(1);
		expect(data.brands[0].ownership[0].until).toBe('2021');
	});
});

describe('coerceData — stake normalization', () => {
	it('normalizes "self-owned" → "majority"', () => {
		const d = { version: 2, firms: [], brands: [{ ownership: ownership({ stake: 'self-owned' }) }] };
		const { fixes, data } = coerceData(d);
		expect(fixes).toBe(1);
		expect(data.brands[0].ownership[0].stake).toBe('majority');
	});

	it('normalizes "majority (YYYY-YYYY)" → "former" + sets until', () => {
		const d = { version: 2, firms: [], brands: [{ ownership: ownership({ stake: 'majority (2010-2021)' }) }] };
		const { fixes, data } = coerceData(d);
		expect(fixes).toBeGreaterThanOrEqual(1);
		const own = data.brands[0].ownership[0];
		expect(own.stake).toBe('former');
		expect(own.until).toBe('2021');
	});

	it('normalizes "IP owner" → "post_bankrupt"', () => {
		const d = { version: 2, firms: [], brands: [{ ownership: ownership({ stake: 'IP owner' }) }] };
		const { fixes, data } = coerceData(d);
		expect(fixes).toBe(1);
		expect(data.brands[0].ownership[0].stake).toBe('post_bankrupt');
	});

	it('normalizes "licensee" → "post_bankrupt"', () => {
		const d = { version: 2, firms: [], brands: [{ ownership: ownership({ stake: 'licensee' }) }] };
		const { fixes, data } = coerceData(d);
		expect(fixes).toBe(1);
		expect(data.brands[0].ownership[0].stake).toBe('post_bankrupt');
	});

	it('normalizes "trademark holder" → "post_bankrupt"', () => {
		const d = { version: 2, firms: [], brands: [{ ownership: ownership({ stake: 'trademark holder' }) }] };
		const { fixes, data } = coerceData(d);
		expect(fixes).toBe(1);
		expect(data.brands[0].ownership[0].stake).toBe('post_bankrupt');
	});

	it('leaves valid stakes untouched', () => {
		for (const s of ['majority', 'minority', 'former', 'post_bankrupt']) {
			const d = { version: 2, firms: [], brands: [{ ownership: ownership({ stake: s }) }] };
			const { fixes } = coerceData(d);
			expect(fixes).toBe(0);
		}
	});
});

describe('coerceData — version field', () => {
	it('restores missing version', () => {
		const d = { firms: [], brands: [] };
		const { fixes, data } = coerceData(d);
		expect(fixes).toBe(1);
		expect(data.version).toBe(2);
	});

	it('leaves existing version alone', () => {
		const d = { version: 2, firms: [], brands: [] };
		const { fixes } = coerceData(d);
		expect(fixes).toBe(0);
	});
});
