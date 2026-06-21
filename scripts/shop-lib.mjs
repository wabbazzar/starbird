// Shared logic for the /shop skill (.claude/commands/shop.md).
//
// One source of truth so the skill isn't reimplementing scoring in prose:
// it reuses brandImpactScore() from src/lib/ranking.ts (the same 5-point PE
// inheritance discount the website uses), the harm-score buckets, and the
// canonical firm/brand SHAPE from src/lib/schema.ts.
//
// IMPORTANT: Tier-2 research is always persisted as proper data.json-shaped
// firm + brand entries — the exact "badges" the app renders — never a loose
// ad-hoc profile. tmp/shop-candidates.json mirrors static/data.json:
//   { "version": 2, "firms": [ <FirmSchema> ], "brands": [ <BrandSchema> ] }
// so promotion to the canonical DB is a trivial, schema-validated merge.
//
// Run via tsx (the repo's TS-aware node wrapper), e.g.:
//   npx tsx scripts/shop-lib.mjs resolve "Quikrete" "Sakrete"
//   echo '<json>' | npx tsx scripts/shop-lib.mjs cache-add   # firm+brand entry
//   npx tsx scripts/shop-lib.mjs promote                     # merge cache → data.json
//
// Tier 1 (DB vetting) is fully offline — it only reads static/data.json.

