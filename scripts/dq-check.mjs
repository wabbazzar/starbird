// Data-quality gate for the Judge and the runner.
// Runs the zod schema PLUS structural checks the schema can't express:
//   - stray/undeclared keys (z.object silently strips them, polluting the file)
//   - ownership FK integrity (reported, not just failed)
//   - tag -> evidence linkage (Phase 3: every harm/align tag on an entity that
//     carries an evidence[] array must have a matching evidence.tag)
//   - scope/role presence (rubric v2: both are required on every firm)
//   - per-cohort harmScore drift (rubric v2: identical conduct must score the
//     same regardless of which month the runner found it)
// Emits a machine-readable JSON summary on stdout and exits 0 (pass) / 1 (fail).
//
// Run with: npx tsx scripts/dq-check.mjs   (tsx resolves the .ts schema import)
import { DataFileSchema, FirmSchema, BrandSchema } from '../src/lib/schema.ts';
import data from '../static/data.json' with { type: 'json' };

const report = {
	pass: true,
	schema: { ok: true, issues: [] },
	strayKeys: [],
	fkDangling: [],
	evidence: { entitiesWithEvidence: 0, tagLinkageMisses: [] },
	scopeRole: { missing: [] },
	cohortDrift: { spread: 0, limit: 10, cohorts: [] },
	counts: { firms: 0, brands: 0 }
};
const fail = (msg) => {
	report.pass = false;
	return msg;
};

// 1. Schema
const parsed = DataFileSchema.safeParse(data);
if (!parsed.success) {
	report.schema.ok = false;
	report.schema.issues = parsed.error.issues.map((i) => `${i.path.join('.')}: ${i.message}`);
	fail('schema');
}

report.counts.firms = (data.firms ?? []).length;
report.counts.brands = (data.brands ?? []).length;

// 2. Stray keys — anything not in the schema shape is a silent pollutant.
const firmKeys = new Set(Object.keys(FirmSchema.shape));
const brandKeys = new Set(Object.keys(BrandSchema.shape));
const checkStray = (arr, allowed, kind) => {
	for (const o of arr ?? []) {
		for (const k of Object.keys(o)) {
			if (!allowed.has(k)) {
				report.strayKeys.push({ kind, id: o.id, key: k });
				fail('strayKeys');
			}
		}
	}
};
checkStray(data.firms, firmKeys, 'firm');
checkStray(data.brands, brandKeys, 'brand');

// 3. FK integrity
const firmIds = new Set((data.firms ?? []).map((f) => f.id));
for (const b of data.brands ?? []) {
	for (const o of b.ownership ?? []) {
		if (!firmIds.has(o.firmId)) {
			report.fkDangling.push({ brand: b.id, firmId: o.firmId });
			fail('fkDangling');
		}
	}
}

// 4. Tag -> evidence linkage (only enforced on entities that carry evidence[]).
const checkEvidence = (arr, kind) => {
	for (const o of arr ?? []) {
		if (!Array.isArray(o.evidence)) continue;
		report.evidence.entitiesWithEvidence++;
		const evidenceTags = new Set(o.evidence.map((e) => e.tag));
		for (const tag of [...(o.harms ?? []), ...(o.aligns ?? [])]) {
			if (!evidenceTags.has(tag)) {
				report.evidence.tagLinkageMisses.push({ kind, id: o.id, tag });
				fail('evidenceLinkage');
			}
		}
	}
};
checkEvidence(data.firms, 'firm');
checkEvidence(data.brands, 'brand');

// 5. scope/role presence (rubric v2). verify-harm-score.py enforces the
// numeric bands; this is the structural half, so a missing field is caught by
// whichever gate runs first.
for (const f of data.firms ?? []) {
	if (!f.scope || !f.role) {
		report.scopeRole.missing.push({ id: f.id, scope: f.scope ?? null, role: f.role ?? null });
		fail('scopeRole');
	}
}

// 6. Per-cohort drift. Before v2, median harmScore by addedAt month ran 60 ->
// 79, meaning rank order partly encoded *when* the runner found an entity. The
// aligned firms (0-19) are a separate population and are excluded — mixing them
// in makes the harmful-firm median meaningless.
const byMonth = new Map();
for (const f of data.firms ?? []) {
	if (typeof f.harmScore !== 'number' || f.harmScore < 20) continue;
	const m = (f.addedAt ?? 'unknown').slice(0, 7);
	if (!byMonth.has(m)) byMonth.set(m, []);
	byMonth.get(m).push(f.harmScore);
}
const median = (a) => {
	const s = [...a].sort((x, y) => x - y);
	return s.length % 2 ? s[(s.length - 1) / 2] : (s[s.length / 2 - 1] + s[s.length / 2]) / 2;
};
// A handful of firms in a month isn't a cohort — its median is noise.
const MIN_COHORT = 10;
report.cohortDrift.cohorts = [...byMonth.entries()]
	.filter(([, v]) => v.length >= MIN_COHORT)
	.sort()
	.map(([month, v]) => ({ month, n: v.length, median: median(v) }));
if (report.cohortDrift.cohorts.length > 1) {
	const meds = report.cohortDrift.cohorts.map((c) => c.median);
	report.cohortDrift.spread = Math.max(...meds) - Math.min(...meds);
	if (report.cohortDrift.spread > report.cohortDrift.limit) fail('cohortDrift');
}

console.log(JSON.stringify(report, null, 2));
if (!report.pass) {
	console.error('\nDATA-QUALITY FAIL');
	process.exit(1);
}
console.error('\ndata-quality OK');
