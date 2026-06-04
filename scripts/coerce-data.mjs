// Best-effort coercion pass for static/data.json.
//
// The runner's Claude pass occasionally writes ownership entries with
// numeric `since`/`until` (e.g. 2017 instead of "2017") or invalid
// stake values (e.g. "self-owned", "IP owner", "majority (2010-2021)"),
// tripping the zod gate at the runner's pre-commit step. Rather than
// fail-and-wait for a hand fix, this script normalizes well-known
// nuisances in-place and exits 0. If nothing matched, the file is
// untouched and the downstream validator still has the final word.
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

const STAKE_POST_BANKRUPT = new Set(['IP owner', 'licensee', 'trademark holder']);

// Parses "majority (YYYY-YYYY)" → { end: string } or null
function parseBracketedStake(stake) {
	const m = stake.match(/^majority\s*\((\d{4})-(\d{4}|present)\)$/i);
	if (!m) return null;
	return { end: m[2] === 'present' ? null : m[2] };
}

/**
 * Apply all known-safe coercions to a parsed data object in-place.
 * Returns { fixes: number, data, log: string[] }.
 * Does NOT read or write files — callers handle I/O.
 */
export function coerceData(data) {
	let fixes = 0;
	const log = [];

	// Restore dropped top-level version field.
	if (typeof data.version !== 'number') {
		const before = data.version;
		// Rebuild with version first so on-disk key order matches
		// the canonical {version, firms, brands} shape (clean diffs).
		data = { version: 2, ...data };
		log.push(`version: ${JSON.stringify(before)} → 2 (restored required top-level field)`);
		fixes++;
	}

	for (const [bi, brand] of (data.brands ?? []).entries()) {
		for (const [oi, own] of (brand.ownership ?? []).entries()) {
			const prefix = `brands[${bi}].ownership[${oi}]`;

			// Numeric since/until → string
			for (const field of ['since', 'until']) {
				if (typeof own[field] === 'number') {
					const before = own[field];
					own[field] = String(before);
					log.push(`${prefix}.${field}: ${before} (number) → "${own[field]}" (string)`);
					fixes++;
				}
			}

			// Stake normalization
			if (typeof own.stake === 'string') {
				const s = own.stake;

				if (s === 'self-owned') {
					own.stake = 'majority';
					log.push(`${prefix}.stake: "self-owned" → "majority"`);
					fixes++;
				} else if (STAKE_POST_BANKRUPT.has(s)) {
					own.stake = 'post_bankrupt';
					log.push(`${prefix}.stake: "${s}" → "post_bankrupt"`);
					fixes++;
				} else {
					const bracketed = parseBracketedStake(s);
					if (bracketed !== null) {
						own.stake = 'former';
						log.push(`${prefix}.stake: "${s}" → "former"`);
						fixes++;
						if (bracketed.end && !own.until) {
							own.until = bracketed.end;
							log.push(`${prefix}.until: (missing) → "${bracketed.end}" (extracted from stake)`);
							fixes++;
						}
					}
				}
			}
		}
	}

	return { fixes, data, log };
}

// Only run file I/O when executed directly (not imported by tests).
const isMain =
	typeof process !== 'undefined' &&
	process.argv[1] &&
	url.fileURLToPath(import.meta.url) === path.resolve(process.argv[1]);

if (isMain) {
	const here = path.dirname(url.fileURLToPath(import.meta.url));
	const dataPath = path.resolve(here, '..', 'static', 'data.json');

	const raw = fs.readFileSync(dataPath, 'utf8');
	const parsed = JSON.parse(raw);

	const { fixes, data, log } = coerceData(parsed);

	for (const msg of log) {
		console.error(`coerce-data: ${msg}`);
	}

	if (fixes > 0) {
		const trailing = raw.endsWith('\n') ? '\n' : '';
		fs.writeFileSync(dataPath, JSON.stringify(data, null, 2) + trailing);
		console.error(`coerce-data: applied ${fixes} fix(es) to ${path.relative(process.cwd(), dataPath)}`);
	} else {
		console.error('coerce-data: no fixes needed');
	}
}
