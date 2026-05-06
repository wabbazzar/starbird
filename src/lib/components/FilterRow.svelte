<script lang="ts">
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

	const CATS: Cat[] = [
		{ id: 'all', label: 'All' },
		{ id: 'tech', label: 'Tech' },
		{ id: 'food', label: 'Fast Food' },
		{ id: 'coffee', label: 'Coffee' },
		{ id: 'retail', label: 'Retail' },
		{ id: 'health', label: 'Health' },
		{ id: 'pets', label: 'Pets' },
		{ id: 'home', label: 'Home' },
		{ id: 'hospitality', label: 'Hotels' },
		{ id: 'finance', label: 'Services' }
	];
</script>

<div class="row no-scrollbar">
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
</style>
