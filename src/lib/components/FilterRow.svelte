<script lang="ts">
	type Cat = { id: string; label: string };
	type Props = {
		activeCat: string;
		onchange: (id: string) => void;
		matchOnly: boolean;
		ontoggleMatch: () => void;
	};

	let { activeCat, onchange, matchOnly, ontoggleMatch }: Props = $props();

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
