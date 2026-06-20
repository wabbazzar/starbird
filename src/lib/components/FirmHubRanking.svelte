<script lang="ts">
	import type { Firm, Brand } from '$lib/types';
	import { firmHubs } from '$lib/aggregations';

	type Props = { firms: Firm[]; brands: Brand[]; topN?: number; onselect?: (id: string) => void };
	let { firms, brands, topN = 15, onselect }: Props = $props();

	const hubs = $derived(firmHubs(firms, brands, topN));
	const maxCount = $derived(Math.max(...hubs.map((h) => h.brandCount), 1));
	const brandsOf = (firmId: string) =>
		brands.filter((b) => b.ownership.some((o) => o.firmId === firmId));

	let expanded = $state<string | null>(null);
</script>

<section class="block">
	<div class="section-label">// Ownership hubs — firms by number of brands owned</div>
	<p class="caption">The PE-network thesis: a few firms sit behind many consumer brands. Click to expand.</p>
	<div class="chart">
		{#each hubs as h (h.id)}
			<button type="button" class="row" onclick={() => (expanded = expanded === h.id ? null : h.id)}>
				<div class="name">{h.name}</div>
				<div class="bar-wrap">
					<div class="bar" style="width: {(h.brandCount / maxCount) * 100}%"></div>
				</div>
				<div class="val">{h.brandCount}</div>
			</button>
			{#if expanded === h.id}
				<ul class="brands">
					{#each brandsOf(h.id) as b (b.id)}
						<li>
							<button type="button" class="brand-link" onclick={() => onselect?.(b.id)}>{b.avoid}</button>
						</li>
					{/each}
				</ul>
			{/if}
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
		margin: 6px 0 4px;
	}
	.chart {
		margin-top: 8px;
	}
	.row {
		display: grid;
		grid-template-columns: 150px 1fr 32px;
		gap: 10px;
		align-items: center;
		padding: 4px 0;
		font-size: 0.72rem;
		width: 100%;
		background: none;
		border: none;
		cursor: pointer;
		text-align: left;
		color: inherit;
		border-radius: 4px;
	}
	.row:hover {
		background: var(--surface-2);
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
	}
	.val {
		font-family: 'DM Mono', monospace;
		color: var(--ink);
		text-align: right;
	}
	.brands {
		list-style: none;
		margin: 2px 0 8px 12px;
		padding: 6px 0 6px 10px;
		border-left: 2px solid var(--border);
		display: flex;
		flex-wrap: wrap;
		gap: 6px;
	}
	.brand-link {
		background: var(--surface-2);
		border: none;
		border-radius: 6px;
		padding: 3px 8px;
		font-size: 0.7rem;
		color: var(--primary);
		cursor: pointer;
	}
	.brand-link:hover {
		background: var(--primary-dim);
	}
</style>
