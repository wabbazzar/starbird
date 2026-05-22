#!/usr/bin/env node
// Mechanical normalization of known-recoverable shape errors that Claude Sonnet
// produces when writing ownership records. Runs between Claude's edit pass and
// validate-data.mjs in the runner pipeline. Non-recoverable errors are left
// untouched so the schema gate can report them cleanly.
//
// Coercions applied (all keys on OwnershipSchema):
//   since/until: number → string
//   stake "self-owned"                        → "majority"
//   stake "majority (YYYY-YYYY)"              → "former" + until="YYYY"
//   stake "IP owner"|"IP_only"|"licensee"|
//         "trademark holder"                  → "post_bankrupt"
//   stake "operator"                          → "former"

import { readFileSync, writeFileSync } from 'fs';
import { resolve, dirname } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const DATA_PATH = resolve(__dirname, '../static/data.json');

const data = JSON.parse(readFileSync(DATA_PATH, 'utf-8'));
let changes = 0;

const MAJORITY_YEAR_RE = /^majority\s*\((\d{4})-(\d{4})\)$/i;
const IP_LIKE = new Set(['IP owner', 'IP_only', 'licensee', 'trademark holder']);

function coerceOwnership(own, label) {
	let changed = false;

	// since/until: number → string
	for (const key of ['since', 'until']) {
		if (typeof own[key] === 'number') {
			console.log(`  ${label}.${key}: ${own[key]} (number) → "${own[key]}" (string)`);
			own[key] = String(own[key]);
			changed = true;
		}
	}

	if (typeof own.stake === 'string') {
		const stake = own.stake;

		if (stake === 'self-owned') {
			console.log(`  ${label}.stake: "self-owned" → "majority"`);
			own.stake = 'majority';
			changed = true;
		} else if (IP_LIKE.has(stake)) {
			console.log(`  ${label}.stake: "${stake}" → "post_bankrupt"`);
			own.stake = 'post_bankrupt';
			changed = true;
		} else if (stake === 'operator') {
			console.log(`  ${label}.stake: "operator" → "former"`);
			own.stake = 'former';
			changed = true;
		} else {
			const m = stake.match(MAJORITY_YEAR_RE);
			if (m) {
				const until = m[2];
				console.log(`  ${label}.stake: "${stake}" → "former" + until="${until}"`);
				own.stake = 'former';
				own.until = until;
				changed = true;
			}
		}
	}

	return changed;
}

for (const brand of data.brands) {
	for (let i = 0; i < brand.ownership.length; i++) {
		const label = `brands[${brand.id}].ownership[${i}]`;
		if (coerceOwnership(brand.ownership[i], label)) changes++;
	}
}

if (changes > 0) {
	writeFileSync(DATA_PATH, JSON.stringify(data, null, 2) + '\n');
	console.log(`coerce-data-shapes: ${changes} ownership record(s) fixed`);
} else {
	console.log('coerce-data-shapes: no changes needed');
}
