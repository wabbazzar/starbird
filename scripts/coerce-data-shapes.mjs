#!/usr/bin/env node
// Mechanically normalize known-recoverable shape errors before schema validation.
// Runs between Claude's edit pass and validate-data.mjs in the runner pipeline.
// Exits 0 if the file was valid or was coerced to valid; exits 1 on write failure.

import { readFileSync, writeFileSync } from 'fs';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const __dirname = dirname(fileURLToPath(import.meta.url));
const DATA_PATH = join(__dirname, '../static/data.json');

// ── Coerce a single ownership record ────────────────────────────────────────

export function coerceOwnership(own) {
	const result = { ...own };

	// 1. Integer since/until → string
	if (typeof result.since === 'number') {
		result.since = String(result.since);
	}
	if (typeof result.until === 'number') {
		result.until = String(result.until);
	}

	// 2. stake "self-owned" → "majority"
	if (result.stake === 'self-owned') {
		result.stake = 'majority';
	}

	// 3. stake "majority (YYYY-YYYY)" or "minority (YYYY-YYYY)" → former + since + until
	const rangeMatch = typeof result.stake === 'string' && result.stake.match(/^(?:majority|minority)\s+\((\d{4})-(\d{4})\)$/);
	if (rangeMatch) {
		if (!result.since) result.since = rangeMatch[1];
		result.until = rangeMatch[2];
		result.stake = 'former';
	}

	// 4. IP-license variants → post_bankrupt
	if (result.stake === 'IP owner' || result.stake === 'licensee' || result.stake === 'trademark holder') {
		result.stake = 'post_bankrupt';
	}

	return result;
}

// ── Coerce an entire data structure ─────────────────────────────────────────

export function coerceData(data) {
	const result = { ...data };
	result.brands = (data.brands || []).map((brand) => ({
		...brand,
		ownership: (brand.ownership || []).map(coerceOwnership)
	}));
	return result;
}

// ── CLI entry point ──────────────────────────────────────────────────────────

if (process.argv[1] === fileURLToPath(import.meta.url)) {
	const raw = readFileSync(DATA_PATH, 'utf8');
	const data = JSON.parse(raw);
	const coerced = coerceData(data);

	const changes = [];
	(coerced.brands || []).forEach((brand, bi) => {
		(brand.ownership || []).forEach((own, oi) => {
			const orig = data.brands[bi].ownership[oi];
			if (JSON.stringify(own) !== JSON.stringify(orig)) {
				changes.push(`  brands[${bi}].ownership[${oi}] (${brand.id || brand.avoid}): ${JSON.stringify(orig)} → ${JSON.stringify(own)}`);
			}
		});
	});

	if (changes.length === 0) {
		console.log('[coerce-data-shapes] no changes needed');
		process.exit(0);
	}

	console.log(`[coerce-data-shapes] coercing ${changes.length} ownership record(s):`);
	changes.forEach((c) => console.log(c));

	writeFileSync(DATA_PATH, JSON.stringify(coerced, null, '\t'));
	console.log('[coerce-data-shapes] data.json updated');
	process.exit(0);
}
