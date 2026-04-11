<script lang="ts">
	import { theme } from '$lib/stores/theme';

	type Props = {
		searchTerm: string;
		onsearch: (v: string) => void;
		onsettings: () => void;
	};

	let { searchTerm, onsearch, onsettings }: Props = $props();
</script>

<div class="topbar">
	<div class="brand">
		<div class="logo-mark"></div>
		<span class="name">Starbird</span>
	</div>
	<div class="search">
		<input
			type="search"
			placeholder="Search brands, firms, alternatives…"
			value={searchTerm}
			oninput={(e) => onsearch((e.target as HTMLInputElement).value)}
		/>
	</div>
	<div class="actions">
		<button
			type="button"
			class="icon-btn"
			aria-label="Toggle theme"
			onclick={() => theme.toggle()}
		>
			<span class="dot"></span>
		</button>
		<button type="button" class="icon-btn" aria-label="Edit values" onclick={onsettings}>
			<span>◦</span>
		</button>
	</div>
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
	.actions {
		display: flex;
		gap: 6px;
		flex-shrink: 0;
	}
	.icon-btn {
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
		font-family: 'DM Mono', monospace;
		font-size: 0.9rem;
		transition: all 150ms ease;
	}
	.icon-btn:hover {
		border-color: var(--primary);
		color: var(--primary);
	}
	.dot {
		width: 12px;
		height: 12px;
		border-radius: 50%;
		background: var(--gold);
		box-shadow: 0 0 8px var(--gold-dim);
	}
</style>
