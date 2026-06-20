<script lang="ts">
	import { CATEGORIES } from '$lib/categories';
	type Cat = { id: string; label: string };
	type SortKey = 'harm' | 'date';
	type SortDir = 'desc' | 'asc';
	type Props = {
		activeCat: string;
		onchange: (id: string) => void;
		matchOnly: boolean;
		ontoggleMatch: () => void;
		sortKey: SortKey;
		sortDir: SortDir;
		onsort: (key: SortKey) => void;
	};

	let {
		activeCat,
		onchange,
		matchOnly,
		ontoggleMatch,
		sortKey,
		sortDir,
		onsort
	}: Props = $props();

	const arrow = $derived(sortDir === 'desc' ? '↓' : '↑');

	// Sourced from the categories.ts single source of truth so the filter
	// chips can never drift from the category definitions used everywhere else.
	const CATS: Cat[] = [{ id: 'all', label: 'All' }, ...CATEGORIES.map((c) => ({ id: c.id, label: c.label }))];
</script>

<div class="row no-scrollbar">
	<span class="filter-head">Filter</span>
	<button
		type="button"
		class="chip"
		class:chip-active={matchOnly}
		onclick={ontoggleMatch}
	>
		◉ My values
	</button>
	<button
		type="button"
		class="chip"
		class:chip-active={sortKey === 'harm'}
		onclick={() => onsort('harm')}
		aria-label="Sort by harm score"
		title={sortKey === 'harm' ? `Harm — ${sortDir === 'desc' ? 'highest first' : 'lowest first'} — click to flip` : 'Sort by harm score'}
	>
		{arrow} Harm
	</button>
	<button
		type="button"
		class="chip"
		class:chip-active={sortKey === 'date'}
		onclick={() => onsort('date')}
		aria-label="Sort by date added"
		title={sortKey === 'date' ? `Date — ${sortDir === 'desc' ? 'newest first' : 'oldest first'} — click to flip` : 'Sort by date added'}
	>
		{arrow} Date
	</button>
	<span class="divider"></span>
	{#each CATS as c (c.id)}
		<button
			type="button"
			class="chip"
			class:chip-active={activeCat === c.id}
			onclick={() => onchange(c.id)}
		>
			{c.label}
		</button>
	{/each}
</div>

<style>
	.row {
		flex-shrink: 0;
		display: flex;
		gap: 6px;
		overflow-x: auto;
		padding: 10px 12px;
		border-bottom: 1px solid var(--border);
		align-items: center;
	}
	.divider {
		width: 1px;
		height: 18px;
		background: var(--border);
		flex-shrink: 0;
	}
	.filter-head {
		display: none;
	}

	@media (min-width: 1024px) {
		.row {
			grid-area: filter;
			flex-wrap: wrap;
			overflow: visible;
			align-content: start;
			align-items: flex-start;
			padding: 6px 14px 16px;
			border-bottom: none;
			border-right: 1px solid var(--border);
		}
		.filter-head {
			display: block;
			width: 100%;
			font-family: 'DM Mono', monospace;
			font-size: 0.6rem;
			text-transform: uppercase;
			letter-spacing: 0.14em;
			color: var(--ink-faint);
			margin-bottom: 2px;
		}
		.divider {
			width: 100%;
			height: 1px;
			margin: 4px 0;
		}
	}
</style>
