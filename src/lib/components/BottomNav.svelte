<script lang="ts">
	type Panel = 'brands' | 'firms' | 'charts' | 'about';
	type Props = {
		active: Panel;
		onchange: (p: Panel) => void;
	};

	let { active, onchange }: Props = $props();

	const ITEMS: { id: Panel; icon: string; label: string }[] = [
		{ id: 'brands', icon: '◈', label: 'Brands' },
		{ id: 'firms', icon: '⬡', label: 'Firms' },
		{ id: 'charts', icon: '▦', label: 'Charts' },
		{ id: 'about', icon: '◌', label: 'About' }
	];
</script>

<nav class="nav">
	{#each ITEMS as i (i.id)}
		<button
			type="button"
			class="btn-nav"
			class:active={active === i.id}
			onclick={() => onchange(i.id)}
			aria-label={i.label}
		>
			<span class="icon" aria-hidden="true">{i.icon}</span>
			<span class="label">{i.label}</span>
		</button>
	{/each}
</nav>

<style>
	.nav {
		flex-shrink: 0;
		display: grid;
		grid-template-columns: repeat(4, 1fr);
		background: var(--bg);
		border-top: 1px solid var(--border);
		/* Pad exactly the home-indicator inset — do not add extra button padding
		   on top of this or the labels float too high above the home bar. */
		padding-bottom: max(env(safe-area-inset-bottom, 0px), 4px);
	}
	.btn-nav {
		background: none;
		border: none;
		color: var(--ink-faint);
		/* Asymmetric: breathing room above the icon, minimal below the label,
		   since the nav element itself handles safe-area spacing underneath. */
		padding: 8px 4px 2px;
		cursor: pointer;
		display: flex;
		flex-direction: column;
		align-items: center;
		gap: 3px;
		font-family: inherit;
		transition: color 150ms ease;
	}
	.btn-nav:hover {
		color: var(--ink-muted);
	}
	.btn-nav.active {
		color: var(--primary);
	}
	.icon {
		font-size: 1.1rem;
		line-height: 1;
	}
	.label {
		font-family: 'DM Mono', monospace;
		font-size: 0.58rem;
		letter-spacing: 0.08em;
		text-transform: uppercase;
	}
</style>
