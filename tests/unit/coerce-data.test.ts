import { describe, it, expect } from 'vitest';
import { coerceData } from '../../scripts/coerce-data.mjs';

// Minimal valid data shape for tests — only the fields coerceData touches.
function makeData(overrides = {}) {
	return {
		version: 2,
		firms: [],
		brands: [],
		...overrides
	};
}

function makeBrand(ownershipOverride = {}) {
	return {
		id: 'test_brand',
		name: 'Test Brand',
		ownership: [{ stake: 'majority', since: '2020', ...ownershipOverride }]
	};
}

function makeFirm(ownershipOverride = {}) {
	return {
		id: 'test_firm',
		name: 'Test Firm',
		ownership: [{ stake: 'majority', since: '2020', ...ownershipOverride }]
	};
}

describe('coerceData — version field', () => {
	it('restores a missing version field to 2', () => {
		const data = { firms: [], brands: [] };
		const { fixes } = coerceData(data);
		expect(data.version).toBe(2);
		expect(fixes).toBeGreaterThan(0);
	});

	it('leaves an existing version field alone', () => {
		const data = makeData();
		const { fixes } = coerceData(data);
		expect(data.version).toBe(2);
		expect(fixes).toBe(0);
	});
});

describe('coerceData — numeric since/until → string (brands)', () => {
	it('stringifies a numeric since in brand ownership', () => {
		const brand = makeBrand({ since: 2017 });
		const data = makeData({ brands: [brand] });
		const { fixes } = coerceData(data);
		expect(brand.ownership[0].since).toBe('2017');
		expect(fixes).toBe(1);
	});

	it('stringifies a numeric until in brand ownership', () => {
		const brand = makeBrand({ since: '2010', until: 2020 });
		const data = makeData({ brands: [brand] });
		const { fixes } = coerceData(data);
		expect(brand.ownership[0].until).toBe('2020');
		expect(fixes).toBe(1);
	});
});

describe('coerceData — numeric since/until → string (firms)', () => {
	it('stringifies a numeric since in firm ownership', () => {
		const firm = makeFirm({ since: 2010 });
		const data = makeData({ firms: [firm] });
		const { fixes } = coerceData(data);
		expect(firm.ownership[0].since).toBe('2010');
		expect(fixes).toBe(1);
	});

	it('stringifies a numeric until in firm ownership', () => {
		const firm = makeFirm({ since: '2005', until: 2015 });
		const data = makeData({ firms: [firm] });
		const { fixes } = coerceData(data);
		expect(firm.ownership[0].until).toBe('2015');
		expect(fixes).toBe(1);
	});
});

describe('coerceData — stake: "self-owned" → "majority"', () => {
	it('normalizes "self-owned" stake to "majority" on brands', () => {
		const brand = makeBrand({ stake: 'self-owned' });
		const data = makeData({ brands: [brand] });
		const { fixes } = coerceData(data);
		expect(brand.ownership[0].stake).toBe('majority');
		expect(fixes).toBe(1);
	});

	it('normalizes "self-owned" stake to "majority" on firms', () => {
		const firm = makeFirm({ stake: 'self-owned' });
		const data = makeData({ firms: [firm] });
		const { fixes } = coerceData(data);
		expect(firm.ownership[0].stake).toBe('majority');
		expect(fixes).toBe(1);
	});
});

describe('coerceData — stake: "majority (YYYY-YYYY)" → "former" + until', () => {
	it('converts stake "majority (2010-2021)" to former with until on brands', () => {
		const brand = makeBrand({ stake: 'majority (2010-2021)', since: '2010' });
		const data = makeData({ brands: [brand] });
		const { fixes } = coerceData(data);
		expect(brand.ownership[0].stake).toBe('former');
		expect(brand.ownership[0].until).toBe('2021');
		expect(fixes).toBe(1);
	});

	it('converts stake "former (2005-2018)" to former with until on firms', () => {
		const firm = makeFirm({ stake: 'former (2005-2018)', since: '2005' });
		const data = makeData({ firms: [firm] });
		const { fixes } = coerceData(data);
		expect(firm.ownership[0].stake).toBe('former');
		expect(firm.ownership[0].until).toBe('2018');
		expect(fixes).toBe(1);
	});
});

describe('coerceData — invalid stake → "post_bankrupt"', () => {
	it('maps stake "IP owner" to "post_bankrupt"', () => {
		const brand = makeBrand({ stake: 'IP owner' });
		const data = makeData({ brands: [brand] });
		const { fixes } = coerceData(data);
		expect(brand.ownership[0].stake).toBe('post_bankrupt');
		expect(fixes).toBe(1);
	});

	it('maps stake "licensee" to "post_bankrupt"', () => {
		const brand = makeBrand({ stake: 'licensee' });
		const data = makeData({ brands: [brand] });
		const { fixes } = coerceData(data);
		expect(brand.ownership[0].stake).toBe('post_bankrupt');
		expect(fixes).toBe(1);
	});

	it('maps stake "trademark holder" to "post_bankrupt"', () => {
		const brand = makeBrand({ stake: 'trademark holder' });
		const data = makeData({ brands: [brand] });
		const { fixes } = coerceData(data);
		expect(brand.ownership[0].stake).toBe('post_bankrupt');
		expect(fixes).toBe(1);
	});

	it('maps "IP owner" stake on firms to "post_bankrupt"', () => {
		const firm = makeFirm({ stake: 'IP owner' });
		const data = makeData({ firms: [firm] });
		const { fixes } = coerceData(data);
		expect(firm.ownership[0].stake).toBe('post_bankrupt');
		expect(fixes).toBe(1);
	});
});

describe('coerceData — no-op on valid data', () => {
	it('returns 0 fixes when data is already schema-valid', () => {
		const data = makeData({
			brands: [makeBrand({ stake: 'majority', since: '2020' })],
			firms: [makeFirm({ stake: 'former', since: '2010', until: '2018' })]
		});
		const { fixes } = coerceData(data);
		expect(fixes).toBe(0);
	});
});
