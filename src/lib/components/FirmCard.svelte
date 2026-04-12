<script lang="ts">
	import type { Firm, Classification, ValueTag } from '$lib/types';
	import ValueChip from './ValueChip.svelte';

	type Props = {
		firm: Firm;
		classification: Classification;
		tags: ValueTag[];
	};

	let { firm, classification, tags }: Props = $props();
</script>

<article
	class="card"
	class:card-avoid={classification === 'avoid'}
	class:card-align={classification === 'align'}
>
	<header>
		<h3>{firm.name}</h3>
		<span class="aum">{firm.aum} AUM</span>
	</header>

	<p class="summary">{firm.summary}</p>

	{#if tags.length > 0}
		<div class="matched">
			{#each tags as t (t.value)}
				<ValueChip id={t.value} variant={t.variant} />
			{/each}
		</div>
	{/if}

	<div class="metrics">
		<div class="metric">
			<div class="lbl">Harm score</div>
			<div class="val score" data-high={firm.harmScore >= 75}>
				{firm.harmScore}<span class="unit">/100</span>
			</div>
		</div>
		<div class="metric">
			<div class="lbl">Layoffs</div>
			<div class="val">{firm.layoffs}</div>
		</div>
	</div>

	<div class="brands">
		<div class="section-label">Notable holdings</div>
		<ul>
			{#each firm.brands as b (b)}
				<li>{b}</li>
			{/each}
		</ul>
	</div>

	<a href={firm.source} target="_blank" rel="noopener" class="src">→ source</a>
</article>

<style>
	.card {
		padding: 16px 18px;
		margin-bottom: 12px;
	}
	header {
		display: flex;
		align-items: baseline;
		justify-content: space-between;
		gap: 10px;
		margin-bottom: 6px;
	}
	h3 {
		font-size: 1.2rem;
		color: var(--ink);
	}
	.aum {
		font-family: 'DM Mono', monospace;
		font-size: 0.68rem;
		color: var(--gold);
	}
	.summary {
		font-size: 0.82rem;
		color: var(--ink-muted);
		line-height: 1.5;
		margin-bottom: 10px;
	}
	.matched {
		display: flex;
		flex-wrap: wrap;
		gap: 6px;
		margin-bottom: 10px;
	}
	.metrics {
		display: grid;
		grid-template-columns: auto 1fr;
		gap: 12px;
		background: var(--surface-2);
		border-radius: 8px;
		padding: 10px 12px;
		margin-bottom: 10px;
	}
	.metric .lbl {
		font-family: 'DM Mono', monospace;
		font-size: 0.56rem;
		text-transform: uppercase;
		letter-spacing: 0.1em;
		color: var(--ink-faint);
		margin-bottom: 2px;
	}
	.metric .val {
		font-size: 0.78rem;
		color: var(--ink);
	}
	.score {
		font-family: 'Bebas Neue', sans-serif;
		font-size: 1.4rem;
		color: var(--primary);
		line-height: 1;
	}
	.score[data-high='true'] {
		color: var(--avoid);
	}
	.score .unit {
		font-family: 'DM Mono', monospace;
		font-size: 0.7rem;
		color: var(--ink-faint);
	}
	.brands ul {
		margin: 6px 0 0 0;
		padding-left: 16px;
		font-size: 0.78rem;
		color: var(--ink-muted);
	}
	.brands li {
		margin: 3px 0;
	}
	.src {
		display: inline-block;
		margin-top: 10px;
		font-family: 'DM Mono', monospace;
		font-size: 0.62rem;
		color: var(--primary);
	}
</style>
