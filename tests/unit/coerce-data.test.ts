import { describe, it, expect, afterEach } from 'vitest';
import { writeFileSync, readFileSync, mkdirSync, rmSync } from 'fs';
import { join } from 'path';
import { tmpdir } from 'os';
import { spawnSync } from 'child_process';
import { resolve } from 'path';

const SCRIPT = resolve(process.cwd(), 'scripts/coerce-data.mjs');

function runCoerce(data: object): { stderr: string; result: ReturnType<typeof spawnSync>; data: object } {
	const tmpDir = join(tmpdir(), `coerce-test-${process.hrtime.bigint()}`);
	mkdirSync(tmpDir, { recursive: true });
	const dataPath = join(tmpDir, 'data.json');
	writeFileSync(dataPath, JSON.stringify(data, null, 2));

	const result = spawnSync('node', [SCRIPT, dataPath], { encoding: 'utf-8' });
	const output = JSON.parse(readFileSync(dataPath, 'utf-8'));
	rmSync(tmpDir, { recursive: true, force: true });
	return { stderr: result.stderr ?? '', result, data: output };
}

describe('coerce-data.mjs', () => {
	describe('version field', () => {
		it('restores missing version field to 2', () => {
			const { data } = runCoerce({ firms: [], brands: [] });
			expect((data as Record<string, unknown>).version).toBe(2);
		});

		it('leaves existing version field untouched', () => {
			const { data } = runCoerce({ version: 2, firms: [], brands: [] });
			expect((data as Record<string, unknown>).version).toBe(2);
		});
	});

	describe('numeric since/until', () => {
		it('converts numeric since to string', () => {
			const input = {
				version: 2,
				firms: [],
				brands: [
					{
						id: 'test_brand',
						ownership: [{ firm: 'test_firm', stake: 'majority', since: 2017 }]
					}
				]
			};
			const { data } = runCoerce(input);
			const brand = (data as Record<string, unknown[]>).brands[0] as Record<string, unknown[]>;
			const own = brand.ownership[0] as Record<string, unknown>;
			expect(own.since).toBe('2017');
		});

		it('converts numeric until to string', () => {
			const input = {
				version: 2,
				firms: [],
				brands: [
					{
						id: 'test_brand',
						ownership: [{ firm: 'test_firm', stake: 'former', since: '2010', until: 2021 }]
					}
				]
			};
			const { data } = runCoerce(input);
			const brand = (data as Record<string, unknown[]>).brands[0] as Record<string, unknown[]>;
			const own = brand.ownership[0] as Record<string, unknown>;
			expect(own.until).toBe('2021');
		});
	});

	describe('invalid stake coercions', () => {
		it('coerces stake "self-owned" → "majority"', () => {
			const input = {
				version: 2,
				firms: [],
				brands: [
					{
						id: 'test_brand',
						ownership: [{ firm: 'test_firm', stake: 'self-owned', since: '2010' }]
					}
				]
			};
			const { data, stderr } = runCoerce(input);
			const brand = (data as Record<string, unknown[]>).brands[0] as Record<string, unknown[]>;
			const own = brand.ownership[0] as Record<string, unknown>;
			expect(own.stake).toBe('majority');
			expect(stderr).toMatch(/self-owned.*majority/);
		});

		it('coerces stake "majority (YYYY-YYYY)" → "former" + sets until', () => {
			const input = {
				version: 2,
				firms: [],
				brands: [
					{
						id: 'test_brand',
						ownership: [{ firm: 'test_firm', stake: 'majority (2010-2021)', since: '2010' }]
					}
				]
			};
			const { data, stderr } = runCoerce(input);
			const brand = (data as Record<string, unknown[]>).brands[0] as Record<string, unknown[]>;
			const own = brand.ownership[0] as Record<string, unknown>;
			expect(own.stake).toBe('former');
			expect(own.until).toBe('2021');
			expect(stderr).toMatch(/majority \(2010-2021\).*former/);
		});

		it('does not overwrite existing until when coercing "majority (YYYY-YYYY)"', () => {
			const input = {
				version: 2,
				firms: [],
				brands: [
					{
						id: 'test_brand',
						ownership: [
							{ firm: 'test_firm', stake: 'majority (2010-2021)', since: '2010', until: '2021' }
						]
					}
				]
			};
			const { data } = runCoerce(input);
			const brand = (data as Record<string, unknown[]>).brands[0] as Record<string, unknown[]>;
			const own = brand.ownership[0] as Record<string, unknown>;
			expect(own.stake).toBe('former');
			expect(own.until).toBe('2021');
		});

		it('coerces stake "IP owner" → "post_bankrupt"', () => {
			const input = {
				version: 2,
				firms: [],
				brands: [
					{
						id: 'test_brand',
						ownership: [{ firm: 'test_firm', stake: 'IP owner', since: '2019' }]
					}
				]
			};
			const { data, stderr } = runCoerce(input);
			const brand = (data as Record<string, unknown[]>).brands[0] as Record<string, unknown[]>;
			const own = brand.ownership[0] as Record<string, unknown>;
			expect(own.stake).toBe('post_bankrupt');
			expect(stderr).toMatch(/IP owner.*post_bankrupt/);
		});

		it('coerces stake "licensee" → "post_bankrupt"', () => {
			const input = {
				version: 2,
				firms: [],
				brands: [
					{
						id: 'test_brand',
						ownership: [{ firm: 'test_firm', stake: 'licensee', since: '2020' }]
					}
				]
			};
			const { data } = runCoerce(input);
			const brand = (data as Record<string, unknown[]>).brands[0] as Record<string, unknown[]>;
			const own = brand.ownership[0] as Record<string, unknown>;
			expect(own.stake).toBe('post_bankrupt');
		});

		it('coerces stake "trademark holder" → "post_bankrupt"', () => {
			const input = {
				version: 2,
				firms: [],
				brands: [
					{
						id: 'test_brand',
						ownership: [{ firm: 'test_firm', stake: 'trademark holder', since: '2020' }]
					}
				]
			};
			const { data } = runCoerce(input);
			const brand = (data as Record<string, unknown[]>).brands[0] as Record<string, unknown[]>;
			const own = brand.ownership[0] as Record<string, unknown>;
			expect(own.stake).toBe('post_bankrupt');
		});

		it('coerces stake "IP_only" → "post_bankrupt"', () => {
			const input = {
				version: 2,
				firms: [],
				brands: [
					{
						id: 'test_brand',
						ownership: [{ firm: 'test_firm', stake: 'IP_only', since: '2019' }]
					}
				]
			};
			const { data } = runCoerce(input);
			const brand = (data as Record<string, unknown[]>).brands[0] as Record<string, unknown[]>;
			const own = brand.ownership[0] as Record<string, unknown>;
			expect(own.stake).toBe('post_bankrupt');
		});

		it('leaves valid stake values untouched', () => {
			for (const stake of ['majority', 'minority', 'former', 'post_bankrupt']) {
				const input = {
					version: 2,
					firms: [],
					brands: [
						{ id: 'test_brand', ownership: [{ firm: 'test_firm', stake, since: '2010' }] }
					]
				};
				const { data, stderr } = runCoerce(input);
				const brand = (data as Record<string, unknown[]>).brands[0] as Record<string, unknown[]>;
				const own = brand.ownership[0] as Record<string, unknown>;
				expect(own.stake).toBe(stake);
				expect(stderr).toMatch(/no fixes needed/);
			}
		});
	});
});
