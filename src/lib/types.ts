import type { ValueId } from './values';

export interface Firm {
	name: string;
	aum: string;
	aumVal: number;
	summary: string;
	brands: string[];
	layoffs: string;
	notableBk: string;
	harmScore: number;
	source: string;
	cats: string[];
	harms: ValueId[];
	aligns: ValueId[];
}

export interface Brand {
	avoid: string;
	owner: string;
	cat: string;
	alts: string[];
	why: string;
	harms: ValueId[];
	aligns: ValueId[];
}

export interface DataFile {
	firms: Firm[];
	brands: Brand[];
}

export type Classification = 'avoid' | 'align' | 'neutral';

export function classify(
	harms: ValueId[],
	aligns: ValueId[],
	selected: ValueId[]
): { kind: Classification; matched: ValueId[] } {
	if (selected.length === 0) return { kind: 'neutral', matched: [] };
	const harmMatches = harms.filter((h) => selected.includes(h));
	const alignMatches = aligns.filter((a) => selected.includes(a));
	if (harmMatches.length > 0) return { kind: 'avoid', matched: harmMatches };
	if (alignMatches.length > 0) return { kind: 'align', matched: alignMatches };
	return { kind: 'neutral', matched: [] };
}
