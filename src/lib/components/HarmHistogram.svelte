<script lang="ts">
	import type { Firm } from '$lib/types';
	import { harmHistogram } from '$lib/aggregations';

	type Props = {
		firms: Firm[];
		/** Click a bucket to drill into firms in that score band. */
		onselect?: (min: number, max: number) => void;
	};
	let { firms, onselect }: Props = $props();

	const h = $derived(harmHistogram(firms));
	const maxCount = $derived(Math.max(...h.buckets.map((b) => b.count), 1));
</script>

<section class="block">
	<div class="section-label">// Harm score distribution — all {h.total} firms</div>
	<p class="caption">
		The dataset is bimodal — a positive-exemplar cluster at the low end and a large
		documented-harm mass at 60–79. Mean {h.mean.toFixed(1)} · median {h.median.toFixed(1)}.
		Click a band to see those firms.
	</p>
	<div class="chart">
		{#each h.buckets as b (b.label)}
			<button
				type="button"
				class="row"
				onclick={() => onselect?.(b.min, b.max)}
				title="Show firms scoring {b.min}–{b.max}"
			>
				<div class="name">{b.label} <span class="rng">{b.min}–{b.max}</span></div>
				<div class="bar-wrap">
					<div class="bar" style="width: {(b.count / maxCount) * 100}%"></div>
				</div>
				<div class="val">{b.count}</div>
			</button>
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
		line-height: 1.4;
	}
	.chart {
		margin-top: 8px;
	}
	.row {
		display: grid;
		grid-template-columns: 130px 1fr 40px;
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
	.rng {
		color: var(--ink-faint);
		font-family: 'DM Mono', monospace;
		font-size: 0.64rem;
	}
	.bar-wrap {
		background: var(--surface-2);
		border-radius: 4px;
		height: 14px;
		overflow: hidden;
	}
	.bar {
		height: 100%;
		background: var(--avoid);
		border-radius: 4px;
		transition: width 200ms ease;
	}
	.val {
		font-family: 'DM Mono', monospace;
		color: var(--ink);
		text-align: right;
	}
</style>
