// Phase 2 of docs/tickets/pending/harm-score-recalibration.md
//
// Assigns firms[].scope and firms[].role to every firm in static/data.json.
//
//   scope -> how far the harm reaches; caps and floors the effective score
//   role  -> whose conduct the score describes; sets the brand inheritance haircut
//
// Deterministic rules first (below), then scripts/scope-overrides.json wins.
// The rules cannot distinguish a single-contract LLC from ExxonMobil — both are
// aumVal 0 with one harm tag — so every case where they'd be wrong lives in the
// override file with a written note.
//
//   node scripts/backfill-scope-role.mjs --dry-run
//   node scripts/backfill-scope-role.mjs
import { readFileSync, writeFileSync } from 'node:fs';

const DATA = new URL('../static/data.json', import.meta.url);
const OVERRIDES = new URL('./scope-overrides.json', import.meta.url);
const DRY = process.argv.includes('--dry-run');

/** Mirrors SCOPE_CAP in src/lib/ranking.ts — kept in sync by ranking.test.ts. */
const CAP = { narrow: 65, single_company: 79, multi_company: 94, systemic: 100 };

function baseRule(f) {
	// Funds are owners by construction; AUM is the only reliable scale signal
	// the dataset carries, so it drives the split.
	if (f.aumVal >= 100) return ['systemic', 'owner'];
	if (f.aumVal > 0) return ['multi_company', 'owner'];

	// The sole-ICE-contract cohort: a firm whose only recorded harm is one
	// federal contract relationship. This is the single-vendor population the
	// runner has been adding since June, and it is the one group where a
	// tag-based rule genuinely tracks scope.
	if (f.harms.length === 1 && f.harms[0] === 'workers_ice_cooperation') {
		return ['narrow', 'actor'];
	}

	// Everything else: one company's own conduct. Cap 79 means any 80+ score
	// must be justified in scope-overrides.json rather than assumed.
	return ['single_company', 'actor'];
}

const data = JSON.parse(readFileSync(DATA, 'utf8'));
const overrides = JSON.parse(readFileSync(OVERRIDES, 'utf8'));

const counts = { narrow: 0, single_company: 0, multi_company: 0, systemic: 0 };
const roles = { actor: 0, owner: 0, both: 0 };
let overridden = 0;
const stillCapped = [];

for (const f of data.firms) {
	let [scope, role] = baseRule(f);
	const ov = overrides[f.id];
	if (ov) {
		scope = ov.scope ?? scope;
		role = ov.role ?? role;
		overridden++;
	}
	f.scope = scope;
	f.role = role;
	counts[scope]++;
	roles[role]++;
	if (f.harmScore > CAP[scope]) {
		stillCapped.push({ id: f.id, name: f.name, score: f.harmScore, scope, cap: CAP[scope] });
	}
}

// Unknown ids in the override file are almost always a typo or a firm that got
// merged away — surface them rather than silently ignoring.
const firmIds = new Set(data.firms.map((f) => f.id));
const overrideIds = Object.keys(overrides).filter((k) => !k.startsWith('_'));
const orphans = overrideIds.filter((k) => !firmIds.has(k));

console.log('scope:', counts);
console.log('role: ', roles);
console.log(`overrides applied: ${overridden} of ${overrideIds.length}`);
if (orphans.length) console.error('ORPHAN override ids (no such firm):', orphans);

console.log(`\nfirms whose stored harmScore exceeds their scope cap: ${stillCapped.length}`);
console.table(stillCapped.sort((a, b) => b.score - a.score).slice(0, 40));

if (DRY) {
	console.log('\n--dry-run: nothing written');
} else {
	writeFileSync(DATA, JSON.stringify(data, null, '\t') + '\n');
	console.log('\nwrote static/data.json');
}
