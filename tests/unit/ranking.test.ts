import { describe, expect, it } from 'vitest';
import {
	brandImpactScore,
	buildBrandScoreIndex,
	firmEffectiveScore,
	indexFirms,
	INHERIT_DISCOUNT,
	SCOPE_CAP,
	SCOPE_FLOOR,
	STAKE_DISCOUNT
} from '$lib/ranking';
import type { Brand, Firm, FirmRole, FirmScope, Ownership } from '$lib/types';

function firm(over: Partial<Firm> & { id: string; harmScore: number }): Firm {
	return {
		name: over.id,
		aum: 'N/A',
		aumVal: 0,
		summary: 's',
		brands: [],
		layoffs: 'N/A',
		notableBk: 'N/A',
		source: 'https://example.com',
		cats: [],
		harms: [],
		aligns: [],
		...over
	} as Firm;
}

function brand(id: string, ownership: Ownership[]): Brand {
	return {
		id,
		avoid: id,
		ownership,
		cat: 'retail',
		alts: [],
		why: 'w',
		harms: [],
		aligns: []
	} as Brand;
}

const own = (firmId: string, stake: Ownership['stake'] = 'majority'): Ownership => ({
	firmId,
	stake
});

describe('firmEffectiveScore — scope cap', () => {
	const cases: Array<[FirmScope, number, number]> = [
		// scope, raw score, expected effective
		['narrow', 83, 65], // the single-contract-LLC case that motivated this
		['narrow', 52, 52], // under the cap: untouched
		['single_company', 93, 79],
		['single_company', 70, 70],
		['multi_company', 97, 94],
		['systemic', 98, 98]
	];
	it.each(cases)('%s raw %i -> %i', (scope, raw, expected) => {
		expect(firmEffectiveScore(firm({ id: 'f', harmScore: raw, scope }))).toBe(expected);
	});

	it('never exceeds the declared cap for any scope', () => {
		for (const [scope, cap] of Object.entries(SCOPE_CAP)) {
			const f = firm({ id: 'f', harmScore: 100, scope: scope as FirmScope });
			expect(firmEffectiveScore(f)).toBe(cap);
		}
	});
});

describe('firmEffectiveScore — scope floor', () => {
	it('lifts a wide-reach firm out of the Significant band', () => {
		// Blackstone: $1T AUM scored 60, below the firm median.
		expect(firmEffectiveScore(firm({ id: 'blackstone', harmScore: 60, scope: 'systemic' }))).toBe(
			70
		);
		// BlackRock: $10T scored 55.
		expect(firmEffectiveScore(firm({ id: 'blackrock', harmScore: 55, scope: 'systemic' }))).toBe(
			70
		);
		expect(firmEffectiveScore(firm({ id: 'x', harmScore: 55, scope: 'multi_company' }))).toBe(60);
	});

	it('leaves narrow and single_company unfloored', () => {
		expect(SCOPE_FLOOR.narrow).toBeUndefined();
		expect(SCOPE_FLOOR.single_company).toBeUndefined();
		expect(firmEffectiveScore(firm({ id: 'x', harmScore: 8, scope: 'narrow' }))).toBe(8);
		// Aligned firms must not be dragged up off the low end.
		expect(firmEffectiveScore(firm({ id: 'patagonia', harmScore: 7, scope: 'single_company' }))).toBe(
			7
		);
	});
});

describe('firmEffectiveScore — missing fields', () => {
	it('falls back to single_company: no floor, cap 79', () => {
		expect(firmEffectiveScore(firm({ id: 'x', harmScore: 70 }))).toBe(70);
		expect(firmEffectiveScore(firm({ id: 'x', harmScore: 90 }))).toBe(79);
	});

	it('returns 0 for a non-numeric score', () => {
		expect(firmEffectiveScore(firm({ id: 'x', harmScore: undefined as never }))).toBe(0);
	});
});

