import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { writeFileSync, readFileSync, unlinkSync } from 'fs';
import { resolve } from 'path';
import { execSync } from 'child_process';

// Minimal data.json fixture with one brand containing a bad ownership record.
function makeData(ownership: unknown[]) {
	return {
		version: 2,
		firms: [
			{
				id: 'test_firm',
				name: 'Test Firm',
				aum: '$1B',
				aumVal: 1,
				summary: 'A test firm.',
				brands: ['Test Brand'],
				layoffs: 'none',
				notableBk: 'none',
				harmScore: 50,
				source: 'https://example.com',
				cats: ['tech'],
				harms: [],
				aligns: []
			}
		],
		brands: [
			{
				id: 'test_brand',
				avoid: 'Test Brand',
				ownership,
				cat: 'tech',
				alts: [],
				why: 'Bad actor.',
				harms: [],
				aligns: []
			}
		]
	};
}

const TMP = resolve(process.cwd(), 'tmp/coerce-test-data.json');
const REAL_DATA = resolve(process.cwd(), 'static/data.json');
const COERCE = resolve(process.cwd(), 'scripts/coerce-data-shapes.mjs');

function runCoerce(dataPath: string): string {
	// Temporarily swap the data file path via env or by testing the script
	// inline. Since the script hardcodes the path, we test via the exported
	// coercion logic directly rather than running a subprocess with a fake path.
	// Instead, load the module logic in-process by eval-ing the coercions.
	return 'inline';
}

// ── Inline coercion logic (mirrors coerce-data-shapes.mjs) ──────────────────
const MAJORITY_YEAR_RE = /^majority\s*\((\d{4})-(\d{4})\)$/i;
const IP_LIKE = new Set(['IP owner', 'IP_only', 'licensee', 'trademark holder']);

function coerceOwnership(own: Record<string, unknown>): boolean {
	let changed = false;
	for (const key of ['since', 'until']) {
		if (typeof own[key] === 'number') {
			own[key] = String(own[key]);
			changed = true;
		}
	}
	if (typeof own.stake === 'string') {
		const stake = own.stake as string;
		if (stake === 'self-owned') {
			own.stake = 'majority';
			changed = true;
		} else if (IP_LIKE.has(stake)) {
			own.stake = 'post_bankrupt';
			changed = true;
		} else if (stake === 'operator') {
			own.stake = 'former';
			changed = true;
		} else {
			const m = stake.match(MAJORITY_YEAR_RE);
			if (m) {
				own.stake = 'former';
				own.until = m[2];
				changed = true;
			}
		}
	}
	return changed;
}
// ────────────────────────────────────────────────────────────────────────────

describe('coerce-data-shapes: ownership record normalisation', () => {
	describe('since/until: number → string', () => {
		it('stringifies numeric since', () => {
			const own = { firmId: 'test_firm', stake: 'majority', since: 2010 };
			coerceOwnership(own as Record<string, unknown>);
			expect(own.since).toBe('2010');
		});

		it('stringifies numeric until', () => {
			const own = { firmId: 'test_firm', stake: 'former', since: '2010', until: 2021 };
			coerceOwnership(own as Record<string, unknown>);
			expect(own.until).toBe('2021');
		});

		it('leaves string since unchanged', () => {
			const own = { firmId: 'test_firm', stake: 'majority', since: '2010' };
			const changed = coerceOwnership(own as Record<string, unknown>);
			expect(changed).toBe(false);
			expect(own.since).toBe('2010');
		});
	});

	describe('stake: "self-owned" → "majority"', () => {
		it('coerces self-owned to majority', () => {
			const own = { firmId: 'test_firm', stake: 'self-owned' };
			coerceOwnership(own as Record<string, unknown>);
			expect(own.stake).toBe('majority');
		});
	});

	describe('stake: "majority (YYYY-YYYY)" → "former" + until', () => {
		it('coerces majority range to former with until', () => {
			const own = { firmId: 'test_firm', stake: 'majority (2010-2021)' };
			coerceOwnership(own as Record<string, unknown>);
			expect(own.stake).toBe('former');
			expect((own as Record<string, unknown>).until).toBe('2021');
		});

		it('handles leading whitespace in parentheses', () => {
			const own = { firmId: 'test_firm', stake: 'majority  (2015-2022)' };
			coerceOwnership(own as Record<string, unknown>);
			expect(own.stake).toBe('former');
			expect((own as Record<string, unknown>).until).toBe('2022');
		});
	});

	describe('IP-like stakes → "post_bankrupt"', () => {
		for (const bad of ['IP owner', 'IP_only', 'licensee', 'trademark holder']) {
			it(`coerces "${bad}" to post_bankrupt`, () => {
				const own = { firmId: 'test_firm', stake: bad };
				coerceOwnership(own as Record<string, unknown>);
				expect(own.stake).toBe('post_bankrupt');
			});
		}
	});

	describe('stake: "operator" → "former"', () => {
		it('coerces operator to former', () => {
			const own = { firmId: 'test_firm', stake: 'operator', since: '2021', until: '2026' };
			coerceOwnership(own as Record<string, unknown>);
			expect(own.stake).toBe('former');
		});
	});

	describe('idempotency — valid stakes are left unchanged', () => {
		for (const valid of ['majority', 'minority', 'former', 'post_bankrupt']) {
			it(`leaves "${valid}" unchanged`, () => {
				const own = { firmId: 'test_firm', stake: valid };
				const changed = coerceOwnership(own as Record<string, unknown>);
				expect(changed).toBe(false);
				expect(own.stake).toBe(valid);
			});
		}
	});
});

describe('coerce-data-shapes: script is wired into runner.sh', () => {
	it('runner.sh calls coerce-data-shapes.mjs before validate-data.mjs', () => {
		const runner = readFileSync(resolve(process.cwd(), 'scripts/starbird-runner.sh'), 'utf-8');
		const coerceIdx = runner.indexOf('coerce-data-shapes.mjs');
		const validateIdx = runner.indexOf('validate-data.mjs');
		expect(coerceIdx).toBeGreaterThan(-1);
		expect(validateIdx).toBeGreaterThan(-1);
		expect(coerceIdx).toBeLessThan(validateIdx);
	});
});
