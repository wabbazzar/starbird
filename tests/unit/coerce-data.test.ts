import { describe, it, expect } from 'vitest';
// @ts-ignore — .mjs, not in tsconfig includes
import { coerceData } from '../../scripts/coerce-data.mjs';

describe('coerceData', () => {
	it('converts numeric since/until to strings', () => {
		const data = { brands: [{ ownership: [{ firmId: 'acme', stake: 'majority', since: 2010 }] }] };
		const { fixes } = coerceData(data);
		expect(fixes).toBe(1);
		expect(data.brands[0].ownership[0].since).toBe('2010');
	});

	it('coerces stake "self-owned" to "majority"', () => {
		const data = { brands: [{ ownership: [{ firmId: 'acme', stake: 'self-owned' }] }] };
		const { fixes } = coerceData(data);
		expect(fixes).toBe(1);
		expect(data.brands[0].ownership[0].stake).toBe('majority');
	});

	it('coerces stake "majority (YYYY-YYYY)" to "former" and sets until', () => {
		const data = { brands: [{ ownership: [{ firmId: 'acme', stake: 'majority (2010-2021)' }] }] };
		const { fixes } = coerceData(data);
		expect(fixes).toBe(1);
		expect(data.brands[0].ownership[0].stake).toBe('former');
		expect(data.brands[0].ownership[0].until).toBe('2021');
	});

	it('coerces stake "IP owner" to "post_bankrupt"', () => {
		const data = { brands: [{ ownership: [{ firmId: 'acme', stake: 'IP owner' }] }] };
		const { fixes } = coerceData(data);
		expect(fixes).toBe(1);
		expect(data.brands[0].ownership[0].stake).toBe('post_bankrupt');
	});

	it('coerces stake "licensee" to "post_bankrupt"', () => {
		const data = { brands: [{ ownership: [{ firmId: 'acme', stake: 'licensee' }] }] };
		const { fixes } = coerceData(data);
		expect(fixes).toBe(1);
		expect(data.brands[0].ownership[0].stake).toBe('post_bankrupt');
	});

	it('coerces stake "trademark holder" to "post_bankrupt"', () => {
		const data = { brands: [{ ownership: [{ firmId: 'acme', stake: 'trademark holder' }] }] };
		const { fixes } = coerceData(data);
		expect(fixes).toBe(1);
		expect(data.brands[0].ownership[0].stake).toBe('post_bankrupt');
	});

	it('leaves already-valid data untouched', () => {
		const data = {
			brands: [{ ownership: [{ firmId: 'acme', stake: 'majority', since: '2010' }] }]
		};
		const { fixes } = coerceData(data);
		expect(fixes).toBe(0);
	});

	it('handles brands with no ownership array', () => {
		const data = { brands: [{ id: 'empty' }] };
		const { fixes } = coerceData(data);
		expect(fixes).toBe(0);
	});

	it('handles empty brands array', () => {
		const data = { brands: [] };
		const { fixes } = coerceData(data);
		expect(fixes).toBe(0);
	});
});
