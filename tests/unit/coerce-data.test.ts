import { describe, it, expect, afterEach } from 'vitest';
import { readFileSync, writeFileSync, existsSync, unlinkSync } from 'fs';
import { resolve } from 'path';
import { execSync } from 'child_process';

// Integration-style test: runs the real script with DATA_PATH pointing at a
// temp file so we don't touch static/data.json during the test suite.
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

function brand(ownership: object) {
	return { id: 'b1', avoid: 'Test Brand', cat: 'tech', alts: [], why: 'test', harms: [], aligns: [], ownership: [ownership] };
}

describe('coerce-data.mjs — stake coercions', () => {
	it('coerces stake "self-owned" → "majority"', () => {
		const result = runCoerce({ ...BASE, brands: [brand({ firmId: 'f1', stake: 'self-owned', since: '2010' })] }) as any;
		expect(result.brands[0].ownership[0].stake).toBe('majority');
	});

	it('coerces stake "majority (YYYY-YYYY)" → "former" + sets until to end year', () => {
		const result = runCoerce({ ...BASE, brands: [brand({ firmId: 'f1', stake: 'majority (2010-2021)' })] }) as any;
		const own = result.brands[0].ownership[0];
		expect(own.stake).toBe('former');
		expect(own.until).toBe('2021');
	});

	it('coerces stake "IP owner" → "post_bankrupt"', () => {
		const result = runCoerce({ ...BASE, brands: [brand({ firmId: 'f1', stake: 'IP owner' })] }) as any;
		expect(result.brands[0].ownership[0].stake).toBe('post_bankrupt');
	});

	it('coerces stake "licensee" → "post_bankrupt"', () => {
		const result = runCoerce({ ...BASE, brands: [brand({ firmId: 'f1', stake: 'licensee' })] }) as any;
		expect(result.brands[0].ownership[0].stake).toBe('post_bankrupt');
	});

	it('coerces stake "trademark holder" → "post_bankrupt"', () => {
		const result = runCoerce({ ...BASE, brands: [brand({ firmId: 'f1', stake: 'trademark holder' })] }) as any;
		expect(result.brands[0].ownership[0].stake).toBe('post_bankrupt');
	});

	it('leaves valid stakes untouched', () => {
		for (const stake of ['majority', 'minority', 'former', 'post_bankrupt']) {
			const result = runCoerce({ ...BASE, brands: [brand({ firmId: 'f1', stake })] }) as any;
			expect(result.brands[0].ownership[0].stake).toBe(stake);
		}
	});
});
