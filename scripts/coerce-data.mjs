// Best-effort coercion pass for static/data.json.
//
// The runner's Claude pass repeatedly produces ownership entries with
// unrecognised shapes that trip the zod gate. This script normalises
// well-known, unambiguous nuisances in-place before the gate runs.
// Non-recoverable errors are left untouched so validate-data.mjs can
// report them cleanly.
//
// Coercions applied (all on OwnershipSchema fields):
//   since/until: number → string
//   stake "self-owned"                     → "majority"
//   stake "majority (YYYY-YYYY)"           → "former" + until="YYYY"
//   stake "IP owner"|"IP_only"|"licensee"|
//         "trademark holder"               → "post_bankrupt"
//   stake "operator"                       → "former"
//
// Exits 0 always (no-op or wrote fixes). Logs each fix to stderr.
//
// For testing: set COERCE_DATA_PATH to override the default data file.

import fs from 'node:fs';
import path from 'node:path';
import url from 'node:url';

const here = path.dirname(url.fileURLToPath(import.meta.url));
const dataPath = process.env.COERCE_DATA_PATH
	? path.resolve(process.env.COERCE_DATA_PATH)
	: path.resolve(here, '..', 'static', 'data.json');

const raw = fs.readFileSync(dataPath, 'utf8');
const data = JSON.parse(raw);

let fixes = 0;

const IP_LIKE = new Set(['IP owner', 'IP_only', 'licensee', 'trademark holder']);
const MAJORITY_YEAR_RE = /^majority\s*\(\s*(\d{4})\s*-\s*(\d{4})\s*\)$/i;

for (const [bi, brand] of (data.brands ?? []).entries()) {
	for (const [oi, own] of (brand.ownership ?? []).entries()) {
		const label = `brands[${bi}].ownership[${oi}]`;

		// since/until: number → string
		for (const field of ['since', 'until']) {
			if (typeof own[field] === 'number') {
				const before = own[field];
				own[field] = String(before);
				console.error(`coerce-data: ${label}.${field}: ${before} (number) → "${own[field]}" (string)`);
				fixes++;
			}
		}

		// stake coercions
		if (typeof own.stake === 'string') {
			const stake = own.stake;

			if (stake === 'self-owned') {
				console.error(`coerce-data: ${label}.stake: "self-owned" → "majority"`);
				own.stake = 'majority';
				fixes++;
			} else if (IP_LIKE.has(stake)) {
				console.error(`coerce-data: ${label}.stake: "${stake}" → "post_bankrupt"`);
				own.stake = 'post_bankrupt';
				fixes++;
			} else if (stake === 'operator') {
				console.error(`coerce-data: ${label}.stake: "operator" → "former"`);
				own.stake = 'former';
				fixes++;
			} else {
				const m = stake.match(MAJORITY_YEAR_RE);
				if (m) {
					const until = m[2];
					console.error(
						`coerce-data: ${label}.stake: "${stake}" → "former" + until="${until}"`
					);
					own.stake = 'former';
					own.until = until;
					fixes++;
				}
			}
		}
	}
}

if (fixes > 0) {
	const trailing = raw.endsWith('\n') ? '\n' : '';
	fs.writeFileSync(dataPath, JSON.stringify(data, null, 2) + trailing);
	console.error(`coerce-data: applied ${fixes} fix(es) to ${path.relative(process.cwd(), dataPath)}`);
} else {
	console.error('coerce-data: no fixes needed');
}
