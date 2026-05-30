import { describe, it, expect } from 'vitest';
// @ts-ignore — mjs import; vitest resolves via vite, not tsc
import { coerceData } from '../../scripts/coerce-data.mjs';

type Ownership = Record<string, unknown>;

function makeData(ownership: Ownership[]) {
	return {
		version: 2,
		firms: [] as unknown[],
		brands: [{ ownership }] as unknown[]
	};
}

describe('coerce-data stake coercions', () => {
	it('coerces stake "self-owned" to "majority"', () => {
		const data = makeData([{ firmId: 'f1', stake: 'self-owned', since: '2010' }]);
		const { data: out, fixes } = coerceData(data);
		expect((out as ReturnType<typeof makeData>).brands[0].ownership[0].stake).toBe('majority');
		expect(fixes).toBeGreaterThan(0);
	});

	it('coerces stake "majority (2015-2022)" to stake "former" and sets until to "2022"', () => {
		const data = makeData([{ firmId: 'f1', stake: 'majority (2015-2022)', since: '2015' }]);
		const { data: out, fixes } = coerceData(data);
		const own = (out as ReturnType<typeof makeData>).brands[0].ownership[0];
		expect(own.stake).toBe('former');
		expect(own.until).toBe('2022');
		expect(fixes).toBeGreaterThan(0);
	});

	it('coerces stake "IP owner" to "post_bankrupt"', () => {
		const data = makeData([{ firmId: 'f1', stake: 'IP owner', since: '2018' }]);
		const { data: out, fixes } = coerceData(data);
		expect((out as ReturnType<typeof makeData>).brands[0].ownership[0].stake).toBe('post_bankrupt');
		expect(fixes).toBeGreaterThan(0);
	});

	it('coerces stake "licensee" to "post_bankrupt"', () => {
		const data = makeData([{ firmId: 'f1', stake: 'licensee', since: '2020' }]);
		const { data: out, fixes } = coerceData(data);
		expect((out as ReturnType<typeof makeData>).brands[0].ownership[0].stake).toBe('post_bankrupt');
		expect(fixes).toBeGreaterThan(0);
	});

	it('coerces stake "trademark holder" to "post_bankrupt"', () => {
		const data = makeData([{ firmId: 'f1', stake: 'trademark holder', since: '2019' }]);
		const { data: out, fixes } = coerceData(data);
		expect((out as ReturnType<typeof makeData>).brands[0].ownership[0].stake).toBe('post_bankrupt');
		expect(fixes).toBeGreaterThan(0);
	});

	it('leaves valid stake values unchanged', () => {
		for (const stake of ['majority', 'minority', 'former', 'post_bankrupt']) {
			const data = makeData([{ firmId: 'f1', stake, since: '2020' }]);
			const { data: out, fixes } = coerceData(data);
			expect((out as ReturnType<typeof makeData>).brands[0].ownership[0].stake).toBe(stake);
			expect(fixes).toBe(0);
		}
	});
});

describe('coerce-data numeric since/until', () => {
	it('coerces numeric since to string', () => {
		const data = makeData([{ firmId: 'f1', stake: 'majority', since: 2017 }]);
		const { data: out, fixes } = coerceData(data);
		expect((out as ReturnType<typeof makeData>).brands[0].ownership[0].since).toBe('2017');
		expect(fixes).toBe(1);
	});

	it('coerces numeric until to string', () => {
		const data = makeData([{ firmId: 'f1', stake: 'former', since: '2010', until: 2022 }]);
		const { data: out, fixes } = coerceData(data);
		expect((out as ReturnType<typeof makeData>).brands[0].ownership[0].until).toBe('2022');
		expect(fixes).toBe(1);
	});
});

describe('coerce-data version restoration', () => {
	it('restores missing version field', () => {
		const data = { firms: [] as unknown[], brands: [] as unknown[] };
		const { data: out, fixes } = coerceData(data);
		expect((out as { version: number }).version).toBe(2);
		expect(fixes).toBe(1);
	});

	it('leaves existing version unchanged', () => {
		const data = { version: 2, firms: [] as unknown[], brands: [] as unknown[] };
		const { data: out, fixes } = coerceData(data);
		expect((out as { version: number }).version).toBe(2);
		expect(fixes).toBe(0);
	});
});
