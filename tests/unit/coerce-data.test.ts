import { describe, it, expect } from 'vitest';
import { readFileSync, writeFileSync, existsSync, unlinkSync } from 'fs';
import { resolve } from 'path';
import { execSync } from 'child_process';

// Integration-style unit test: runs the actual script with DATA_PATH env var
// so we test the real coerce logic without mocking file I/O.

const SCRIPT = resolve(process.cwd(), 'scripts/coerce-data.mjs');
const TMP = '/tmp/coerce-data-test.json';

function runCoerce(data: object): object {
	writeFileSync(TMP, JSON.stringify(data, null, 2) + '\n');
	execSync(`node ${SCRIPT}`, {
		stdio: 'pipe',
		env: { ...process.env, DATA_PATH: TMP }
	});
	return JSON.parse(readFileSync(TMP, 'utf-8'));
}

afterEach(() => {
	if (existsSync(TMP)) unlinkSync(TMP);
});

const BASE = { version: 2, firms: [], brands: [] as object[] };

function brand(ownershipOverride: object) {
	return {
		id: 'b1',
		name: 'Test Brand',
		categories: ['tech'],
		harmScore: 50,
		why: 'test',
		addedAt: '2026-01-01',
		ownership: [ownershipOverride]
	};
}

describe('coerce-data.mjs — stake coercions', () => {
	it('coerces stake "self-owned" → "majority"', () => {
		const result = runCoerce({
			...BASE,
			brands: [brand({ firmId: 'f1', stake: 'self-owned', since: '2010' })]
		}) as any;
		expect(result.brands[0].ownership[0].stake).toBe('majority');
	});

	it('coerces stake "majority (YYYY-YYYY)" → "former" + until', () => {
		const result = runCoerce({
			...BASE,
			brands: [brand({ firmId: 'f1', stake: 'majority (2010-2021)', since: '2010' })]
		}) as any;
		const own = result.brands[0].ownership[0];
		expect(own.stake).toBe('former');
		expect(own.until).toBe('2021');
	});

	it('coerces stake "IP owner" → "post_bankrupt"', () => {
		const result = runCoerce({
			...BASE,
			brands: [brand({ firmId: 'f1', stake: 'IP owner' })]
		}) as any;
		expect(result.brands[0].ownership[0].stake).toBe('post_bankrupt');
	});

	it('coerces stake "licensee" → "post_bankrupt"', () => {
		const result = runCoerce({
			...BASE,
			brands: [brand({ firmId: 'f1', stake: 'licensee' })]
		}) as any;
		expect(result.brands[0].ownership[0].stake).toBe('post_bankrupt');
	});

	it('coerces stake "trademark holder" → "post_bankrupt"', () => {
		const result = runCoerce({
			...BASE,
			brands: [brand({ firmId: 'f1', stake: 'trademark holder' })]
		}) as any;
		expect(result.brands[0].ownership[0].stake).toBe('post_bankrupt');
	});

	it('leaves valid stakes untouched', () => {
		for (const stake of ['majority', 'minority', 'former', 'post_bankrupt']) {
			const result = runCoerce({
				...BASE,
				brands: [brand({ firmId: 'f1', stake })]
			}) as any;
			expect(result.brands[0].ownership[0].stake).toBe(stake);
		}
	});
});
