<script lang="ts">
	import '../app.css';
	import { onMount } from 'svelte';
	import { afterNavigate } from '$app/navigation';
	import { theme } from '$lib/stores/theme';
	import { sendVisit } from '$lib/visitBeacon';

	let { children } = $props();

	onMount(() => {
		theme.init();
	});

	// One beacon per page view, including client-side route changes.
	afterNavigate(() => {
		sendVisit();
	});
</script>

{@render children()}
