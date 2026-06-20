<script lang="ts">
	import type { Firm, Brand } from '$lib/types';
	import type { ValueId } from '$lib/values';
	import { VALUES } from '$lib/values';
	import { QUEST_BY_ID } from '$lib/quests';
	import { brandImpactScore, indexFirms } from '$lib/ranking';
	import { CATEGORIES, type CategoryId } from '$lib/categories';
	import HarmHistogram from './HarmHistogram.svelte';
	import CategoryValueHeatmap from './CategoryValueHeatmap.svelte';

	type Props = {
		firms: Firm[];
		brands: Brand[];
		/** Drill from the histogram into firms in a score band. */
		onselectband?: (min: number, max: number) => void;
	};
	let { firms, brands, onselectband }: Props = $props();

	const TOP_N = 20;

	// Leaderboard scope: 'all' or a single category. A single global top-N
	// represents a shrinking slice as the dataset grows, so let the user ask
	// "worst in <category>".
	let scope = $state<CategoryId | 'all'>('all');
	const scopedFirms = $derived(
		scope === 'all' ? firms : firms.filter((f) => f.cats.includes(scope as CategoryId))
	);
	const scopedBrands = $derived(
		scope === 'all' ? brands : brands.filter((b) => b.cat === scope)
	);

	// Index firms for O(1) lookup from brand.ownership
	const firmById = $derived(indexFirms(firms));

	// ── Chart 1: unique entity count per value system ──────────────────
	// Counts each entity once per value, deduping self-owned firm+brand
	// pairs (same logic as scripts/update-strategy-scores.py).
	const byValue = $derived.by(() => {
		const seen = new Map<ValueId, Set<string>>();
		for (const v of VALUES) seen.set(v.id, new Set());

		for (const f of firms) {
			const touched = new Set<ValueId>();
			for (const q of f.harms) {
				const v = QUEST_BY_ID[q]?.value;
				if (v) touched.add(v);
			}
			for (const v of touched) seen.get(v)!.add(`firm:${f.id}`);
		}
		for (const b of brands) {
			const touched = new Set<ValueId>();
			for (const q of b.harms) {
				const v = QUEST_BY_ID[q]?.value;
				if (v) touched.add(v);
			}
			for (const v of touched) {
				// Skip if a firm record with the same id is already counted
				// for this value — self-owned companies (brand.id == firm.id)
				// are one entity, not two.
				if (seen.get(v)!.has(`firm:${b.id}`)) continue;
				seen.get(v)!.add(`brand:${b.id}`);
			}
		}

		return VALUES.map((v) => ({
			id: v.id,
			label: v.label,
			count: seen.get(v.id)!.size
		}));
	});
	const maxValueCount = $derived(Math.max(...byValue.map((v) => v.count), 1));

	// ── Chart 2: top brands by impact ──────────────────────────────────
	// Uses the SHARED brandImpactScore (with the 5-pt PE inheritance discount)
	// so this chart's ordering matches the Brands list exactly — previously it
	// re-implemented the formula WITHOUT the discount and could disagree.
	const topBrands = $derived(
		[...scopedBrands]
			.map((b) => ({ brand: b, score: brandImpactScore(b, firmById) }))
			.sort((a, b) => b.score - a.score)
			.slice(0, TOP_N)
	);
	const maxBrandImpact = $derived(Math.max(...topBrands.map((b) => b.score), 1));

	// ── Chart 3: AUM (elongated from 10 → 20) ──────────────────────────
	const byAum = $derived(
		[...scopedFirms]
			.filter((f) => f.aumVal > 0)
			.sort((a, b) => b.aumVal - a.aumVal)
			.slice(0, TOP_N)
	);
	const maxAum = $derived(Math.max(...byAum.map((f) => f.aumVal), 1));

	// ── Chart 4: Harm Score (elongated from 10 → 20) ───────────────────
	const byHarm = $derived(
		[...scopedFirms].sort((a, b) => b.harmScore - a.harmScore).slice(0, TOP_N)
	);
	const maxHarm = $derived(Math.max(...byHarm.map((f) => f.harmScore), 1));
