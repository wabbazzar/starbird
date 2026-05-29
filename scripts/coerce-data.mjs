// Best-effort coercion pass for static/data.json.
//
// The runner's Claude pass occasionally writes ownership entries with shapes
// that aren't in the zod OwnershipSchema. Rather than fail-and-wait for a
// hand fix, this script normalizes well-known nuisances in-place and exits 0.
// If nothing matched, the file is untouched and the downstream validator still
// has the final word.
//
// Scope is deliberately narrow: only coercions that are unambiguous and don't
// change semantics. Anything else is a real schema bug and belongs in front of
// the runner's hard gate.
//
// Usage:  node scripts/coerce-data.mjs   (or  npx tsx ...)
//
// Exits 0 always (no-op or wrote fixes). Logs each fix to stderr.

import fs from 'node:fs';
import path from 'node:path';
import url from 'node:url';

/**
 * Apply all known-safe coercions to a data object in-place.
 * Returns { data, fixes, log } — `fixes` is the count of changes made.
 */
export function coerceData(data) {
	const log = [];

	for (const [bi, brand] of (data.brands ?? []).entries()) {
		for (const [oi, own] of (brand.ownership ?? []).entries()) {
			const prefix = `brands[${bi}].ownership[${oi}]`;

			// Integer since/until → string
			for (const field of ['since', 'until']) {
				if (typeof own[field] === 'number') {
					const before = own[field];
					own[field] = String(before);
					log.push(`${prefix}.${field}: ${before} (number) → "${own[field]}" (string)`);
				}
			}

			// stake: "self-owned" → "majority"
			if (own.stake === 'self-owned') {
				own.stake = 'majority';
				log.push(`${prefix}.stake: "self-owned" → "majority"`);
			}

			// stake: "majority (YYYY-YYYY)" → stake: "former" + until: "YYYY"
			const majorityRange =
				typeof own.stake === 'string'
					? own.stake.match(/^majority\s+\((\d{4})-(\d{4})\)$/)
					: null;
			if (majorityRange) {
				const [, , endYear] = majorityRange;
				const before = own.stake;
				own.stake = 'former';
				own.until = endYear;
				log.push(`${prefix}.stake: "${before}" → stake: "former", until: "${endYear}"`);
			}

			// stake: "IP owner" | "licensee" | "trademark holder" → "post_bankrupt"
			if (['IP owner', 'licensee', 'trademark holder'].includes(own.stake)) {
				const before = own.stake;
				own.stake = 'post_bankrupt';
				log.push(`${prefix}.stake: "${before}" → "post_bankrupt"`);
			}
		}
	}

	return { data, fixes: log.length, log };
}

// When run directly (not imported), operate on static/data.json.
if (process.argv[1] === url.fileURLToPath(import.meta.url)) {
	const here = path.dirname(url.fileURLToPath(import.meta.url));
	const dataPath = path.resolve(here, '..', 'static', 'data.json');

	const raw = fs.readFileSync(dataPath, 'utf8');
	const data = JSON.parse(raw);
	const result = coerceData(data);

	result.log.forEach((msg) => console.error(`coerce-data: ${msg}`));

	if (result.fixes > 0) {
		const trailing = raw.endsWith('\n') ? '\n' : '';
		fs.writeFileSync(dataPath, JSON.stringify(data, null, 2) + trailing);
		console.error(
			`coerce-data: applied ${result.fixes} fix(es) to ${path.relative(process.cwd(), dataPath)}`
		);
	} else {
		console.error('coerce-data: no fixes needed');
	}
}