import { readFileSync, writeFileSync, existsSync, mkdirSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import { brandImpactScore, indexFirms } from '../src/lib/ranking.ts';
import { DataFileSchema } from '../src/lib/schema.ts';
import data from '../static/data.json' with { type: 'json' };

const HERE = dirname(fileURLToPath(import.meta.url));
const DATA_PATH = join(HERE, '..', 'static', 'data.json');
const CACHE_PATH = join(HERE, '..', 'tmp', 'shop-candidates.json');

// ── Locked thresholds (see docs/tickets/shop-skill.md, decision #2) ──────────
// Safe to buy  = absent from DB, OR present with harmScore < 40.
// Avoid        = 40–79  → find an alternative.
// Hard block   = >= 80  → never recommend, even on direct request.
export const SAFE_BELOW = 40;
export const BLOCK_AT = 80;

// Harm-score buckets, verbatim from src/lib/harm-score-rubric.json (0–100).
const BUCKETS = [
	{ max: 19, label: 'Minimal' },
	{ max: 39, label: 'Moderate' },
	{ max: 59, label: 'Significant' },
	{ max: 79, label: 'Severe' },
	{ max: 94, label: 'Extreme' },
	{ max: 100, label: 'Catastrophic' }
];

export function bucketFor(score) {
	return BUCKETS.find((b) => score <= b.max)?.label ?? 'Unknown';
}

export function classify(score) {
	if (score >= BLOCK_AT) return 'block';
	if (score >= SAFE_BELOW) return 'avoid';
	return 'ok';
}

function norm(s) {
	return String(s)
		.toLowerCase()
		.replace(/[^a-z0-9]+/g, ' ')
		.trim();
}

// Loose name match: exact normalized equality, or one fully contains the
// other as a substring (guarded so 3-char fragments don't false-match).
function nameMatch(query, candidate) {
	const a = norm(query);
	const b = norm(candidate);
	if (!a || !b) return false;
	if (a === b) return true;
	if (a.length >= 4 && b.includes(a)) return true;
	if (b.length >= 4 && a.includes(b)) return true;
	return false;
}

// ── Cache: same shape as static/data.json (firms[] + brands[]) ───────────────

export function cacheRead() {
	if (!existsSync(CACHE_PATH)) return { version: 2, firms: [], brands: [] };
	try {
		const c = JSON.parse(readFileSync(CACHE_PATH, 'utf8'));
		return { version: 2, firms: c.firms ?? [], brands: c.brands ?? [] };
	} catch {
		return { version: 2, firms: [], brands: [] };
	}
}

// Firm index over BOTH the canonical DB and the Tier-2 cache, so a cached
// brand can inherit its (possibly cached) parent firm's harmScore.
function mergedFirmIndex(cache) {
	return indexFirms([...data.firms, ...cache.firms]);
}

/**
 * Look a candidate name up in static/data.json (Tier 1) and in the local
 * Tier-2 cache. Returns a verdict object; verdict.found === false means
 * "not in DB → provisionally safe, may want Tier 2 verification".
 */
export function resolve(name) {
	const cache = cacheRead();
	const firmById = mergedFirmIndex(cache);

	const brandPool = [
		...data.brands.map((b) => ({ b, src: 'database' })),
		...cache.brands.map((b) => ({ b, src: 'cache' }))
	];
	for (const { b, src } of brandPool) {
		if (nameMatch(name, b.avoid) || nameMatch(name, b.id)) {
			const owners = b.ownership
				.map((o) => firmById.get(o.firmId)?.name ?? o.firmId)
				.join(', ');
			return verdict({
				query: name,
				found: true,
				source: src,
				matchType: 'brand',
				name: b.avoid,
				id: b.id,
				owners,
				score: brandImpactScore(b, firmById),
				harms: b.harms,
				alts: b.alts ?? []
			});
		}
	}

	const firmPool = [
		...data.firms.map((f) => ({ f, src: 'database' })),
		...cache.firms.map((f) => ({ f, src: 'cache' }))
	];
	for (const { f, src } of firmPool) {
		const inList = (f.brands ?? []).some((bn) => nameMatch(name, bn));
		if (nameMatch(name, f.name) || nameMatch(name, f.id) || inList) {
			const discount = f.aumVal > 0 ? 5 : 0;
			return verdict({
				query: name,
				found: true,
				source: src,
				matchType: inList ? 'firm-brandlist' : 'firm',
				name: inList ? name : f.name,
				id: f.id,
				owners: f.name,
				score: Math.max(0, (f.harmScore ?? 0) - discount),
				harms: f.harms ?? [],
				alts: []
			});
		}
	}

	return verdict({ query: name, found: false });
}

function verdict(v) {
	if (!v.found) {
		return {
			...v,
			tier: 'unknown',
			bucket: null,
			recommendation: 'NOT IN DB — provisionally safe; run Tier 2 to verify'
		};
	}
	const tier = classify(v.score);
	const bucket = bucketFor(v.score);
	const rec =
		tier === 'ok'
			? `OK TO BUY (score ${v.score}, ${bucket})`
			: tier === 'avoid'
				? `AVOID — find an alternative (score ${v.score}, ${bucket})`
				: `HARD BLOCK — never recommend (score ${v.score}, ${bucket})`;
	return { ...v, tier, bucket, recommendation: rec };
}

// ── Persist Tier-2 entries (proper firm/brand shape) ─────────────────────────

function mergeById(list, incoming) {
	const out = [...list];
	for (const item of incoming) {
		const i = out.findIndex((x) => x.id === item.id);
		if (i >= 0) out[i] = item;
		else out.push(item);
	}
	return out;
}

/**
 * Add proper firm/brand entries to the cache. `payload` accepts
 * { firms?, brands?, firm?, brand? }. Validates the UNION of the canonical DB
 * and the resulting cache against DataFileSchema so a cached badge is already
 * promotion-ready (ownership refs resolve, ids unique, tags valid).
 */
export function cacheAdd(payload) {
	const cache = cacheRead();
	const firms = [...(payload.firms ?? []), ...(payload.firm ? [payload.firm] : [])];
	const brands = [...(payload.brands ?? []), ...(payload.brand ? [payload.brand] : [])];
	cache.firms = mergeById(cache.firms, firms);
	cache.brands = mergeById(cache.brands, brands);

	const union = {
		version: 2,
		firms: [...data.firms, ...cache.firms],
		brands: [...data.brands, ...cache.brands]
	};
	const res = DataFileSchema.safeParse(union);
	if (!res.success) {
		const msgs = res.error.issues.map((i) => `  - ${i.path.join('.')}: ${i.message}`);
		throw new Error(`cache-add rejected — entry is not promotion-ready:\n${msgs.join('\n')}`);
	}

	mkdirSync(dirname(CACHE_PATH), { recursive: true });
	writeFileSync(CACHE_PATH, JSON.stringify(cache, null, 2) + '\n');
	return { firms: firms.length, brands: brands.length };
}

/**
 * Merge cache firms/brands into static/data.json (dedup by id, canonical
 * entries win), preserving `version` as the first key. Returns counts. The
 * caller is expected to run scripts/validate-data.mjs afterwards (the runner
 * gate) and open a PR — promotion is never auto-committed.
 */
export function promote() {
	const cache = cacheRead();
	const raw = JSON.parse(readFileSync(DATA_PATH, 'utf8'));
	const firmIds = new Set(raw.firms.map((f) => f.id));
	const brandIds = new Set(raw.brands.map((b) => b.id));
	const addedFirms = cache.firms.filter((f) => !firmIds.has(f.id));
	const addedBrands = cache.brands.filter((b) => !brandIds.has(b.id));

	const merged = {
		version: raw.version ?? 2,
		firms: [...raw.firms, ...addedFirms],
		brands: [...raw.brands, ...addedBrands]
	};
	const res = DataFileSchema.safeParse(merged);
	if (!res.success) {
		const msgs = res.error.issues.map((i) => `  - ${i.path.join('.')}: ${i.message}`);
		throw new Error(`promote aborted — merged data.json invalid:\n${msgs.join('\n')}`);
	}
	writeFileSync(DATA_PATH, JSON.stringify(merged, null, 2) + '\n');
	return {
		addedFirms: addedFirms.map((f) => f.id),
		addedBrands: addedBrands.map((b) => b.id)
	};
}

// ── CLI ──────────────────────────────────────────────────────────────────────

function readStdin() {
	try {
		return readFileSync(0, 'utf8');
	} catch {
		return '';
	}
}

const [cmd, ...rest] = process.argv.slice(2);

if (cmd === 'resolve') {
	const names = rest.filter((a) => a !== '--json');
	const results = names.map(resolve);
	if (rest.includes('--json')) {
		console.log(JSON.stringify(results, null, 2));
	} else {
		for (const r of results) {
			console.log(`\n● ${r.query}`);
			console.log(`  ${r.recommendation}`);
			if (r.found) {
				console.log(`  source: ${r.source}${r.owners ? ` · owner(s): ${r.owners}` : ''}`);
				if (r.harms?.length) console.log(`  harms: ${r.harms.join(', ')}`);
				if (r.alts?.length) console.log(`  curated alts: ${r.alts.join(', ')}`);
			}
		}
		console.log('');
	}
} else if (cmd === 'cache-list') {
	console.log(JSON.stringify(cacheRead(), null, 2));
} else if (cmd === 'cache-add') {
	const raw = rest.length && rest[0] !== '-' ? rest.join(' ') : readStdin();
	const counts = cacheAdd(JSON.parse(raw));
	console.error(`cached ${counts.firms} firm(s) + ${counts.brands} brand(s) — schema-valid`);
} else if (cmd === 'promote') {
	const r = promote();
	console.error(
		`promoted to static/data.json: +${r.addedFirms.length} firm(s) [${r.addedFirms.join(', ')}], ` +
			`+${r.addedBrands.length} brand(s) [${r.addedBrands.join(', ')}]`
	);
	console.error('next: `npx tsx scripts/validate-data.mjs` then open a PR.');
} else if (cmd === 'thresholds') {
	console.log(JSON.stringify({ SAFE_BELOW, BLOCK_AT, buckets: BUCKETS }, null, 2));
} else {
	console.error(
		[
			'Usage:',
			'  resolve <name> [<name>...] [--json]   vet candidate(s) against DB + cache',
			'  cache-list                            dump tmp/shop-candidates.json',
			'  cache-add <json> | (stdin)            persist firm/brand entries (schema-checked)',
			'  promote                               merge cache → static/data.json (then validate + PR)',
			'  thresholds                            print SAFE/BLOCK cutoffs + buckets'
		].join('\n')
	);
	process.exit(cmd ? 1 : 0);
}