</script>

<HarmHistogram {firms} onselect={onselectband} />

<CategoryValueHeatmap {firms} {brands} />

<div class="scope-bar">
	<label for="scope">Leaderboard scope</label>
	<select id="scope" bind:value={scope}>
		<option value="all">All categories</option>
		{#each CATEGORIES as c (c.id)}
			<option value={c.id}>{c.label}</option>
		{/each}
	</select>
</div>

<section class="block">
	<div class="section-label">// Coverage — Unique entities per value system</div>
	<div class="chart">
		{#each byValue as v (v.id)}
			<div class="row">
				<div class="name">{v.label}</div>
				<div class="bar-wrap">
					<div
						class="bar bar-value"
						style="width: {(v.count / maxValueCount) * 100}%"
					></div>
				</div>
				<div class="val">{v.count}</div>
			</div>
		{/each}
	</div>
</section>

<section class="block">
	<div class="section-label">
		// Top brands — Highest-impact consumer brands (max owner harm score)
	</div>
	<div class="chart">
		{#each topBrands as b (b.brand.id)}
			<div class="row">
				<div class="name">{b.brand.avoid}</div>
				<div class="bar-wrap">
					<div
						class="bar bar-harm"
						style="width: {(b.score / maxBrandImpact) * 100}%"
					></div>
				</div>
				<div class="val">{b.score}</div>
			</div>
		{/each}
	</div>
</section>

<section class="block">
	<div class="section-label">// AUM — Assets under management ($B), top {TOP_N}</div>
	<div class="chart">
		{#each byAum as f (f.id)}
			<div class="row">
				<div class="name">{f.name}</div>
				<div class="bar-wrap">
					<div class="bar" style="width: {(f.aumVal / maxAum) * 100}%"></div>
				</div>
				<div class="val">${f.aumVal}B</div>
			</div>
		{/each}
	</div>
</section>

<section class="block">
	<div class="section-label">// Harm score — Top {TOP_N} firms (0–100)</div>
	<div class="chart">
		{#each byHarm as f (f.id)}
			<div class="row">
				<div class="name">{f.name}</div>
				<div class="bar-wrap">
					<div class="bar bar-harm" style="width: {(f.harmScore / maxHarm) * 100}%"></div>
				</div>
				<div class="val">{f.harmScore}</div>
			</div>
		{/each}
	</div>
</section>

<style>
	.block {
		background: var(--surface);
		border: 1px solid var(--border);
		border-radius: var(--radius);
		padding: 14px 16px;
		margin-bottom: 12px;
	}
	.scope-bar {
		display: flex;
		align-items: center;
		gap: 8px;
		margin-bottom: 12px;
		font-family: 'DM Mono', monospace;
		font-size: 0.62rem;
		text-transform: uppercase;
		letter-spacing: 0.08em;
		color: var(--ink-faint);
	}
	.scope-bar select {
		font-family: inherit;
		font-size: 0.72rem;
		padding: 4px 8px;
		border-radius: 6px;
		border: 1px solid var(--border);
		background: var(--surface);
		color: var(--ink);
		text-transform: none;
		letter-spacing: 0;
	}
	.chart {
		margin-top: 10px;
	}
	.row {
		display: grid;
		grid-template-columns: 110px 1fr 54px;
		gap: 10px;
		align-items: center;
		padding: 4px 0;
		font-size: 0.72rem;
	}
	.name {
		color: var(--ink-muted);
		white-space: nowrap;
		overflow: hidden;
		text-overflow: ellipsis;
	}
	.bar-wrap {
		background: var(--surface-2);
		border-radius: 4px;
		height: 14px;
		overflow: hidden;
	}
	.bar {
		height: 100%;
		background: var(--primary);
		border-radius: 4px;
		transition: width 200ms ease;
	}
	.bar-harm {
		background: var(--avoid);
	}
	.bar-value {
		background: var(--gold);
	}
	.val {
		font-family: 'DM Mono', monospace;
		color: var(--ink);
		text-align: right;
	}
</style>
