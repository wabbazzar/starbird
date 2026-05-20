// Tests for scripts/coerce-data-shapes.mjs
// Each case pins a recurring shape error the runner has produced:
//   2026-04-25: since (int), stake "majority (YYYY-YYYY)"
//   2026-04-29: stake "IP owner"
//   2026-05-10: since (int) on 3 brands
//   2026-05-18: since (int), stake "self-owned"

import { describe, it, expect } from 'vitest';
import { coerceOwnership, coerceData } from '../../scripts/coerce-data-shapes.mjs';

describe('coerceOwnership', () => {
	it('stringifies integer since', () => {
		const result = coerceOwnership({ firmId: 'acme', stake: 'majority', since: 2010 as any });
		expect(result.since).toBe('2010');
		expect(typeof result.since).toBe('string');
	});

	it('stringifies integer until', () => {
		const result = coerceOwnership({ firmId: 'acme', stake: 'former', until: 2021 as any });
		expect(result.until).toBe('2021');
		expect(typeof result.until).toBe('string');
	});

	it('converts stake "self-owned" → "majority"', () => {
		const result = coerceOwnership({ firmId: 'acme', stake: 'self-owned' as any });
		expect(result.stake).toBe('majority');
	});

	it('converts stake "IP owner" → "post_bankrupt"', () => {
		const result = coerceOwnership({ firmId: 'acme', stake: 'IP owner' as any });
		expect(result.stake).toBe('post_bankrupt');
	});

	it('converts stake "licensee" → "post_bankrupt"', () => {
		const result = coerceOwnership({ firmId: 'acme', stake: 'licensee' as any });
		expect(result.stake).toBe('post_bankrupt');
	});

	it('converts stake "trademark holder" → "post_bankrupt"', () => {
		const result = coerceOwnership({ firmId: 'acme', stake: 'trademark holder' as any });
		expect(result.stake).toBe('post_bankrupt');
	});

	it('converts stake "majority (2010-2021)" → {stake:"former", since:"2010", until:"2021"}', () => {
		const result = coerceOwnership({ firmId: 'acme', stake: 'majority (2010-2021)' as any });
		expect(result.stake).toBe('former');
		expect(result.since).toBe('2010');
		expect(result.until).toBe('2021');
	});

	it('converts stake "majority (2010-2021)" preserving existing since if already set', () => {
		const result = coerceOwnership({
			firmId: 'acme',
			stake: 'majority (2010-2021)' as any,
			since: '2010'
		});
		expect(result.stake).toBe('former');
		expect(result.since).toBe('2010');
		expect(result.until).toBe('2021');
	});

	it('leaves valid ownership unchanged', () => {
		const input = { firmId: 'acme', stake: 'majority' as const, since: '2015' };
		const result = coerceOwnership(input);
		expect(result).toEqual(input);
	});

	it('leaves valid former ownership unchanged', () => {
		const input = { firmId: 'acme', stake: 'former' as const, since: '2010', until: '2019' };
		const result = coerceOwnership(input);
		expect(result).toEqual(input);
	});
});

describe('coerceData', () => {
	it('coerces all ownerships in a full data structure', () => {
		const data = {
			version: 2,
			firms: [{ id: 'acme', name: 'Acme' }],
			brands: [
				{
					id: 'widget',
					ownership: [
						{ firmId: 'acme', stake: 'majority', since: 2010 },
						{ firmId: 'acme', stake: 'self-owned' }
					]
				}
			]
		};
		const result = coerceData(data as any);
		expect(result.brands[0].ownership[0].since).toBe('2010');
		expect(result.brands[0].ownership[1].stake).toBe('majority');
	});

	it('returns the same structure if nothing needs coercion', () => {
		const data = {
			version: 2,
			firms: [],
			brands: [
				{
					id: 'widget',
					ownership: [{ firmId: 'acme', stake: 'majority', since: '2010' }]
				}
			]
		};
		const result = coerceData(data as any);
		expect(result.brands[0].ownership[0]).toEqual({ firmId: 'acme', stake: 'majority', since: '2010' });
	});
});