describe('brandImpactScore — role-aware inheritance', () => {
	const cases: Array<[FirmRole, number]> = [
		['actor', 90 - INHERIT_DISCOUNT.actor],
		['both', 90 - INHERIT_DISCOUNT.both],
		['owner', 90 - INHERIT_DISCOUNT.owner]
	];
	it.each(cases)('role %s -> %i', (role, expected) => {
		const f = firm({ id: 'f', harmScore: 90, scope: 'multi_company', role });
		const idx = indexFirms([f]);
		expect(brandImpactScore(brand('b', [own('f')]), idx)).toBe(expected);
	});

	it('a self-owned actor brand keeps the full firm score', () => {
		// Palantir is its own firm and its own brand — no haircut.
		const f = firm({ id: 'palantir', harmScore: 98, scope: 'systemic', role: 'actor' });
		expect(brandImpactScore(brand('palantir', [own('palantir')]), indexFirms([f]))).toBe(98);
	});

	it('a PE victim ranks well below its owner', () => {
		// The Container Store under Leonard Green: 92 under the old flat 5-point
		// rule, which put a housewares retailer above BlackRock.
		const lg = firm({
			id: 'leonard_green_and_partners',
			harmScore: 97,
			aumVal: 85,
			scope: 'systemic',
			role: 'owner'
		});
		const idx = indexFirms([lg]);
		const score = brandImpactScore(brand('container_store', [own(lg.id)]), idx);
		expect(score).toBe(97 - INHERIT_DISCOUNT.owner);
		expect(score).toBeLessThan(firmEffectiveScore(lg));
	});
});

describe('brandImpactScore — stake discount', () => {
	const f = firm({ id: 'f', harmScore: 80, scope: 'multi_company', role: 'actor' });
	const idx = indexFirms([f]);
	const cases: Array<[Ownership['stake'], number]> = [
		['majority', 80 - STAKE_DISCOUNT.majority],
		['minority', 80 - STAKE_DISCOUNT.minority],
		['former', 80 - STAKE_DISCOUNT.former],
		['post_bankrupt', 80 - STAKE_DISCOUNT.post_bankrupt]
	];
	it.each(cases)('stake %s -> %i', (stake, expected) => {
		expect(brandImpactScore(brand('b', [own('f', stake)]), idx)).toBe(expected);
	});
});

describe('brandImpactScore — edges', () => {
	it('takes the max across multiple owners, not the first', () => {
		const weak = firm({ id: 'weak', harmScore: 60, scope: 'multi_company', role: 'owner' });
		const strong = firm({ id: 'strong', harmScore: 90, scope: 'multi_company', role: 'actor' });
		const idx = indexFirms([weak, strong]);
		expect(brandImpactScore(brand('b', [own('weak'), own('strong')]), idx)).toBe(90);
	});

	it('a high-discount owner can lose to a lower-scored actor', () => {
		const owner = firm({ id: 'pe', harmScore: 90, scope: 'multi_company', role: 'owner' });
		const actor = firm({ id: 'op', harmScore: 70, scope: 'multi_company', role: 'actor' });
		const idx = indexFirms([owner, actor]);
		expect(brandImpactScore(brand('b', [own('pe'), own('op')]), idx)).toBe(70);
	});

	it('ignores unknown firmIds and never returns a negative score', () => {
		const tiny = firm({ id: 'tiny', harmScore: 5, scope: 'multi_company', role: 'owner' });
		const idx = indexFirms([tiny]);
		expect(brandImpactScore(brand('b', [own('ghost')]), idx)).toBe(0);
		// 5 floored to 60 by multi_company, minus 25 -> 35; still non-negative.
		expect(brandImpactScore(brand('b', [own('tiny')]), idx)).toBe(35);
	});

	it('buildBrandScoreIndex agrees with brandImpactScore per brand', () => {
		const f = firm({ id: 'f', harmScore: 88, scope: 'multi_company', role: 'both' });
		const idx = indexFirms([f]);
		const brands = [brand('a', [own('f')]), brand('b', [own('f', 'former')])];
		const built = buildBrandScoreIndex(brands, idx);
		for (const b of brands) expect(built.get(b.id)).toBe(brandImpactScore(b, idx));
	});
});
