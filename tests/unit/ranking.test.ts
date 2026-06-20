import { describe, it, expect } from 'vitest';
import { brandImpactScore, indexFirms, buildBrandScoreIndex } from '$lib/ranking';
import type { Brand, Firm } from '$lib/types';

function firm(id: string, harmScore: number, aumVal: number): Firm {
	return {
		id,
		name: id,
		aum: '',
		aumVal,
		summary: 'x',
		brands: [],
		layoffs: '',
		notableBk: '',
		harmScore,
		source: 'https://example.com',
		cats: [],
		harms: [],
		aligns: []
	};
}
function brand(id: string, firmIds: string[]): Brand {
	return {
		id,
		avoid: id,
		ownership: firmIds.map((f) => ({ firmId: f, stake: 'majority' as const })),
		cat: 'tech',
		alts: [],
		why: 'x',
		harms: [],
		aligns: []
	};
}

describe('brandImpactScore', () => {
	it('applies the 5-point PE discount only to PE-owned firms (aumVal > 0)', () => {
		const palantir = firm('palantir', 98, 0); // self-owned: raw
		const containerStore = firm('leonard_green', 97, 50); // PE fund: discounted
		const idx = indexFirms([palantir, containerStore]);
		expect(brandImpactScore(brand('b1', ['palantir']), idx)).toBe(98);
		expect(brandImpactScore(brand('b2', ['leonard_green']), idx)).toBe(92);
	});

	it('lets a self-owned actor outrank a PE-victim at equal raw score', () => {
		const selfOwned = firm('self', 97, 0);
		const peOwned = firm('pe', 97, 100);
		const idx = indexFirms([selfOwned, peOwned]);
		expect(brandImpactScore(brand('a', ['self']), idx)).toBeGreaterThan(
			brandImpactScore(brand('b', ['pe']), idx)
		);
	});

	it('takes the max across multiple owners', () => {
		const idx = indexFirms([firm('x', 40, 0), firm('y', 80, 0)]);
		expect(brandImpactScore(brand('b', ['x', 'y']), idx)).toBe(80);
	});

	it('returns 0 when no owner resolves or has a score', () => {
		const idx = indexFirms([firm('x', 0, 0)]);
		expect(brandImpactScore(brand('b', ['missing']), idx)).toBe(0);
		expect(brandImpactScore(brand('b2', ['x']), idx)).toBe(0);
	});
});

describe('buildBrandScoreIndex', () => {
	it('precomputes a score per brand id', () => {
		const firms = [firm('f', 70, 0)];
		const brands = [brand('b', ['f'])];
		const map = buildBrandScoreIndex(brands, indexFirms(firms));
		expect(map.get('b')).toBe(70);
		expect(map.size).toBe(1);
	});
});
