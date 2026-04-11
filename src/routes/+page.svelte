<script lang="ts">
	import { onMount } from 'svelte';
	import { base } from '$app/paths';
	import { userValues, hasOnboarded } from '$lib/stores/userValues';
	import { classify, type Brand, type Firm } from '$lib/types';
	import { DataFileSchema } from '$lib/schema';

	import TopBar from '$lib/components/TopBar.svelte';
	import StatStrip from '$lib/components/StatStrip.svelte';
	import FilterRow from '$lib/components/FilterRow.svelte';
	import BottomNav from '$lib/components/BottomNav.svelte';
	import BrandCard from '$lib/components/BrandCard.svelte';
	import FirmCard from '$lib/components/FirmCard.svelte';
	import ChartsPanel from '$lib/components/ChartsPanel.svelte';
	import AboutPanel from '$lib/components/AboutPanel.svelte';
	import OnboardingModal from '$lib/components/OnboardingModal.svelte';

	type Panel = 'brands' | 'firms' | 'charts' | 'about';

	let firms = $state<Firm[]>([]);
	let brands = $state<Brand[]>([]);
	let loading = $state(true);
	let loadError = $state<string | null>(null);

	let panel = $state<Panel>('brands');
	let cat = $state('all');
	let search = $state('');
	let matchOnly = $state(false);
	let showOnboarding = $state(false);
	let showEditValues = $state(false);

	// firmId → Firm index for O(1) ownership lookup from BrandCard
	const firmById = $derived(new Map(firms.map((f) => [f.id, f])));

	onMount(async () => {
		try {
			const resp = await fetch(`${base}/data.json`);
			const raw = await resp.json();
			const parsed = DataFileSchema.safeParse(raw);
			if (!parsed.success) {
				console.error('data.json failed schema validation', parsed.error.issues);
				loadError = `data.json failed validation: ${parsed.error.issues.length} issue(s). See console.`;
				loading = false;
				return;
			}
			firms = parsed.data.firms as Firm[];
			brands = parsed.data.brands as Brand[];
			loading = false;
			if (!$hasOnboarded) showOnboarding = true;
		} catch (err) {
			console.error('failed to load data.json', err);
			loadError = String(err);
			loading = false;
		}
	});

	const filteredBrands = $derived.by(() => {
		const q = search.trim().toLowerCase();
		return brands.filter((b) => {
			if (cat !== 'all' && b.cat !== cat) return false;
			if (q) {
				const ownerText = b.ownership
					.map((o) => firmById.get(o.firmId)?.name ?? o.firmId)
					.join(' ');
				const hay = [b.avoid, ownerText, b.why, ...b.alts].join(' ').toLowerCase();
				if (!hay.includes(q)) return false;
			}
			if (matchOnly) {
				const c = classify(b.harms, b.aligns, $userValues);
				if (c.kind === 'neutral') return false;
			}
			return true;
		});
	});

	const filteredFirms = $derived.by(() => {
		const q = search.trim().toLowerCase();
		return firms.filter((f) => {
			if (cat !== 'all' && !f.cats.includes(cat as never)) return false;
			if (q) {
				const hay = [f.name, f.summary, ...f.brands].join(' ').toLowerCase();
				if (!hay.includes(q)) return false;
			}
			if (matchOnly) {
				const c = classify(f.harms, f.aligns, $userValues);
				if (c.kind === 'neutral') return false;
			}
			return true;
		});
	});
</script>

<div class="app">
	<TopBar
		searchTerm={search}
		onsearch={(v) => (search = v)}
		onsettings={() => (showEditValues = true)}
	/>
	<StatStrip {firms} {brands} />
	{#if panel === 'brands' || panel === 'firms'}
		<FilterRow
			activeCat={cat}
			onchange={(id) => (cat = id)}
			{matchOnly}
			ontoggleMatch={() => (matchOnly = !matchOnly)}
		/>
	{/if}

	<div class="scroll">
		{#if loading}
			<p class="empty">Loading…</p>
		{:else if loadError}
			<p class="empty error">{loadError}</p>
		{:else if panel === 'brands'}
			{#if filteredBrands.length === 0}
				<p class="empty">No brands match. Try widening your filter.</p>
			{:else}
				<div class="count">{filteredBrands.length} brands</div>
				{#each filteredBrands as b (b.id)}
					{@const c = classify(b.harms, b.aligns, $userValues)}
					<BrandCard
						brand={b}
						classification={c.kind}
						matched={c.matched}
						{firmById}
					/>
				{/each}
			{/if}
		{:else if panel === 'firms'}
			{#if filteredFirms.length === 0}
				<p class="empty">No firms match.</p>
			{:else}
				{#each filteredFirms as f (f.id)}
					{@const c = classify(f.harms, f.aligns, $userValues)}
					<FirmCard firm={f} classification={c.kind} matched={c.matched} />
				{/each}
			{/if}
		{:else if panel === 'charts'}
			<ChartsPanel {firms} />
		{:else if panel === 'about'}
			<AboutPanel oneditValues={() => (showEditValues = true)} />
		{/if}
	</div>

	<BottomNav active={panel} onchange={(p) => (panel = p)} />
</div>

{#if showOnboarding}
	<OnboardingModal
		initial={$userValues}
		onclose={() => (showOnboarding = false)}
		title="What do you align with?"
	/>
{:else if showEditValues}
	<OnboardingModal
		initial={$userValues}
		onclose={() => (showEditValues = false)}
		title="Edit your values"
	/>
{/if}

<style>
	.app {
		display: flex;
		flex-direction: column;
		height: 100vh;
		height: 100dvh;
		overflow: hidden;
	}
	.scroll {
		flex: 1;
		overflow-y: auto;
		padding: 12px;
	}
	.count {
		font-family: 'DM Mono', monospace;
		font-size: 0.62rem;
		color: var(--ink-faint);
		margin-bottom: 8px;
		text-transform: uppercase;
		letter-spacing: 0.08em;
	}
	.empty {
		text-align: center;
		padding: 40px 20px;
		color: var(--ink-faint);
		font-family: 'DM Mono', monospace;
		font-size: 0.82rem;
	}
	.error {
		color: var(--avoid);
	}
</style>
