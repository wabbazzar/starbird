// Best-effort coercion pass for static/data.json.
//
// The runner's Claude pass occasionally writes ownership entries with
// numeric `since`/`until` or invalid `stake` values, tripping the
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

// Valid stake values per OwnershipSchema in src/lib/schema.ts
const VALID_STAKES = new Set(['majority', 'minority', 'former', 'post_bankrupt']);

// Stake values that map unambiguously to post_bankrupt (brand-revival
// scenarios where the buyer acquired IP/license after a bankruptcy).
const POST_BANKRUPT_ALIASES = new Set(['IP owner', 'licensee', 'trademark holder']);

// Matches "majority (2010-2021)" or "former (2005-2018)" etc.
const STAKE_WITH_YEAR_RANGE = /^(?:majority|minority|former)\s+\((\d{4})-(\d{4})\)$/;

/**
 * Coerce all known-recoverable shape errors in a parsed data.json object.
 * Mutates `data` in-place.  Returns { fixes } where fixes is the count of
 * individual field changes applied.
 *
 * @param {object} data  Parsed static/data.json (v2 shape: {version, firms, brands})
 */
export function coerceData(data) {
	let fixes = 0;

	// Restore missing top-level version field (must come first so the
	// canonical key order {version, firms, brands} lands correctly on write).
	if (typeof data.version !== 'number') {
		const before = data.version;
		const rebuilt = { version: 2, ...data };
		Object.keys(data).forEach((k) => delete data[k]);
		Object.assign(data, rebuilt);
		console.error(
			`coerce-data: version: ${JSON.stringify(before)} → 2 (restored required top-level field)`
		);
		fixes++;
	}

	for (const collection of ['brands', 'firms']) {
		for (const [ei, entity] of (data[collection] ?? []).entries()) {
			for (const [oi, own] of (entity.ownership ?? []).entries()) {
				const prefix = `coerce-data: ${collection}[${ei}].ownership[${oi}]`;

				// 1. Numeric since/until → string
				for (const field of ['since', 'until']) {
					if (typeof own[field] === 'number') {
						const before = own[field];
						own[field] = String(before);
						console.error(`${prefix}.${field}: ${before} (number) → "${own[field]}" (string)`);
						fixes++;
					}
				}

				// 2. Stake coercions — only touch values outside the valid enum.
				if (own.stake !== undefined && !VALID_STAKES.has(own.stake)) {
					const before = own.stake;

					// "majority (YYYY-YYYY)" or "former (YYYY-YYYY)" → former + until:YYYY
					const rangeMatch = STAKE_WITH_YEAR_RANGE.exec(own.stake);
					if (rangeMatch) {
						own.stake = 'former';
						own.until = rangeMatch[2];
						console.error(`${prefix}.stake: "${before}" → "former" (until: "${own.until}")`);
						fixes++;
						continue;
					}

					// "self-owned" → "majority" (self-owned brands live under a firm with
					// aumVal:0; the schema encodes self-ownership as stake:majority)
					if (own.stake === 'self-owned') {
						own.stake = 'majority';
						console.error(`${prefix}.stake: "${before}" → "majority"`);
						fixes++;
						continue;
					}

					// IP/license/trademark brand-revival aliases → post_bankrupt
					if (POST_BANKRUPT_ALIASES.has(own.stake)) {
						own.stake = 'post_bankrupt';
						console.error(`${prefix}.stake: "${before}" → "post_bankrupt"`);
						fixes++;
						continue;
					}
				}
			}
		}
	}

	return { fixes };
}

// --- file I/O entry point (when run directly) ---

const here = path.dirname(url.fileURLToPath(import.meta.url));
const dataPath = path.resolve(here, '..', 'static', 'data.json');

const raw = fs.readFileSync(dataPath, 'utf8');
const data = JSON.parse(raw);

const { fixes } = coerceData(data);

if (fixes > 0) {
	const trailing = raw.endsWith('\n') ? '\n' : '';
	fs.writeFileSync(dataPath, JSON.stringify(data, null, 2) + trailing);
	console.error(`coerce-data: applied ${fixes} fix(es) to ${path.relative(process.cwd(), dataPath)}`);
} else {
	console.error('coerce-data: no fixes needed');
}
