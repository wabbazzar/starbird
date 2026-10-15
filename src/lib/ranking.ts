import type { Brand, Firm, FirmRole, FirmScope, Ownership } from './types';

/**
 * Scoring model — see docs/tickets/pending/harm-score-recalibration.md.
 *
 * `firm.harmScore` in data.json is the *researched judgment*: how bad is the
 * documented conduct. On its own it produced a rank order that ignored the
 * rubric's first input, scale — a single-contract LLC scored 83 while
 * Blackstone ($1T AUM, portfolio-wide sale-leasebacks) scored 60.
 *
 * Two structured fields constrain it:
 *
 *   scope — how far the harm reaches. Caps the score so thin evidence can't
 *           buy an 85, and floors it so an entity with portfolio-wide or
 *           economy-wide reach can't sit in the Significant band.
 *   role  — whose conduct the score describes. A brand inherits its owner's
 *           score, but a housewares retailer that was bought and over-levered
 *           is a *victim* of that conduct, not the author of it, so pure
 *           ownership is discounted hard.
 *
 * Everything here is display-only: `data.json` keeps the researched number.
 * These constants are the tuning surface — change them here, nowhere else.
 */

/** Upper bound on the effective score for each scope. */
export const SCOPE_CAP: Record<FirmScope, number> = {
	narrow: 65,
	single_company: 79,
	multi_company: 94,
	systemic: 100
};

/**
 * Lower bound for the two wide scopes. An entity whose harm reaches across a
 * portfolio or the whole economy cannot be merely "Significant" — this is what
 * lifts Blackstone (60) and BlackRock (55) off the floor of the list.
 */
export const SCOPE_FLOOR: Partial<Record<FirmScope, number>> = {
	multi_company: 60,
	systemic: 70
};

/** How much of an owner's score a brand does NOT inherit, by owner role. */
export const INHERIT_DISCOUNT: Record<FirmRole, number> = {
	actor: 0, // the brand IS the firm (Palantir, GEO Group, ExxonMobil)
	both: 10, // operates and owns (Tyson, Adani)
	owner: 25 // harm is realized through portfolio companies (every PE fund)
};

/** Additional haircut for a weaker or ended ownership link. */
export const STAKE_DISCOUNT: Record<Ownership['stake'], number> = {
	majority: 0,
	minority: 5,
	former: 10,
	post_bankrupt: 10
};

/** Scope used when a firm predates the scope backfill. Neutral: no cap change
 *  for anything at or under 79, no floor. */
const DEFAULT_SCOPE: FirmScope = 'single_company';
/** Role used when a firm predates the role backfill. `actor` inherits fully,
 *  which is the pre-existing behaviour. */
const DEFAULT_ROLE: FirmRole = 'actor';

const clamp = (n: number, lo: number, hi: number) => Math.min(hi, Math.max(lo, n));

/**
 * A firm's harm score after its scope cap and floor are applied. This is the
 * number the UI ranks and displays; `firm.harmScore` is the raw research
 * input behind it.
 */
export function firmEffectiveScore(firm: Firm): number {
	if (typeof firm.harmScore !== 'number') return 0;
	const scope = firm.scope ?? DEFAULT_SCOPE;
	return clamp(firm.harmScore, SCOPE_FLOOR[scope] ?? 0, SCOPE_CAP[scope]);
}

/**
 * Highest-impact-first brand score: the strongest inherited signal across a
 * brand's owners, discounted by how much of the owner's harm the brand
 * actually carries.
 *
 * This is the SINGLE SOURCE OF TRUTH for brand ranking. The Brands list
 * (src/routes/+page.svelte), the charts (ChartsPanel), and `/shop`
 * (scripts/shop-lib.mjs) must all call this so they can never disagree.
 */
export function brandImpactScore(brand: Brand, firmById: Map<string, Firm>): number {
	let best = 0;
	for (const o of brand.ownership) {
		const firm = firmById.get(o.firmId);
		if (!firm || !firm.harmScore) continue;
		const inherited =
			firmEffectiveScore(firm) -
			INHERIT_DISCOUNT[firm.role ?? DEFAULT_ROLE] -
			(STAKE_DISCOUNT[o.stake] ?? 0);
		best = Math.max(best, inherited);
	}
	return Math.max(0, best);
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
