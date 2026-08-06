<script lang="ts">
	import '../app.css';
	import { onMount } from 'svelte';
	import { beforeNavigate } from '$app/navigation';
	import { updated } from '$app/state';
	import { theme } from '$lib/stores/theme';

	let { children } = $props();

	onMount(() => {
		theme.init();
	});

	// When a new build has been deployed (detected by version polling), the old
	// hashed JS chunks this tab references are gone. Do a full-page navigation so
	// the browser fetches the fresh HTML + chunks instead of failing to import a
	// deleted module.
	beforeNavigate((nav) => {
		if (updated.current && !nav.willUnload && nav.to?.url) {
			location.href = nav.to.url.href;
		}
	});
</script>

{@render children()}
