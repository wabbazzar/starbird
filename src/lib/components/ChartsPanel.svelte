<script lang="ts">
	import type { Firm } from '$lib/types';

	type Props = { firms: Firm[] };
	let { firms }: Props = $props();

	const byAum = $derived([...firms].sort((a, b) => b.aumVal - a.aumVal).slice(0, 10));
	const byHarm = $derived([...firms].sort((a, b) => b.harmScore - a.harmScore).slice(0, 10));
	const maxAum = $derived(Math.max(...byAum.map((f) => f.aumVal), 1));
	const maxHarm = $derived(Math.max(...byHarm.map((f) => f.harmScore), 1));
</script>

<section class="block">
	<div class="section-label">// AUM — Assets under management ($B)</div>
	<div class="chart">
		{#each byAum as f (f.name)}
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
	<div class="section-label">// Harm score — Bankruptcy &amp; layoff severity (0–100)</div>
	<div class="chart">
		{#each byHarm as f (f.name)}
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
	.chart {
		margin-top: 10px;
	}
	.row {
		display: grid;
		grid-template-columns: 110px 1fr 50px;
		gap: 10px;
		align-items: center;
		padding: 5px 0;
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
	}
	.bar-harm {
		background: var(--avoid);
	}
	.val {
		font-family: 'DM Mono', monospace;
		color: var(--ink);
		text-align: right;
	}
</style>
