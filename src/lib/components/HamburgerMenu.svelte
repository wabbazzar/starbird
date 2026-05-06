<script lang="ts">
	import { theme } from '$lib/stores/theme';
	import { onMount } from 'svelte';

	type Props = {
		open: boolean;
		onclose: () => void;
		oneditValues: () => void;
	};

	let { open, onclose, oneditValues }: Props = $props();

	const SHARE_URL = 'https://wabbazzar.com/starbird/';

	let copied = $state(false);

	async function handleShare() {
		try {
			if (navigator.share) {
				await navigator.share({
					url: SHARE_URL,
					title: 'Starbird',
					text: 'Shop in line with your values. Track which brands align — and which don\'t.'
				});
				onclose();
			} else {
				await navigator.clipboard.writeText(SHARE_URL);
				copied = true;
				setTimeout(() => {
					copied = false;
					onclose();
				}, 1100);
			}
		} catch {
			// User cancelled the share sheet — leave the menu open.
		}
	}

	function toggleTheme() {
		theme.toggle();
	}

	function handleEdit() {
		oneditValues();
		onclose();
	}

	function onKeydown(e: KeyboardEvent) {
		if (open && e.key === 'Escape') onclose();
	}

	onMount(() => {
		window.addEventListener('keydown', onKeydown);
		return () => window.removeEventListener('keydown', onKeydown);
	});
</script>

{#if open}
	<!-- svelte-ignore a11y_click_events_have_key_events -->
	<!-- svelte-ignore a11y_no_static_element_interactions -->
	<div class="scrim" onclick={onclose}></div>
	<div class="drawer" role="menu" aria-label="Starbird menu">
		<button type="button" class="item" onclick={handleShare} role="menuitem">
			<span class="glyph" aria-hidden="true">◈</span>
			<span class="label">{copied ? 'Link copied' : 'Share Starbird'}</span>
		</button>
		<button type="button" class="item" onclick={handleEdit} role="menuitem">
			<span class="glyph" aria-hidden="true">◉</span>
			<span class="label">Edit your values</span>
		</button>
		<button type="button" class="item" onclick={toggleTheme} role="menuitem">
			<span class="glyph" aria-hidden="true">{$theme === 'dark' ? '☀' : '☾'}</span>
			<span class="label">{$theme === 'dark' ? 'Light theme' : 'Dark theme'}</span>
		</button>
	</div>
{/if}

<style>
	.scrim {
		position: fixed;
		inset: 0;
		background: rgba(0, 0, 0, 0.32);
		z-index: 30;
		animation: scrim-in 140ms ease-out;
	}
	.drawer {
		position: fixed;
		top: calc(env(safe-area-inset-top, 0px) + 56px);
		right: 10px;
		min-width: 220px;
		background: var(--surface);
		border: 1px solid var(--border);
		border-radius: 12px;
		padding: 6px;
		box-shadow: 0 12px 32px rgba(0, 0, 0, 0.4);
		z-index: 31;
		display: flex;
		flex-direction: column;
		gap: 2px;
		animation: drawer-in 160ms cubic-bezier(0.2, 0.8, 0.2, 1);
		transform-origin: top right;
	}
	.item {
		display: flex;
		align-items: center;
		gap: 12px;
		padding: 10px 12px;
		border-radius: 8px;
		background: transparent;
		border: 1px solid transparent;
		color: var(--ink);
		font-family: 'DM Sans', sans-serif;
		font-size: 0.9rem;
		text-align: left;
		cursor: pointer;
		transition: background-color 120ms ease, border-color 120ms ease;
	}
	.item:hover,
	.item:focus-visible {
		background: var(--surface-2);
		border-color: var(--border);
		outline: none;
	}
	.item:active {
		opacity: 0.85;
	}
	.glyph {
		width: 22px;
		display: inline-flex;
		align-items: center;
		justify-content: center;
		color: var(--primary);
		font-family: 'DM Mono', monospace;
		font-size: 1rem;
		flex-shrink: 0;
	}
	.label {
		flex: 1;
	}
	@keyframes scrim-in {
		from { opacity: 0; }
		to   { opacity: 1; }
	}
	@keyframes drawer-in {
		from { opacity: 0; transform: scale(0.96) translateY(-4px); }
		to   { opacity: 1; transform: scale(1)    translateY(0); }
	}
</style>
