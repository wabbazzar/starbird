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
		/* Safe-area inset is the ONLY bottom spacing. No minimum floor on
		   non-PWA browsers — the button's own padding gives enough
		   breathing room there. */
		padding-bottom: env(safe-area-inset-bottom, 0px);
	}
	.btn-nav {
		background: none;
		border: none;
		color: var(--ink-faint);
		/* Zero bottom padding — the nav's safe-area padding is directly
		   underneath the button content, so any bottom padding here stacks
		   on top of the home-indicator inset and pushes labels too high. */
		padding: 7px 4px 0;
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
		/* Block layout gets rid of line-box font-metric fluff */
		display: block;
	}
	.label {
		font-family: 'DM Mono', monospace;
		font-size: 0.58rem;
		letter-spacing: 0.08em;
		text-transform: uppercase;
		/* Explicit line-height: 1 strips the ~5–8px of invisible leading
		   below the text that the browser adds by default, which is what
		   was making the labels look like they were "floating" above the
		   bottom of the nav on real iOS PWAs. */
		line-height: 1;
		display: block;
	}
</style>
