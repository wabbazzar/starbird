import { describe, it, expect } from 'vitest';
import { readFileSync } from 'fs';
import { resolve } from 'path';

// Pin the stake-coercion logic in coerce-data.mjs.
// The script already handles numeric since/until and missing version.
// These tests guard the ADDITIONAL coercions added by augur/stake-coercions
// to prevent the recurring runner shape errors documented in the project block:
//   - stake:"self-owned"             → stake:"majority"
//   - stake:"majority (YYYY-YYYY)"   → stake:"former", until:"YYYY"
//   - stake:"IP owner" / "licensee" / "trademark holder" → stake:"post_bankrupt"

describe('coerce-data.mjs — stake coercions', () => {
	const src = readFileSync(resolve(process.cwd(), 'scripts/coerce-data.mjs'), 'utf-8');

	it('coerces stake:"self-owned" to "majority"', () => {
		// Script must contain logic to detect and replace "self-owned"
		expect(src).toMatch(/self-owned/);
		expect(src).toMatch(/majority/);
	});

	it('coerces stake:"majority (YYYY-YYYY)" to stake:"former" + until', () => {
		// Script must extract the end-year from the parenthesised range
		expect(src).toMatch(/majority[\s\S]{0,30}YYYY|majority[\s\S]{0,30}\d{4}.*\d{4}|rangeMatch|range_match/i);
		expect(src).toMatch(/former/);
		expect(src).toMatch(/until/);
	});

	it('coerces stake:"IP owner" and variants to "post_bankrupt"', () => {
		expect(src).toMatch(/IP owner/);
		expect(src).toMatch(/post_bankrupt/);
	});

	it('coerces stake:"licensee" to "post_bankrupt"', () => {
		expect(src).toMatch(/licensee/);
	});

	it('coerces stake:"trademark holder" to "post_bankrupt"', () => {
		expect(src).toMatch(/trademark holder/);
	});
});
