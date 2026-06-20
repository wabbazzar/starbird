import { describe, it, expect } from 'vitest';
import {
	harmHistogram,
	categoryValueHeatmap,
	firmLeaderboard
} from '$lib/aggregations';
import { DataFileSchema } from '$lib/schema';
import { VALUES } from '$lib/values';
import data from '../../static/data.json';

const parsed = DataFileSchema.parse(data);
const realFirms = parsed.firms as never as import('$lib/types').Firm[];
const realBrands = parsed.brands as never as import('$lib/types').Brand[];

describe('harmHistogram', () => {
	const h = harmHistogram(realFirms);
	it('total equals the number of firms with a score', () => {
		expect(h.total).toBe(realFirms.length);
	});
	it('bucket counts sum to the total (no firm lost or double-counted)', () => {
		const sum = h.buckets.reduce((s, b) => s + b.count, 0);
		expect(sum).toBe(h.total);
	});
	it('every score falls inside exactly one bucket range', () => {
		for (const f of realFirms) {
			const hits = h.buckets.filter((b) => f.harmScore >= b.min && f.harmScore <= b.max);
			expect(hits.length).toBe(1);
		}
	});
	it('mean and median are within the score range', () => {
		expect(h.mean).toBeGreaterThanOrEqual(0);
		expect(h.mean).toBeLessThanOrEqual(100);
		expect(h.median).toBeGreaterThanOrEqual(0);
		expect(h.median).toBeLessThanOrEqual(100);
	});
});

describe('categoryValueHeatmap', () => {
	const m = categoryValueHeatmap(realFirms, realBrands);
	it('has one cell per category × value', () => {
		expect(m.cells.length).toBe(m.categories.length * m.values.length);
	});
	it('exposes all 6 values', () => {
		expect(m.values.length).toBe(VALUES.length);
	});
	it('collapses sparse categories into an Other row when present', () => {
		// Coffee/Pets/Hotels are below the default threshold in the real data.
		const ids = m.categories.map((c) => c.id);
		expect(ids).toContain('other');
		expect(ids).not.toContain('coffee');
	});
	it('cell counts never exceed the reported max', () => {
		for (const c of m.cells) expect(c.count).toBeLessThanOrEqual(m.max);
	});
});

describe('firmLeaderboard', () => {
	it('global board is sorted descending and capped at topN', () => {
		const board = firmLeaderboard(realFirms, 'all', 10);
		expect(board.length).toBeLessThanOrEqual(10);
		for (let i = 1; i < board.length; i++) {
			expect(board[i - 1].score).toBeGreaterThanOrEqual(board[i].score);
		}
	});
	it('scoped board only contains firms in the category', () => {
		const board = firmLeaderboard(realFirms, 'tech', 50);
		const techIds = new Set(realFirms.filter((f) => f.cats.includes('tech')).map((f) => f.id));
		for (const row of board) expect(techIds.has(row.id)).toBe(true);
	});
});
