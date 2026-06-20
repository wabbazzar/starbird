<script lang="ts">
	import type { Firm, Brand } from '$lib/types';
	import { categoryValueHeatmap } from '$lib/aggregations';

	type Props = { firms: Firm[]; brands: Brand[] };
	let { firms, brands }: Props = $props();

	const m = $derived(categoryValueHeatmap(firms, brands));
	const cell = (cat: string, value: string) =>
		m.cells.find((c) => c.cat === cat && c.value === value)?.count ?? 0;
	// 0 → transparent, max → full accent. Gamma-ish ramp so mid values read.
	const intensity = (n: number) => (m.max ? Math.sqrt(n / m.max) : 0);
</script>

<section class="block">
	<div class="section-label">// Where harm concentrates — category × value (entity count)</div>
	<p class="caption">Sparse categories are folded into “Other”. Darker = more entities.</p>
	<div class="grid" style="grid-template-columns: 84px repeat({m.values.length}, 1fr);">
		<div class="corner"></div>
		{#each m.values as v (v.id)}
			<div class="col-head" title={v.label}>{v.label}</div>
		{/each}
		{#each m.categories as c (c.id)}
			<div class="row-head" title={c.label}>{c.label}</div>
			{#each m.values as v (v.id)}
				{@const n = cell(c.id, v.id)}
				<div
					class="cell"
					style="background: color-mix(in srgb, var(--avoid) {intensity(n) * 100}%, var(--surface-2));"
					title="{c.label} · {v.label}: {n}"
				>
					<span class:dim={intensity(n) < 0.5}>{n || ''}</span>
				</div>
			{/each}
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
	.section-label {
		font-family: 'DM Mono', monospace;
		font-size: 0.66rem;
		color: var(--ink-muted);
		letter-spacing: 0.04em;
	}
	.caption {
		font-size: 0.72rem;
		color: var(--ink-faint);
		margin: 6px 0 8px;
	}
	.grid {
		display: grid;
		gap: 3px;
		align-items: stretch;
	}
	.corner {
		background: none;
	}
	.col-head {
		font-size: 0.58rem;
		color: var(--ink-faint);
		text-align: center;
		align-self: end;
		line-height: 1.1;
		overflow: hidden;
		text-overflow: ellipsis;
		white-space: nowrap;
	}
	.row-head {
		font-size: 0.66rem;
		color: var(--ink-muted);
		display: flex;
		align-items: center;
		white-space: nowrap;
		overflow: hidden;
		text-overflow: ellipsis;
	}
	.cell {
		aspect-ratio: 1 / 1;
		min-height: 26px;
		border-radius: 4px;
		display: flex;
		align-items: center;
		justify-content: center;
		font-family: 'DM Mono', monospace;
		font-size: 0.64rem;
		color: var(--bg);
		font-weight: 600;
	}
	.cell span.dim {
		color: var(--ink-faint);
		font-weight: 400;
	}
</style>
