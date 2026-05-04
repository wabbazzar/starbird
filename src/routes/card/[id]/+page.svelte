<script lang="ts">
	import { base } from '$app/paths';
	import { onMount } from 'svelte';

	let { data } = $props();

	const ogImage = `https://wabbazzar.com/starbird/cards/${data.id}.png`;
	const cardUrl = `https://wabbazzar.com/starbird/card/${data.id}/`;
	const appUrl = `${base}/#${data.id}`;

	// Redirect browser to the main app, with the entry id in the hash so
	// the homepage can jump to that specific card. OG crawlers don't
	// execute JS, so they see the meta tags below and render a preview.
	onMount(() => {
		window.location.replace(appUrl);
	});
</script>

<svelte:head>
	<title>{data.title}</title>
	<meta property="og:type" content="article" />
	<meta property="og:title" content={data.title} />
	<meta property="og:description" content={data.description} />
	<meta property="og:image" content={ogImage} />
	<meta property="og:url" content={cardUrl} />
	<meta property="og:site_name" content="Starbird" />
	<meta name="twitter:card" content="summary_large_image" />
	<meta name="twitter:title" content={data.title} />
	<meta name="twitter:description" content={data.description} />
	<meta name="twitter:image" content={ogImage} />
</svelte:head>

<div class="redirect">
	<div class="logo-mark" style="width:48px;height:48px;margin-bottom:12px"></div>
	<h1>Starbird</h1>
	<p>Redirecting to the app…</p>
	<noscript>
		<p><a href={appUrl}>Open Starbird</a></p>
	</noscript>
</div>

<style>
	.redirect {
		display: flex;
		flex-direction: column;
		align-items: center;
		justify-content: center;
		min-height: 100vh;
		background: var(--bg);
		color: var(--ink);
		font-family: 'DM Sans', sans-serif;
		text-align: center;
		padding: 40px;
	}
	h1 {
		font-family: 'Bebas Neue', sans-serif;
		font-size: 2rem;
		color: var(--primary);
		letter-spacing: 0.04em;
	}
	p {
		color: var(--ink-muted);
		font-size: 0.9rem;
	}
</style>
