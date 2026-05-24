import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { writeFileSync, readFileSync, mkdirSync, rmSync } from 'fs';
import { resolve } from 'path';
import { execSync } from 'child_process';

// coerce-data.mjs reads from COERCE_DATA_PATH env var if set, else static/data.json.
// We point it at a temp fixture so the real data file is never touched.

const TMP_DIR = resolve(process.cwd(), 'tmp');
const FIXTURE = resolve(TMP_DIR, 'coerce-data-test-fixture.json');

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
				brands: ['test_brand'],
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
				name: 'Test Brand',
				ownership,
				cat: 'tech',
				alts: [],
				why: 'Test brand for coercion tests.',
				harms: [],
				aligns: []
			}
		]
	};
}

function coerce(ownership: unknown[]): any {
	writeFileSync(FIXTURE, JSON.stringify(makeData(ownership), null, 2));
	execSync(`node scripts/coerce-data.mjs`, {
		cwd: process.cwd(),
		env: { ...process.env, COERCE_DATA_PATH: FIXTURE },
		stdio: 'pipe'
	});
	return JSON.parse(readFileSync(FIXTURE, 'utf-8')).brands[0].ownership;
}

beforeEach(() => {
	mkdirSync(TMP_DIR, { recursive: true });
});

afterEach(() => {
	try { rmSync(FIXTURE); } catch { /* already gone */ }
});

describe('coerce-data.mjs — numeric since/until (existing behaviour)', () => {
	it('coerces number since to string', () => {
		const [own] = coerce([{ firmId: 'test_firm', stake: 'majority', since: 2010 }]);
		expect(own.since).toBe('2010');
	});

	it('coerces number until to string', () => {
		const [own] = coerce([{ firmId: 'test_firm', stake: 'former', since: '2005', until: 2021 }]);
		expect(own.until).toBe('2021');
	});

	it('leaves string since untouched', () => {
		const [own] = coerce([{ firmId: 'test_firm', stake: 'majority', since: '2010' }]);
		expect(own.since).toBe('2010');
	});
});

describe('coerce-data.mjs — stake coercions', () => {
	it('coerces "self-owned" → "majority"', () => {
		const [own] = coerce([{ firmId: 'test_firm', stake: 'self-owned' }]);
		expect(own.stake).toBe('majority');
	});

	it('coerces "majority (2010-2021)" → stake "former" + until "2021"', () => {
		const [own] = coerce([{ firmId: 'test_firm', stake: 'majority (2010-2021)' }]);
		expect(own.stake).toBe('former');
		expect(own.until).toBe('2021');
	});

	it('handles extra whitespace in majority year range', () => {
		const [own] = coerce([{ firmId: 'test_firm', stake: 'majority ( 2015 - 2022 )' }]);
		expect(own.stake).toBe('former');
		expect(own.until).toBe('2022');
	});

	it.each(['IP owner', 'IP_only', 'licensee', 'trademark holder'])(
		'coerces "%s" → "post_bankrupt"',
		(bad) => {
			const [own] = coerce([{ firmId: 'test_firm', stake: bad }]);
			expect(own.stake).toBe('post_bankrupt');
		}
	);

	it('coerces "operator" → "former"', () => {
		const [own] = coerce([{ firmId: 'test_firm', stake: 'operator' }]);
		expect(own.stake).toBe('former');
	});

	it.each(['majority', 'minority', 'former', 'post_bankrupt'])(
		'leaves valid stake "%s" untouched',
		(valid) => {
			const [own] = coerce([{ firmId: 'test_firm', stake: valid }]);
			expect(own.stake).toBe(valid);
		}
	);
});
