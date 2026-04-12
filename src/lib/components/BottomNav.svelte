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
		/* Back in the flex flow — NOT position: fixed, which caused a
		   draggable floating overlay on iOS. The parent .app uses
		   position: fixed; inset: 0 to fill the viewport, so this flex
		   child naturally sits at the bottom without needing its own
		   fixed positioning. */
		flex-shrink: 0;
		display: grid;
		grid-template-columns: repeat(4, 1fr);
		background: var(--bg);
		border-top: 1px solid var(--border);
		padding-bottom: env(safe-area-inset-bottom, 0px);
		/* Prevent iOS from interpreting nav touches as scroll gestures */
		touch-action: none;
		-webkit-touch-callout: none;
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
		/* Re-enable tap for buttons specifically */
		touch-action: manipulation;
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
