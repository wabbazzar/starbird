<script lang="ts">
	type Props = {
		searchTerm: string;
		menuOpen?: boolean;
		onsearch: (v: string) => void;
		onmenu: () => void;
		onscrolltop: () => void;
	};

	let { searchTerm, menuOpen = false, onsearch, onmenu, onscrolltop }: Props = $props();
</script>

<div class="topbar">
	<button
		type="button"
		class="brand"
		aria-label="Scroll to top"
		onclick={onscrolltop}
	>
		<div class="logo-mark"></div>
		<span class="name">Starbird</span>
	</button>
	<span class="tagline">Shop in line with your values</span>
	<div class="search">
		<input
			type="search"
			placeholder="Search brands, firms, alternatives…"
			value={searchTerm}
			oninput={(e) => onsearch((e.target as HTMLInputElement).value)}
		/>
	</div>
	<button
		type="button"
		class="menu-btn"
		class:active={menuOpen}
		aria-label="Open menu"
		aria-expanded={menuOpen}
		onclick={onmenu}
	>
		<span class="bars" aria-hidden="true">
			<span></span>
			<span></span>
			<span></span>
		</span>
	</button>
</div>

<style>
	.topbar {
		flex-shrink: 0;
		display: flex;
		align-items: center;
		gap: 10px;
		padding: calc(env(safe-area-inset-top, 0px) + 10px) 14px 10px;
		background: var(--bg);
		border-bottom: 1px solid var(--border);
		position: relative;
		z-index: 10;
	}
	.brand {
		display: flex;
		align-items: center;
		gap: 8px;
		flex-shrink: 0;
		background: none;
		border: none;
		padding: 0;
		cursor: pointer;
		font-family: inherit;
		color: inherit;
		-webkit-tap-highlight-color: rgba(255, 255, 255, 0.08);
	}
	.brand:active {
		opacity: 0.7;
	}
	.name {
		font-family: 'Bebas Neue', sans-serif;
		font-size: 1.45rem;
		letter-spacing: 0.04em;
		color: var(--ink);
		line-height: 1;
	}
	.search {
		flex: 1;
		min-width: 0;
	}
	.search input {
		width: 100%;
		background: var(--surface-2);
		border: 1px solid var(--border);
		border-radius: 8px;
		color: var(--ink);
		font-family: 'DM Mono', monospace;
		font-size: 0.75rem;
		padding: 8px 12px;
		outline: none;
		transition: border-color 150ms ease;
	}
	.search input:focus {
		border-color: var(--primary);
	}
	.search input::placeholder {
		color: var(--ink-faint);
	}
	.menu-btn {
		flex-shrink: 0;
		width: 34px;
		height: 34px;
		display: inline-flex;
		align-items: center;
		justify-content: center;
		background: var(--surface-2);
		border: 1px solid var(--border);
		border-radius: 8px;
		color: var(--ink-muted);
		cursor: pointer;
		transition: all 150ms ease;
	}
	.menu-btn:hover {
		border-color: var(--primary);
		color: var(--primary);
	}
	.menu-btn.active {
		border-color: var(--primary);
		color: var(--primary);
		background: var(--primary-dim);
	}
	.bars {
		display: inline-flex;
		flex-direction: column;
		justify-content: center;
		gap: 3px;
		width: 16px;
	}
	.bars span {
		display: block;
		height: 1.5px;
		width: 100%;
		background: currentColor;
		border-radius: 1px;
	}
	.tagline {
		display: none;
	}

	@media (min-width: 1024px) {
		.topbar {
			grid-area: header;
			gap: 16px;
			padding: 16px 26px;
		}
		.logo-mark {
			width: 38px;
			height: 38px;
		}
		.name {
			font-size: 1.75rem;
		}
		.tagline {
			display: block;
			font-family: 'DM Mono', monospace;
			font-size: 0.66rem;
			letter-spacing: 0.06em;
			color: var(--ink-faint);
			padding-left: 16px;
			margin-left: 4px;
			border-left: 1px solid var(--border);
			white-space: nowrap;
		}
		.search {
			max-width: 420px;
			margin-left: auto;
		}
		.search input {
			font-size: 0.8rem;
			padding: 10px 14px;
		}
		.menu-btn {
			width: 38px;
			height: 38px;
		}
	}
</style>
