// Best-effort coercion pass for static/data.json.
//
// The runner's Claude pass occasionally writes ownership entries with shapes
// that fail the zod gate. Rather than fail-and-wait for a hand fix, this
// script normalizes well-known nuisances in-place and exits 0. If nothing
// matched, the file is untouched and the downstream validator still has the
// final word.
//
// Scope is deliberately narrow: only coercions that are unambiguous and
// don't change semantics. Anything else is a real schema bug and belongs
// in front of the runner's hard gate.
//
// Usage:  node scripts/coerce-data.mjs [path/to/data.json]
//         (defaults to static/data.json next to this script)
//
// Exits 0 always (no-op or wrote fixes). Logs each fix to stderr.

import fs from 'node:fs';
import path from 'node:path';
import url from 'node:url';

const here = path.dirname(url.fileURLToPath(import.meta.url));
const dataPath = process.argv[2]
	? path.resolve(process.argv[2])
	: path.resolve(here, '..', 'static', 'data.json');

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

// Valid stake enum values (mirrors OwnershipSchema in src/lib/schema.ts).
const VALID_STAKES = new Set(['majority', 'minority', 'former', 'post_bankrupt']);

// Pattern-based stake coercions (checked before literal lookups).
const STAKE_PATTERNS = [
	// "majority (YYYY-YYYY)" → "former" + set until to end year if not already set.
	// Covers the recurring hotfix pattern seen in de6d777 and 577bc80.
	{
		pattern: /^majority\s+\((\d{4})-(\d{4})\)$/i,
		fix: (own, m) => {
			const endYear = m[2];
			const before = own.stake;
			own.stake = 'former';
			if (!own.until) own.until = endYear;
			console.error(
				`coerce-data: stake: "${before}" → "former" (until: "${endYear}" inferred from range)`
			);
		}
	}
];

// Literal invalid → valid stake mappings.
// Self-owned brands use stake:"majority" on a firm with aumVal:0 (per CLAUDE.md).
// IP/licensing stakes arise from PE bankruptcy plays (8b69ec6, f040af1 precedents).
const STAKE_LITERALS = {
	'self-owned': 'majority',
	'IP owner': 'post_bankrupt',
	IP_only: 'post_bankrupt',
	licensee: 'post_bankrupt',
	'trademark holder': 'post_bankrupt'
};

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

		// Invalid stake values → valid enum
		if (own.stake !== undefined && !VALID_STAKES.has(own.stake)) {
			let matched = false;

			for (const { pattern, fix } of STAKE_PATTERNS) {
				const m = String(own.stake).match(pattern);
				if (m) {
					fix(own, m);
					fixes++;
					matched = true;
					break;
				}
			}

			if (!matched && own.stake in STAKE_LITERALS) {
				const before = own.stake;
				own.stake = STAKE_LITERALS[before];
				console.error(
					`coerce-data: brands[${bi}].ownership[${oi}].stake: "${before}" → "${own.stake}"`
				);
				fixes++;
			}
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
