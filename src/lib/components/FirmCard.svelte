<script lang="ts">
	import type { Firm, Classification, ValueTag } from '$lib/types';
	import { VALUE_BY_ID } from '$lib/values';
	import ValueChip from './ValueChip.svelte';

	type Props = {
		firm: Firm;
		classification: Classification;
		tags: ValueTag[];
	};

	let { firm, classification, tags }: Props = $props();
	let showDetails = $state(false);

	function toggleDetails(e: MouseEvent) {
		const target = e.target as HTMLElement;
		if (target.closest('a') || target.closest('button')) return;
		showDetails = !showDetails;
	}

	async function share(e: MouseEvent) {
		e.stopPropagation();
		const tagLabels = tags
			.map((t) => VALUE_BY_ID[t.value]?.icon + ' ' + VALUE_BY_ID[t.value]?.label)
			.join(' · ');

		const text = [
			`◈ Starbird — ${firm.name}`,
			'',
			`Harm score: ${firm.harmScore}/100`,
			tagLabels,
			'',
			firm.summary,
			'',
			'→ https://wabbazzar.github.io/starbird/'
		].join('\n');

		try {
			if (navigator.share) {
				await navigator.share({
					title: `Starbird — ${firm.name}`,
					text,
					url: 'https://wabbazzar.github.io/starbird/'
				});
			} else {
				await navigator.clipboard.writeText(text);
			}
		} catch {
			// User cancelled
		}
	}
</script>

<!-- svelte-ignore a11y_click_events_have_key_events -->
<!-- svelte-ignore a11y_no_static_element_interactions -->
<article
	class="card"
	class:card-avoid={classification === 'avoid'}
	class:card-align={classification === 'align'}
	onclick={toggleDetails}
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

	{#if firm.brands.length > 0}
		<div class="brands">
			<div class="section-label">Notable holdings</div>
			<ul>
				{#each firm.brands as b (b)}
					<li>{b}</li>
				{/each}
			</ul>
		</div>
	{/if}

	{#if showDetails}
		{#if firm.source}
			<div class="sources">
				<div class="section-label">Sources</div>
				<a
					href={firm.source}
					target="_blank"
					rel="noopener"
					onclick={(e) => e.stopPropagation()}
				>
					→ source
				</a>
			</div>
		{/if}

		<div class="actions">
			<button type="button" class="share-btn" onclick={share}>
				<span aria-hidden="true">◈</span> Share
			</button>
		</div>
	{:else}
		<div class="tap-hint">tap for sources + share</div>
	{/if}
</article>

<style>
	.card {
		padding: 16px 18px;
		margin-bottom: 12px;
		cursor: pointer;
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
	.sources {
		margin-top: 10px;
		padding-top: 8px;
		border-top: 1px solid var(--border);
		display: flex;
		flex-direction: column;
		gap: 4px;
	}
	.sources a {
		font-family: 'DM Mono', monospace;
		font-size: 0.62rem;
		color: var(--primary);
	}
	.actions {
		display: flex;
		justify-content: flex-end;
		margin-top: 10px;
	}
	.share-btn {
		display: inline-flex;
		align-items: center;
		gap: 6px;
		padding: 6px 14px;
		border-radius: 8px;
		border: 1px solid var(--border);
		background: var(--surface-2);
		color: var(--primary);
		font-family: 'DM Mono', monospace;
		font-size: 0.68rem;
		cursor: pointer;
		transition: all 150ms ease;
	}
	.share-btn:hover {
		border-color: var(--primary);
		background: var(--primary-dim);
	}
	.share-btn:active {
		transform: scale(0.96);
	}
	.tap-hint {
		text-align: center;
		font-family: 'DM Mono', monospace;
		font-size: 0.58rem;
		color: var(--ink-faint);
		margin-top: 8px;
		padding-top: 6px;
		border-top: 1px solid var(--border);
		letter-spacing: 0.06em;
	}
</style>
