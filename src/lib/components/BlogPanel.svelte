<script lang="ts">
	import type { BlogPost } from '$lib/blog';
	import type { Brand, Firm } from '$lib/types';
	import type { ValueId } from '$lib/values';
	import ValueChip from './ValueChip.svelte';

	type Props = {
		posts: BlogPost[];
		firms: Firm[];
		brands: Brand[];
		// Jump to a brand/firm card (reuses the deep-link navigation in +page).
		onselect: (id: string) => void;
	};

	let { posts, firms, brands, onselect }: Props = $props();

	// id → display label + kind, for the entity chips at the foot of each post.
	const nameById = $derived.by(() => {
		const m = new Map<string, { label: string; kind: 'firm' | 'brand' }>();
		for (const f of firms) m.set(f.id, { label: f.name, kind: 'firm' });
		// A brand can share an id with a firm (self-owned). The brand chip
		// label (avoid) is friendlier, but firm cards win the nav target in
		// +page, so keep the brand label without clobbering the firm entry.
		for (const b of brands) if (!m.has(b.id)) m.set(b.id, { label: b.avoid, kind: 'brand' });
		return m;
	});

	// Newest first. The stored list is chronological (backfill + appends).
	const ordered = $derived([...posts].sort((a, b) => b.date.localeCompare(a.date) || b.id.localeCompare(a.id)));

	function paragraphs(body: string): string[] {
		return body.split(/\n\s*\n/).map((p) => p.trim()).filter(Boolean);
	}

	function prettyDate(iso: string): string {
		// iso is YYYY-MM-DD; build a UTC date so the day doesn't shift by tz.
		const [y, mo, d] = iso.split('-').map(Number);
		const dt = new Date(Date.UTC(y, mo - 1, d));
		return dt.toLocaleDateString('en-US', {
			year: 'numeric',
			month: 'long',
			day: 'numeric',
			timeZone: 'UTC'
		});
	}
</script>

<div class="blog">
	<div class="count">{ordered.length} dispatches from the research runner</div>
	{#each ordered as post (post.id)}
		<article class="post">
			<header class="post-head">
				<time datetime={post.date}>{prettyDate(post.date)}</time>
				<ValueChip id={post.value as ValueId} />
			</header>
			<h2>{post.title}</h2>
			<p class="lede">{post.summary}</p>
			<div class="body">
				{#each paragraphs(post.body) as para}
					<p>{para}</p>
				{/each}
			</div>
			{#if post.entityIds.length}
				<footer class="entities">
					<span class="entities-label">Added</span>
					{#each post.entityIds as eid (eid)}
						{@const meta = nameById.get(eid)}
						{#if meta}
							<button type="button" class="chip-entity" onclick={() => onselect(eid)}>
								<span class="kind" aria-hidden="true">{meta.kind === 'firm' ? '⬡' : '◈'}</span>
								{meta.label}
							</button>
						{/if}
					{/each}
				</footer>
			{/if}
			<div class="source-row">
				<span class="strategy">{post.strategyLabel}</span>
				{#if post.source}
					<a class="src" href={post.source} target="_blank" rel="noopener noreferrer">source ↗</a>
				{/if}
			</div>
		</article>
	{/each}
</div>

<style>
	.count {
		font-family: 'DM Mono', monospace;
		font-size: 0.62rem;
		letter-spacing: 0.08em;
		text-transform: uppercase;
		color: var(--ink-faint);
		margin-bottom: 8px;
	}
	.post {
		border: 1px solid var(--border);
		border-radius: 12px;
		background: var(--surface);
		padding: 18px 20px 14px;
		margin-bottom: 14px;
	}
	.post-head {
		display: flex;
		align-items: center;
		justify-content: space-between;
		gap: 10px;
		margin-bottom: 8px;
	}
	time {
		font-family: 'DM Mono', monospace;
		font-size: 0.66rem;
		letter-spacing: 0.06em;
		text-transform: uppercase;
		color: var(--ink-faint);
	}
	h2 {
		font-size: 1.12rem;
		line-height: 1.3;
		margin: 0 0 6px;
		color: var(--ink);
	}
	.lede {
		font-size: 0.95rem;
		line-height: 1.5;
		color: var(--ink-muted);
		margin: 0 0 10px;
	}
	.body p {
		font-size: 0.9rem;
		line-height: 1.6;
		color: var(--ink);
		margin: 0 0 10px;
	}
	.entities {
		display: flex;
		flex-wrap: wrap;
		align-items: center;
		gap: 6px;
		margin: 12px 0 6px;
	}
	.entities-label {
		font-family: 'DM Mono', monospace;
		font-size: 0.58rem;
		letter-spacing: 0.08em;
		text-transform: uppercase;
		color: var(--ink-faint);
		margin-right: 2px;
	}
	.chip-entity {
		display: inline-flex;
		align-items: center;
		gap: 5px;
		background: var(--bg);
		border: 1px solid var(--border);
		border-radius: 999px;
		padding: 3px 10px;
		font-family: inherit;
		font-size: 0.78rem;
		color: var(--ink-muted);
		cursor: pointer;
		transition: border-color 150ms ease, color 150ms ease;
	}
	.chip-entity:hover {
		border-color: var(--primary);
		color: var(--primary);
	}
	.chip-entity .kind {
		font-size: 0.72rem;
		opacity: 0.7;
	}
	.source-row {
		display: flex;
		align-items: center;
		justify-content: space-between;
		gap: 10px;
		margin-top: 10px;
		padding-top: 8px;
		border-top: 1px solid var(--border);
	}
	.strategy {
		font-family: 'DM Mono', monospace;
		font-size: 0.6rem;
		letter-spacing: 0.05em;
		text-transform: uppercase;
		color: var(--ink-faint);
	}
	.src {
		font-family: 'DM Mono', monospace;
		font-size: 0.62rem;
		color: var(--primary);
		text-decoration: none;
		white-space: nowrap;
	}
	.src:hover {
		text-decoration: underline;
	}
</style>
