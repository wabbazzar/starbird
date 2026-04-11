<script lang="ts">
	import type { Firm, Brand } from '$lib/types';

	type Props = {
		firms: Firm[];
		brands: Brand[];
	};

	let { firms, brands }: Props = $props();

	const totalAum = $derived(firms.reduce((a, f) => a + f.aumVal, 0));
	const aumLabel = $derived(
		totalAum >= 1000 ? `$${(totalAum / 1000).toFixed(1)}T` : `$${totalAum}B`
	);
	const avgHarm = $derived(
		firms.length ? Math.round(firms.reduce((a, f) => a + f.harmScore, 0) / firms.length) : 0
	);
</script>

<div class="strip no-scrollbar">
	<div class="item">
		<div class="val">{brands.length}</div>
		<div class="lbl">Brands tracked</div>
	</div>
	<div class="item">
		<div class="val">{firms.length}</div>
		<div class="lbl">Firms tracked</div>
	</div>
	<div class="item">
		<div class="val">{aumLabel}</div>
		<div class="lbl">Combined AUM</div>
	</div>
	<div class="item">
		<div class="val">{avgHarm}</div>
		<div class="lbl">Avg. harm score</div>
	</div>
</div>

<style>
	.strip {
		flex-shrink: 0;
		display: flex;
		overflow-x: auto;
		border-bottom: 1px solid var(--border);
	}
	.item {
		flex-shrink: 0;
		padding: 10px 16px;
		border-right: 1px solid var(--border);
		min-width: 110px;
	}
	.val {
		font-family: 'Bebas Neue', sans-serif;
		font-size: 1.3rem;
		color: var(--primary);
		line-height: 1;
	}
	.lbl {
		font-family: 'DM Mono', monospace;
		font-size: 0.58rem;
		color: var(--ink-faint);
		text-transform: uppercase;
		letter-spacing: 0.1em;
		margin-top: 3px;
	}
</style>
