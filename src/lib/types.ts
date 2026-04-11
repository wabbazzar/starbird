import type { ValueId } from './values';
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
