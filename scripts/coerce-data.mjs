// Best-effort coercion pass for static/data.json.
//
// The runner's Claude pass occasionally writes ownership entries with
// numeric `since`/`until` (e.g. 2017 instead of "2017"), or free-text
// stake values outside the valid enum. Rather than fail-and-wait for a
// hand fix, this script normalizes well-known nuisances in-place and
// exits 0. If nothing matched, the file is untouched and the downstream
// validator still has the final word.
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

// ── Pure coercion logic (exported for testing) ───────────────────────────────

// Stake values that mean "IP/trademark relationship post-bankruptcy"
const POST_BANKRUPT_STAKES = ['IP owner', 'licensee', 'trademark holder'];

/**
 * Apply all known-safe coercions to a parsed data.json object.
 * Mutates nested ownership objects in-place; replaces top-level data
 * reference only when version is missing. Returns { data, fixes }.
 */
export function coerceData(input) {
	let data = input;
	let fixes = 0;

	// Restore missing version field (runner occasionally drops it)
	if (typeof data.version !== 'number') {
		const before = data.version;
		data = { version: 2, ...data };
		console.error(`coerce-data: version: ${JSON.stringify(before)} → 2 (restored required top-level field)`);
		fixes++;
	}

	for (const [bi, brand] of (data.brands ?? []).entries()) {
		for (const [oi, own] of (brand.ownership ?? []).entries()) {
			const loc = `brands[${bi}].ownership[${oi}]`;

			// Numeric since/until → string
			for (const field of ['since', 'until']) {
				if (typeof own[field] === 'number') {
					const before = own[field];
					own[field] = String(before);
					console.error(`coerce-data: ${loc}.${field}: ${before} (number) → "${own[field]}" (string)`);
					fixes++;
				}
			}

			if (typeof own.stake !== 'string') continue;

			// stake: "self-owned" → "majority"
			if (own.stake === 'self-owned') {
				console.error(`coerce-data: ${loc}.stake: "self-owned" → "majority"`);
				own.stake = 'majority';
				fixes++;
				continue;
			}

			// stake: "majority (YYYY-YYYY)" → stake: "former", until: "YYYY"
			const formerMatch = own.stake.match(/^majority\s*\((\d{4})-(\d{4})\)$/);
			if (formerMatch) {
				const before = own.stake;
				const until = formerMatch[2];
				console.error(`coerce-data: ${loc}.stake: "${before}" → "former", until: "${until}"`);
				own.stake = 'former';
				own.until = until;
				fixes++;
				continue;
			}

			// stake: "IP owner" | "licensee" | "trademark holder" → "post_bankrupt"
			if (POST_BANKRUPT_STAKES.includes(own.stake)) {
				console.error(`coerce-data: ${loc}.stake: "${own.stake}" → "post_bankrupt"`);
				own.stake = 'post_bankrupt';
				fixes++;
			}
		}
	}

	return { data, fixes };
}

// ── Main: read, coerce, write ─────────────────────────────────────────────────

const here = path.dirname(url.fileURLToPath(import.meta.url));
const dataPath = path.resolve(here, '..', 'static', 'data.json');

const raw = fs.readFileSync(dataPath, 'utf8');
const { data, fixes } = coerceData(JSON.parse(raw));

if (fixes > 0) {
	// Preserve the trailing newline if the original had one.
	const trailing = raw.endsWith('\n') ? '\n' : '';
	fs.writeFileSync(dataPath, JSON.stringify(data, null, 2) + trailing);
	console.error(`coerce-data: applied ${fixes} fix(es) to ${path.relative(process.cwd(), dataPath)}`);
} else {
	console.error('coerce-data: no fixes needed');
}
