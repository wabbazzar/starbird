// Best-effort coercion pass for static/data.json.
//
// The runner's Claude pass occasionally writes ownership entries with
// numeric `since`/`until` (e.g. 2017 instead of "2017"), tripping the
// zod gate at the runner's pre-commit step. Rather than fail-and-wait
// for a hand fix, this script normalizes well-known nuisances in-place
// and exits 0. If nothing matched, the file is untouched and the
// downstream validator still has the final word.
//
// Scope is deliberately narrow: only coercions that are unambiguous and
// don't change semantics. Anything else is a real schema bug and
// belongs in front of the runner's hard gate.
//
// Usage:  node scripts/coerce-data.mjs   (or  npx tsx ...)
//
// Exits 0 always (no-op or wrote fixes). Logs each fix to stderr.

import fs from 'node:fs';
import path from 'node:path';
import url from 'node:url';

const here = path.dirname(url.fileURLToPath(import.meta.url));
const dataPath = path.resolve(here, '..', 'static', 'data.json');

const raw = fs.readFileSync(dataPath, 'utf8');
let data = JSON.parse(raw);

let fixes = 0;

// The runner's Claude pass rebuilds data.json as {firms, brands} and
// occasionally drops the top-level `version` field, which DataFileSchema
// requires (version 2). Restore it deterministically so a dropped version
// never blocks the commit gate. 2 is the current schema version.
if (typeof data.version !== 'number') {
	const before = data.version;
	// Rebuild with version first so the on-disk key order matches the
	// canonical {version, firms, brands} shape (clean git diffs).
	data = { version: 2, ...data };
	console.error(`coerce-data: version: ${JSON.stringify(before)} → 2 (restored required top-level field)`);
	fixes++;
}

// Stake variants the runner writes that aren't in the OwnershipSchema enum.
// Documented in project block hotfixes de6d777, 8b69ec6, 577bc80, f8df056.
const IP_OWNER_VARIANTS = ['IP owner', 'licensee', 'trademark holder'];

for (const [bi, brand] of (data.brands ?? []).entries()) {
	for (const [oi, own] of (brand.ownership ?? []).entries()) {
		// Numeric since/until → string
		for (const field of ['since', 'until']) {
			if (typeof own[field] === 'number') {
				const before = own[field];
				own[field] = String(before);
				console.error(
					`coerce-data: brands[${bi}].ownership[${oi}].${field}: ${before} (number) → "${own[field]}" (string)`
				);
				fixes++;
			}
		}

		// "self-owned" → "majority" (self-owned brands use stake:"majority" per schema)
		if (own.stake === 'self-owned') {
			own.stake = 'majority';
			console.error(
				`coerce-data: brands[${bi}].ownership[${oi}].stake: "self-owned" → "majority"`
			);
			fixes++;
		}

		// "majority (YYYY-YYYY)" → stake:"former", until:"YYYY" (end year)
		// Runner encodes ended relationships as free-text stake; schema uses former+until.
		const rangeMatch =
			typeof own.stake === 'string' && own.stake.match(/^majority\s*\((\d{4})-(\d{4})\)$/);
		if (rangeMatch) {
			const [, startYear, endYear] = rangeMatch;
			if (!own.since) own.since = startYear;
			own.until = endYear;
			own.stake = 'former';
			console.error(
				`coerce-data: brands[${bi}].ownership[${oi}].stake: "${own.stake}" → "former", until:"${endYear}"`
			);
			fixes++;
		}

		// "IP owner" / "licensee" / "trademark holder" → "post_bankrupt"
		// Used for brand-revival entities where original co went bankrupt and IP was sold.
		if (typeof own.stake === 'string' && IP_OWNER_VARIANTS.includes(own.stake)) {
			const before = own.stake;
			own.stake = 'post_bankrupt';
			console.error(
				`coerce-data: brands[${bi}].ownership[${oi}].stake: "${before}" → "post_bankrupt"`
			);
			fixes++;
		}
	}
}

if (fixes > 0) {
	// Preserve the trailing newline if the original had one.
	const trailing = raw.endsWith('\n') ? '\n' : '';
	fs.writeFileSync(dataPath, JSON.stringify(data, null, 2) + trailing);
	console.error(`coerce-data: applied ${fixes} fix(es) to ${path.relative(process.cwd(), dataPath)}`);
} else {
	console.error('coerce-data: no fixes needed');
}
