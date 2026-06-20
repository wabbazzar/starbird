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

export interface TreemapRect<T> {
	item: T;
	x: number;
	y: number;
	w: number;
	h: number;
}

/**
 * Squarified treemap layout (Bruls et al.). Lays `items` (each with a positive
 * `value`) into a width×height box as non-overlapping rectangles whose AREAS
 * are proportional to value — so magnitude reads honestly, unlike a bar chart
 * which compresses the long tail. Items with value <= 0 are dropped.
 */
export function squarify<T extends { value: number }>(
	items: T[],
	width: number,
	height: number
): TreemapRect<T>[] {
	const positive = items.filter((i) => i.value > 0).sort((a, b) => b.value - a.value);
	const total = positive.reduce((s, i) => s + i.value, 0);
	if (total <= 0 || width <= 0 || height <= 0) return [];

	const scaled = positive.map((item) => ({ item, area: (item.value / total) * width * height }));
	const out: TreemapRect<T>[] = [];
	let free = { x: 0, y: 0, w: width, h: height };

	const worst = (row: { area: number }[], side: number) => {
		const sum = row.reduce((s, r) => s + r.area, 0);
		const max = Math.max(...row.map((r) => r.area));
		const min = Math.min(...row.map((r) => r.area));
		const s2 = sum * sum;
		const side2 = side * side;
		return Math.max((side2 * max) / s2, s2 / (side2 * min));
	};

	const layoutRow = (row: { item: T; area: number }[]) => {
		const sum = row.reduce((s, r) => s + r.area, 0);
		const horizontal = free.w >= free.h; // lay the row along the shorter side
		if (horizontal) {
			const colW = sum / free.h;
			let cy = free.y;
			for (const r of row) {
				const cellH = r.area / colW;
				out.push({ item: r.item, x: free.x, y: cy, w: colW, h: cellH });
				cy += cellH;
			}
			free = { x: free.x + colW, y: free.y, w: free.w - colW, h: free.h };
		} else {
			const rowH = sum / free.w;
			let cx = free.x;
			for (const r of row) {
				const cellW = r.area / rowH;
				out.push({ item: r.item, x: cx, y: free.y, w: cellW, h: rowH });
				cx += cellW;
			}
			free = { x: free.x, y: free.y + rowH, w: free.w, h: free.h - rowH };
		}
	};

	let row: { item: T; area: number }[] = [];
	for (const cell of scaled) {
		const side = Math.min(free.w, free.h);
		if (row.length === 0 || worst(row, side) >= worst([...row, cell], side)) {
			row.push(cell);
		} else {
			layoutRow(row);
			row = [cell];
		}
	}
	if (row.length) layoutRow(row);
	return out;
}

export interface FirmHub {
	id: string;
	name: string;
	brandCount: number;
	aumVal: number;
	harmScore: number;
}

/** Firms ranked by how many brands they own (ownership fan-out). */
export function firmHubs(firms: Firm[], brands: Brand[], topN = 20): FirmHub[] {
	const counts = new Map<string, number>();
	for (const b of brands) {
		for (const o of b.ownership) counts.set(o.firmId, (counts.get(o.firmId) ?? 0) + 1);
	}
	const byId = new Map(firms.map((f) => [f.id, f]));
	return [...counts.entries()]
		.map(([id, brandCount]) => {
			const f = byId.get(id);
			return {
				id,
				name: f?.name ?? id,
				brandCount,
				aumVal: f?.aumVal ?? 0,
				harmScore: f?.harmScore ?? 0
			};
		})
		.sort((a, b) => b.brandCount - a.brandCount)
		.slice(0, topN);
}

export interface CostRow {
	id: string;
	name: string;
	usd: number;
}

/**
 * Cost-of-harm leaderboard from the structured evidence[]: sum of penalty-type
 * dollar amounts (fines + settlements) per firm. Powered entirely by the
 * Phase 3 backfill — impossible before evidence was structured.
 */
export function costOfHarm(firms: Firm[], topN = 15): CostRow[] {
	const penaltyKinds = new Set(['fine', 'settlement']);
	return firms
		.map((f) => ({
			id: f.id,
			name: f.name,
			usd: (f.evidence ?? [])
				.filter((e) => e.amountUsd && e.amountKind && penaltyKinds.has(e.amountKind))
				.reduce((s, e) => s + (e.amountUsd ?? 0), 0)
		}))
		.filter((r) => r.usd > 0)
		.sort((a, b) => b.usd - a.usd)
		.slice(0, topN);
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
