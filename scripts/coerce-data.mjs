// Best-effort coercion pass for static/data.json.
//
// The runner's Claude pass occasionally produces ownership entries that
// trip the zod gate. Rather than fail-and-wait for a hand fix, this
// script normalizes well-known nuisances in-place and exits 0. If
// nothing matched, the file is untouched and the downstream validator
// still has the final word.
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

// Coercion table for invalid stake strings that Claude improvises.
// Keys are exact string matches; values are the canonical enum member.
const STAKE_ALIASES = {
	'self-owned': 'majority',
	'IP owner': 'post_bankrupt',
	licensee: 'post_bankrupt',
	'trademark holder': 'post_bankrupt'
};

// Pattern for "majority (YYYY-YYYY)" — coerce to former + set until.
const MAJORITY_RANGE_RE = /^majority \((\d{4})-(\d{4})\)$/;

/**
 * Apply all known shape coercions to a parsed data.json object in-place.
 * Returns { data, fixes } where fixes is the number of changes made.
 * The returned `data` reference may differ from the input when the
 * top-level `version` key was restored (object rebuild required for key order).
 */
export function applyCoercions(data) {
	let fixes = 0;

	// The runner's Claude pass occasionally drops the top-level `version`
	// field, which DataFileSchema requires (version 2). Restore it
	// deterministically; rebuild with version first for clean git diffs.
	if (typeof data.version !== 'number') {
		const before = data.version;
		data = { version: 2, ...data };
		console.error(`coerce-data: version: ${JSON.stringify(before)} → 2 (restored required top-level field)`);
		fixes++;
	}

	for (const [bi, brand] of (data.brands ?? []).entries()) {
		for (const [oi, own] of (brand.ownership ?? []).entries()) {
			const prefix = `coerce-data: brands[${bi}].ownership[${oi}]`;

			// Numeric since/until → string
			for (const field of ['since', 'until']) {
				if (typeof own[field] === 'number') {
					const before = own[field];
					own[field] = String(before);
					console.error(`${prefix}.${field}: ${before} (number) → "${own[field]}" (string)`);
					fixes++;
				}
			}

			// Stake string coercions
			if (typeof own.stake === 'string') {
				if (own.stake in STAKE_ALIASES) {
					// Direct alias ("self-owned", "IP owner", "licensee", "trademark holder")
					const before = own.stake;
					own.stake = STAKE_ALIASES[before];
					console.error(`${prefix}.stake: "${before}" → "${own.stake}"`);
					fixes++;
				} else {
					// "majority (YYYY-YYYY)" → former + until
					const m = own.stake.match(MAJORITY_RANGE_RE);
					if (m) {
						const before = own.stake;
						own.until = m[2];
						own.stake = 'former';
						console.error(`${prefix}.stake: "${before}" → "former" (until: "${m[2]}")`);
						fixes++;
					}
				}
			}
		}
	}

	return { data, fixes };
}

// Run as CLI when invoked directly (not imported as a module).
const isMain =
	typeof process !== 'undefined' &&
	process.argv[1] &&
	url.fileURLToPath(import.meta.url) === path.resolve(process.argv[1]);

if (isMain) {
	const here = path.dirname(url.fileURLToPath(import.meta.url));
	const dataPath = path.resolve(here, '..', 'static', 'data.json');

	const raw = fs.readFileSync(dataPath, 'utf8');
	const parsed = JSON.parse(raw);

	const { data, fixes } = applyCoercions(parsed);

	if (fixes > 0) {
		const trailing = raw.endsWith('\n') ? '\n' : '';
		fs.writeFileSync(dataPath, JSON.stringify(data, null, 2) + trailing);
		console.error(`coerce-data: applied ${fixes} fix(es) to ${path.relative(process.cwd(), dataPath)}`);
	} else {
		console.error('coerce-data: no fixes needed');
	}
}
