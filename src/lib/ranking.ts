import type { Brand, Firm } from './types';

/**
 * Highest-impact-first brand score: the max harmScore across a brand's
 * owning firms, with a 5-point inheritance discount for PE-owned firms
 * (firm.aumVal > 0) so active perpetrators outrank PE *victims*. Self-owned
 * firms (aumVal === 0, e.g. Palantir, ExxonMobil) use the raw score.
 *
 * This is the SINGLE SOURCE OF TRUTH for brand ranking. Both the Brands list
 * (src/routes/+page.svelte) and the charts (ChartsPanel) must call this so the
 * "top brands" chart never disagrees with the list order. The discount is
 * display-only — it does not change the stored harmScore in data.json.
 */
export function brandImpactScore(
	brand: Brand,
	firmById: Map<string, Firm>
): number {
	let best = 0;
	for (const o of brand.ownership) {
		const firm = firmById.get(o.firmId);
		if (!firm || !firm.harmScore) continue;
		const discount = firm.aumVal > 0 ? 5 : 0;
		best = Math.max(best, firm.harmScore - discount);
	}
	return best;
}

/** Build a firmId → Firm map for O(1) ownership lookups. */
export function indexFirms(firms: Firm[]): Map<string, Firm> {
	return new Map(firms.map((f) => [f.id, f]));
}

/**
 * Precompute brandId → impact score once per dataset so the list sort and
 * the search filter don't recompute it per row on every keystroke.
 */
export function buildBrandScoreIndex(
	brands: Brand[],
	firmById: Map<string, Firm>
): Map<string, number> {
	const idx = new Map<string, number>();
	for (const b of brands) idx.set(b.id, brandImpactScore(b, firmById));
	return idx;
}
