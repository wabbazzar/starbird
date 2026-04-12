<script lang="ts">
	import type { Brand, Firm, Classification, OwnershipStake, ValueTag } from '$lib/types';
	import { VALUE_BY_ID } from '$lib/values';
	import { renderShareCard } from '$lib/shareCard';
	import ValueChip from './ValueChip.svelte';

	type Props = {
		brand: Brand;
		classification: Classification;
		tags: ValueTag[];
		firmById: Map<string, Firm>;
	};

	let { brand, classification, tags, firmById }: Props = $props();
	let showDetails = $state(false);

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

	const sources = $derived(
		brand.ownership
			.map((o) => {
				const firm = firmById.get(o.firmId);
				return firm?.source ? { name: firm.name, url: firm.source } : null;
			})
			.filter((s): s is { name: string; url: string } => s !== null)
	);

	function toggleDetails(e: MouseEvent) {
		const target = e.target as HTMLElement;
		if (target.closest('a') || target.closest('button')) return;
		showDetails = !showDetails;
	}

	async function share(e: MouseEvent) {
		e.stopPropagation();
		const ownerNames = brand.ownership
			.map((o) => firmById.get(o.firmId)?.name ?? o.firmId)
			.join(', ');

		try {
			const blob = await renderShareCard({
				type: 'brand',
				name: brand.avoid,
				category: brand.cat,
				ownership: `Owned by ${ownerNames}`,
				verdict,
				verdictKind: classification,
				tags,
				why: brand.why
			});

			const file = new File([blob], `starbird-${brand.id}.png`, { type: 'image/png' });

			if (navigator.share && navigator.canShare?.({ files: [file] })) {
				await navigator.share({
					title: `Starbird — ${brand.avoid}`,
					text: `${brand.avoid} on Starbird — ${verdict.toLowerCase()}`,
					url: 'https://wabbazzar.github.io/starbird/',
					files: [file]
				});
			} else if (navigator.share) {
				// Fallback: text-only share if file sharing not supported
				const tagLabels = tags
					.map((t) => VALUE_BY_ID[t.value]?.icon + ' ' + VALUE_BY_ID[t.value]?.label)
					.join(' · ');
				await navigator.share({
					title: `Starbird — ${brand.avoid}`,
					text: `◈ Starbird — ${brand.avoid}\n${verdict}\n${tagLabels}\n\n${brand.why}\n\n→ https://wabbazzar.github.io/starbird/`
				});
			} else {
				// Desktop fallback: download the image
				const url = URL.createObjectURL(blob);
				const a = document.createElement('a');
				a.href = url;
				a.download = `starbird-${brand.id}.png`;
				a.click();
				URL.revokeObjectURL(url);
			}
		} catch {
			// User cancelled or error
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

	{#if brand.alts.length > 0}
		<div class="alts">
			<div class="section-label">Alternatives</div>
			<ul>
				{#each brand.alts as a (a)}
					<li>{a}</li>
				{/each}
			</ul>
		</div>
	{/if}

	<p class="why">{brand.why}</p>

	{#if showDetails}
		<div class="card-footer">
			<div class="sources">
				{#each sources as s (s.url)}
					<a
						href={s.url}
						target="_blank"
						rel="noopener"
						onclick={(e) => e.stopPropagation()}
					>
						→ {s.name}
					</a>
				{/each}
			</div>
			<button type="button" class="share-btn" onclick={share}>
				<span aria-hidden="true">◈</span> Share
			</button>
		</div>
	{/if}
</article>

<style>
	.card {
		padding: 14px 16px;
		margin-bottom: 10px;
		cursor: pointer;
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
	.card-footer {
		display: flex;
		align-items: flex-end;
		justify-content: space-between;
		gap: 12px;
		margin-top: 10px;
		padding-top: 8px;
		border-top: 1px solid var(--border);
	}
	.sources {
		display: flex;
		flex-direction: column;
		gap: 3px;
		min-width: 0;
	}
	.sources a {
		font-family: 'DM Mono', monospace;
		font-size: 0.66rem;
		color: var(--primary);
		white-space: nowrap;
		overflow: hidden;
		text-overflow: ellipsis;
	}
	.share-btn {
		flex-shrink: 0;
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
</style>
