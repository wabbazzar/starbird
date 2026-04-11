<script lang="ts">
	import type { Brand, Classification } from '$lib/types';
	import type { ValueId } from '$lib/values';
	import ValueChip from './ValueChip.svelte';

	type Props = {
		brand: Brand;
		classification: Classification;
		matched: ValueId[];
	};

	let { brand, classification, matched }: Props = $props();

	const verdict = $derived(
		classification === 'avoid' ? 'Conflicts with your values' :
		classification === 'align' ? 'Aligns with your values' :
		'No direct conflict'
	);
</script>

<article class="card" class:card-avoid={classification === 'avoid'} class:card-align={classification === 'align'}>
	<header>
		<div class="name-row">
			<h3>{brand.avoid}</h3>
			<span class="cat">{brand.cat}</span>
		</div>
		<div class="owner">Owned by <strong>{brand.owner}</strong></div>
	</header>

	<p class="verdict" data-kind={classification}>{verdict}</p>

	{#if matched.length > 0}
		<div class="matched">
			{#each matched as m (m)}
				<ValueChip id={m} variant={classification === 'avoid' ? 'avoid' : 'align'} />
			{/each}
		</div>
	{/if}

	<div class="alts">
		<div class="section-label">Alternatives</div>
		<ul>
			{#each brand.alts as a (a)}
				<li>{a}</li>
			{/each}
		</ul>
	</div>

	<p class="why">{brand.why}</p>
</article>

<style>
	.card {
		padding: 14px 16px;
		margin-bottom: 10px;
	}
	header {
		margin-bottom: 8px;
	}
	.name-row {
		display: flex;
		align-items: baseline;
		justify-content: space-between;
		gap: 8px;
	}
	h3 {
		font-size: 1.1rem;
		color: var(--ink);
	}
	.cat {
		font-family: 'DM Mono', monospace;
		font-size: 0.58rem;
		text-transform: uppercase;
		letter-spacing: 0.08em;
		color: var(--ink-faint);
	}
	.owner {
		font-size: 0.78rem;
		color: var(--ink-muted);
		margin-top: 2px;
	}
	.owner strong {
		color: var(--ink);
		font-weight: 500;
	}
	.verdict {
		font-family: 'DM Mono', monospace;
		font-size: 0.62rem;
		text-transform: uppercase;
		letter-spacing: 0.08em;
		margin: 8px 0;
		color: var(--ink-faint);
	}
	.verdict[data-kind='avoid'] {
		color: var(--avoid);
	}
	.verdict[data-kind='align'] {
		color: var(--align);
	}
	.matched {
		display: flex;
		flex-wrap: wrap;
		gap: 6px;
		margin-bottom: 10px;
	}
	.alts {
		background: var(--surface-2);
		border-radius: 8px;
		padding: 10px 12px;
		margin: 10px 0;
	}
	.alts ul {
		margin: 6px 0 0 0;
		padding-left: 16px;
		font-size: 0.8rem;
		color: var(--ink-muted);
	}
	.alts li {
		margin: 3px 0;
	}
	.why {
		font-size: 0.78rem;
		color: var(--ink-muted);
		line-height: 1.45;
		padding-top: 8px;
		border-top: 1px solid var(--border);
	}
</style>
