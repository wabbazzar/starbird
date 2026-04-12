import type { ValueId } from './values';
import { VALUES } from './values';
import type { QuestId } from './quests';
import { QUEST_BY_ID } from './quests';
import type { CategoryId } from './categories';

export type OwnershipStake = 'majority' | 'minority' | 'former' | 'post_bankrupt';

export interface Ownership {
	firmId: string;
	stake: OwnershipStake;
	since?: string; // year or YYYY-MM
	until?: string; // set when stake is 'former' or 'post_bankrupt'
}

export interface Firm {
	id: string;
	name: string;
	aum: string;
	aumVal: number;
	summary: string;
	brands: string[];
	layoffs: string;
	notableBk: string;
	harmScore: number;
	source: string;
	cats: CategoryId[];
	harms: QuestId[];
	aligns: QuestId[];
}

export interface Brand {
	id: string;
	avoid: string;
	ownership: Ownership[];
	cat: CategoryId;
	alts: string[];
	why: string;
	harms: QuestId[];
	aligns: QuestId[];
}

export interface DataFile {
	version: number;
	firms: Firm[];
	brands: Brand[];
}

export type Classification = 'avoid' | 'align' | 'neutral';

/**
 * Classify an entry against the user's selected *values*. Harms and aligns
 * are stored as QuestIds, but the onboarding modal still picks values, so
 * we roll quests up to their parent value at classify time.
 */
export function classify(
	harms: QuestId[],
	aligns: QuestId[],
	selected: ValueId[]
): { kind: Classification; matched: ValueId[] } {
	if (selected.length === 0) return { kind: 'neutral', matched: [] };
	const harmValues = new Set<ValueId>(harms.map((q) => QUEST_BY_ID[q].value));
	const alignValues = new Set<ValueId>(aligns.map((q) => QUEST_BY_ID[q].value));
	const harmMatches = selected.filter((v) => harmValues.has(v));
	const alignMatches = selected.filter((v) => alignValues.has(v));
	if (harmMatches.length > 0) return { kind: 'avoid', matched: harmMatches };
	if (alignMatches.length > 0) return { kind: 'align', matched: alignMatches };
	return { kind: 'neutral', matched: [] };
}

/**
 * Build the full set of value tags for a card, annotated so the card can
 * highlight the ones the user selected and still show the ones they didn't.
 *
 * Returns a deterministic array ordered by the VALUES list so tag positions
 * stay stable across renders. Each entry has a variant:
 *   - 'avoid'   : value is in the user's selection AND in the entry's harms
 *   - 'align'   : value is in the user's selection AND in the entry's aligns
 *   - 'neutral' : value is tagged on the entry but NOT in the user's selection
 *
 * This is what the cards render, so every card shows every value it's
 * actually tagged with, not just the ones that intersect with the user's
 * current picks. Fixes the "looks unassigned" UX where a brand tagged for
 * animals didn't render any chip for a user who only cared about workers.
 */
export interface ValueTag {
	value: ValueId;
	variant: 'avoid' | 'align' | 'neutral';
}

export function valueTags(
	harms: QuestId[],
	aligns: QuestId[],
	selected: ValueId[]
): ValueTag[] {
	const harmValues = new Set<ValueId>(harms.map((q) => QUEST_BY_ID[q].value));
	const alignValues = new Set<ValueId>(aligns.map((q) => QUEST_BY_ID[q].value));
	const selectedSet = new Set<ValueId>(selected);
	const tags: ValueTag[] = [];
	for (const v of VALUES) {
		const inHarms = harmValues.has(v.id);
		const inAligns = alignValues.has(v.id);
		if (!inHarms && !inAligns) continue;
		const inSelection = selectedSet.has(v.id);
		let variant: 'avoid' | 'align' | 'neutral';
		if (inSelection && inHarms) variant = 'avoid';
		else if (inSelection && inAligns) variant = 'align';
		else variant = 'neutral';
		tags.push({ value: v.id, variant });
	}
	return tags;
}
