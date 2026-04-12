<script lang="ts">
	import type { Brand, Firm, Classification, OwnershipStake, ValueTag } from '$lib/types';
	import ValueChip from './ValueChip.svelte';

	type Props = {
		brand: Brand;
		classification: Classification;
		tags: ValueTag[];
		firmById: Map<string, Firm>;
	};

	let { brand, classification, tags, firmById }: Props = $props();

	const verdict = $derived(
		classification === 'avoid'
			? 'Conflicts with your values'
			: classification === 'align'
				? 'Aligns with your values'
				: 'No direct conflict'
	);

	function stakeLabel(s: OwnershipStake): string {
		switch (s) {
			case 'majority':
				return 'majority';
			case 'minority':
				return 'minority';
			case 'former':
				return 'former';
			case 'post_bankrupt':
				return 'post-bankrupt';
		}
	}
</script>

<article
	class="card"
	class:card-avoid={classification === 'avoid'}
	class:card-align={classification === 'align'}
>
	<header>
		<div class="name-row">
			<h3>{brand.avoid}</h3>
			<span class="cat">{brand.cat}</span>
		</div>
		<div class="owners">
			{#each brand.ownership as o, i (o.firmId + i)}
				{@const firm = firmById.get(o.firmId)}
				<div class="owner-row">
					<span class="label">Owned by</span>
					<strong>{firm?.name ?? o.firmId}</strong>
					<span class="stake" data-stake={o.stake}>{stakeLabel(o.stake)}</span>
					{#if o.since}<span class="since">since {o.since}</span>{/if}
				</div>
			{/each}
		</div>
	</header>

	<p class="verdict" data-kind={classification}>{verdict}</p>

	{#if tags.length > 0}
		<div class="matched">
			{#each tags as t (t.value)}
				<ValueChip id={t.value} variant={t.variant} />
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
	.owners {
		margin-top: 4px;
		display: flex;
		flex-direction: column;
		gap: 2px;
	}
	.owner-row {
		display: flex;
		align-items: baseline;
		flex-wrap: wrap;
		gap: 6px;
		font-size: 0.78rem;
		color: var(--ink-muted);
	}
	.owner-row .label {
		color: var(--ink-faint);
	}
	.owner-row strong {
		color: var(--ink);
		font-weight: 500;
	}
	.stake {
		font-family: 'DM Mono', monospace;
		font-size: 0.56rem;
		text-transform: uppercase;
		letter-spacing: 0.08em;
		padding: 1px 6px;
		border-radius: 4px;
		background: var(--surface-2);
		color: var(--ink-faint);
	}
	.stake[data-stake='majority'] {
		color: var(--primary);
		background: var(--primary-dim);
	}
	.stake[data-stake='former'],
	.stake[data-stake='post_bankrupt'] {
		color: var(--ink-faint);
	}
	.since {
		font-family: 'DM Mono', monospace;
		font-size: 0.62rem;
		color: var(--ink-faint);
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
