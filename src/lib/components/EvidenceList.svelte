<script lang="ts">
	import type { Evidence } from '$lib/types';
	import { QUEST_BY_ID } from '$lib/quests';
	import { VALUE_BY_ID } from '$lib/values';

	type Props = { evidence: Evidence[] };
	let { evidence }: Props = $props();

	const fmtAmount = (n?: number) => {
		if (n == null) return '';
		if (n >= 1e9) return `$${(n / 1e9).toFixed(n % 1e9 === 0 ? 0 : 1)}B`;
		if (n >= 1e6) return `$${(n / 1e6).toFixed(n % 1e6 === 0 ? 0 : 1)}M`;
		if (n >= 1e3) return `$${(n / 1e3).toFixed(0)}K`;
		return `$${n}`;
	};
	const valueOf = (tag: string) => VALUE_BY_ID[QUEST_BY_ID[tag as keyof typeof QUEST_BY_ID]?.value]?.label ?? tag;
</script>

{#if evidence.length > 0}
	<div class="evidence">
		<div class="section-label">Evidence ({evidence.length})</div>
		<ul>
			{#each evidence as e, i (i)}
				<li>
					<div class="meta">
						<span class="tag">{valueOf(e.tag)}</span>
						{#if e.date}<span class="chip">{e.date}</span>{/if}
						{#if e.amountUsd != null}<span class="chip amount">{fmtAmount(e.amountUsd)}{#if e.amountKind}&nbsp;{e.amountKind}{/if}</span>{/if}
						{#if e.actor}<span class="chip actor">{e.actor}</span>{/if}
					</div>
					<p class="text">{e.text}</p>
					{#if e.sourceUrl}
						<a class="src" href={e.sourceUrl} target="_blank" rel="noopener" onclick={(ev) => ev.stopPropagation()}>→ source</a>
					{/if}
				</li>
			{/each}
		</ul>
	</div>
{/if}

<style>
	.evidence {
		margin-top: 10px;
		padding-top: 8px;
		border-top: 1px solid var(--border);
	}
	.section-label {
		font-family: 'DM Mono', monospace;
		font-size: 0.58rem;
		text-transform: uppercase;
		letter-spacing: 0.1em;
		color: var(--ink-faint);
		margin-bottom: 6px;
	}
	ul {
		list-style: none;
		margin: 0;
		padding: 0;
		display: flex;
		flex-direction: column;
		gap: 8px;
	}
	li {
		font-size: 0.74rem;
		color: var(--ink-muted);
	}
	.meta {
		display: flex;
		flex-wrap: wrap;
		gap: 5px;
		align-items: center;
		margin-bottom: 2px;
	}
	.tag {
		font-family: 'DM Mono', monospace;
		font-size: 0.56rem;
		text-transform: uppercase;
		letter-spacing: 0.06em;
		color: var(--primary);
	}
	.chip {
		font-family: 'DM Mono', monospace;
		font-size: 0.58rem;
		padding: 1px 6px;
		border-radius: 4px;
		background: var(--surface-2);
		color: var(--ink-faint);
	}
	.chip.amount {
		color: var(--avoid);
	}
	.text {
		line-height: 1.4;
		margin: 0;
	}
	.src {
		font-family: 'DM Mono', monospace;
		font-size: 0.62rem;
		color: var(--primary);
	}
</style>
