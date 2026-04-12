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
		/* Pinned to the viewport bottom, independent of flex layout.
		   This is the nuclear fix for the iOS PWA bug where the nav
		   renders too high on initial load then corrects after scroll. */
		position: fixed;
		bottom: 0;
		left: 0;
		right: 0;
		z-index: 30;
		display: grid;
		grid-template-columns: repeat(4, 1fr);
		background: var(--bg);
		border-top: 1px solid var(--border);
		padding-bottom: env(safe-area-inset-bottom, 0px);
	}
	.btn-nav {
		background: none;
		border: none;
		color: var(--ink-faint);
		padding: 8px 4px 4px;
		cursor: pointer;
		display: flex;
		flex-direction: column;
		align-items: center;
		gap: 2px;
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
		font-size: 1.05rem;
		line-height: 1;
		display: block;
	}
	.label {
		font-family: 'DM Mono', monospace;
		font-size: 0.58rem;
		letter-spacing: 0.08em;
		text-transform: uppercase;
		line-height: 1;
		display: block;
	}
</style>
