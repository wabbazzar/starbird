import type { Brand, Firm } from './types';
import type { ValueId } from './values';
import { VALUES } from './values';
import type { CategoryId } from './categories';
import { CATEGORIES } from './categories';
import { QUEST_BY_ID } from './quests';
import rubric from './harm-score-rubric.json';

export interface HistogramBucket {
	label: string;
	min: number;
	max: number;
	count: number;
}

export interface HarmHistogram {
	buckets: HistogramBucket[];
	mean: number;
	median: number;
	total: number;
}

/**
 * Bin firm harmScores into the 6 rubric buckets (single source of truth:
 * harm-score-rubric.json). Returns per-bucket counts plus mean/median so the
 * histogram can mark central tendency — the dataset is bimodal, so a single
 * "average" is misleading and the distribution is the honest view.
 */
export function harmHistogram(firms: Firm[]): HarmHistogram {
	const buckets: HistogramBucket[] = rubric.buckets.map((b) => ({
		label: b.label,
		min: b.min,
		max: b.max,
		count: 0
	}));
	const scores: number[] = [];
	for (const f of firms) {
		if (typeof f.harmScore !== 'number') continue;
		scores.push(f.harmScore);
		const bucket = buckets.find((b) => f.harmScore >= b.min && f.harmScore <= b.max);
		if (bucket) bucket.count++;
	}
	scores.sort((a, b) => a - b);
	const total = scores.length;
	const mean = total ? scores.reduce((s, n) => s + n, 0) / total : 0;
	const median = total
		? total % 2
			? scores[(total - 1) / 2]
			: (scores[total / 2 - 1] + scores[total / 2]) / 2
		: 0;
	return { buckets, mean, median, total };
}

/** Distinct value systems an entity touches via its harm tags. */
function valuesOf(harms: string[]): Set<ValueId> {
	const out = new Set<ValueId>();
	for (const q of harms) {
		const v = QUEST_BY_ID[q as keyof typeof QUEST_BY_ID]?.value;
		if (v) out.add(v);
	}
	return out;
}

export interface HeatmapCell {
	cat: string; // CategoryId or 'other'
	value: ValueId;
	count: number;
}

export interface CategoryValueHeatmap {
	categories: { id: string; label: string }[];
	values: { id: ValueId; label: string }[];
	cells: HeatmapCell[];
	max: number;
}

/**
 * Build a categories × values grid of entity counts. Sparse categories (whose
 * total entity count is below `collapseBelow`) are folded into a single
 * "Other" row so the grid isn't a field of near-empty cells — per the data
 * profile, Coffee/Pets/Hotels are too thin to stand alone.
 */
export function categoryValueHeatmap(
	firms: Firm[],
	brands: Brand[],
	collapseBelow = 20
): CategoryValueHeatmap {
	// Total entities per category (firms via cats[], brands via cat).
	const catTotals = new Map<string, number>();
	const bump = (c: string) => catTotals.set(c, (catTotals.get(c) ?? 0) + 1);
	for (const f of firms) for (const c of f.cats) bump(c);
	for (const b of brands) bump(b.cat);

	const keep = new Set<string>(
		CATEGORIES.filter((c) => (catTotals.get(c.id) ?? 0) >= collapseBelow).map((c) => c.id)
	);
	const hasOther = CATEGORIES.some((c) => !keep.has(c.id) && (catTotals.get(c.id) ?? 0) > 0);
	const mapCat = (c: string) => (keep.has(c) ? c : 'other');

	const counts = new Map<string, number>(); // `${cat}|${value}` → count
	const add = (cat: string, vals: Set<ValueId>) => {
		for (const v of vals) {
			const k = `${mapCat(cat)}|${v}`;
			counts.set(k, (counts.get(k) ?? 0) + 1);
		}
	};
	for (const f of firms) for (const c of f.cats) add(c, valuesOf(f.harms));
	for (const b of brands) add(b.cat, valuesOf(b.harms));

	const categories = CATEGORIES.filter((c) => keep.has(c.id)).map((c) => ({
		id: c.id as string,
		label: c.label
	}));
	if (hasOther) categories.push({ id: 'other', label: 'Other' });

	const cells: HeatmapCell[] = [];
	let max = 0;
	for (const cat of categories) {
		for (const v of VALUES) {
			const count = counts.get(`${cat.id}|${v.id}`) ?? 0;
			cells.push({ cat: cat.id, value: v.id, count });
			if (count > max) max = count;
		}
	}
	return {
		categories,
		values: VALUES.map((v) => ({ id: v.id, label: v.label })),
		cells,
		max
	};
}

export interface LeaderRow {
	id: string;
	name: string;
	score: number;
}

/**
 * Scoped firm leaderboard by harm score. When `cat` is provided, only firms
 * in that category are ranked — a single global top-N represents <7% of the
 * data at full scale, so "worst in coffee / worst for X" is what users need.
 */
export function firmLeaderboard(firms: Firm[], cat: CategoryId | 'all', topN = 20): LeaderRow[] {
	return firms
		.filter((f) => cat === 'all' || f.cats.includes(cat))
		.slice()
		.sort((a, b) => b.harmScore - a.harmScore)
		.slice(0, topN)
		.map((f) => ({ id: f.id, name: f.name, score: f.harmScore }));
}
