<script lang="ts">
	import { onMount } from 'svelte';
	import { base } from '$app/paths';
	import { userValues, hasOnboarded } from '$lib/stores/userValues';
	import { classify, intrinsicKind, valueTags, type Brand, type Firm } from '$lib/types';
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
	let recentOnly = $state(false);
	let showOnboarding = $state(false);
	let showEditValues = $state(false);

	// firmId → Firm index for O(1) ownership lookup from BrandCard
	const firmById = $derived(new Map(firms.map((f) => [f.id, f])));

	// Most recent addedAt date across all brands and firms
	const latestDate = $derived(() => {
		let max = '';
		for (const b of brands) if (b.addedAt && b.addedAt > max) max = b.addedAt;
		for (const f of firms) if (f.addedAt && f.addedAt > max) max = f.addedAt;
		return max;
	});

	// Bound to the scroll container for scroll-to-top gestures.
	let scrollEl: HTMLDivElement | null = $state(null);
	let showScrollBtn = $state(false);

	function scrollToTop() {
		scrollEl?.scrollTo({ top: 0, behavior: 'smooth' });
	}
	function onScroll() {
		showScrollBtn = (scrollEl?.scrollTop ?? 0) > 300;
	}

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
			deepLinkToHash();
		} catch (err) {
			console.error('failed to load data.json', err);
			loadError = String(err);
			loading = false;
		}
	});

	/**
	 * If the user landed via /card/<id>/ (which redirects to /#<id>),
	 * jump to the matching brand or firm card. Resets filters first
	 * so the target isn't hidden by an active category or match-only
	 * toggle. Switches panel based on whether the id is a firm or
	 * a brand.
	 */
	async function deepLinkToHash() {
		const id = decodeURIComponent(location.hash.replace(/^#/, ''));
		if (!id) return;
		const isFirm = firms.some((f) => f.id === id);
		const isBrand = brands.some((b) => b.id === id);
		if (!isFirm && !isBrand) return;
		cat = 'all';
		matchOnly = false;
		recentOnly = false;
		panel = isFirm ? 'firms' : 'brands';
		// Wait for Svelte to re-render the (now unfiltered) list, then scroll.
		await new Promise((r) => requestAnimationFrame(() => r(null)));
		await new Promise((r) => requestAnimationFrame(() => r(null)));
		const el = document.getElementById(`entry-${id}`);
		if (el) {
			el.scrollIntoView({ behavior: 'smooth', block: 'start' });
			el.classList.add('card-deep-linked');
			setTimeout(() => el.classList.remove('card-deep-linked'), 1800);
		}
	}

	/**
	 * Highest-impact first: sort by the parent firm's harmScore descending.
	 * PE-owned brands (firm.aumVal > 0) get a 5-point inheritance discount
	 * so active perpetrators outrank PE victims. Self-owned brands (aumVal 0)
	 * use the raw score. Tiebreakers:
	 *   1. brands with a non-empty `why` (a proxy for evidence presence)
	 *   2. insertion order (stable — newest additions fall below older ones
	 *      at the same impact level, so the existing top doesn't shuffle on
	 *      every runner pass)
	 */
	function brandImpactScore(b: Brand): number {
		let best = 0;
		for (const o of b.ownership) {
			const firm = firmById.get(o.firmId);
			if (!firm || !firm.harmScore) continue;
			const discount = firm.aumVal > 0 ? 5 : 0;
			best = Math.max(best, firm.harmScore - discount);
		}
		return best;
	}

	const filteredBrands = $derived.by(() => {
		const q = search.trim().toLowerCase();
		return brands
			.filter((b) => {
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
				if (recentOnly && b.addedAt !== latestDate()) return false;
				return true;
			})
			.sort((a, b) => {
				const sa = brandImpactScore(a);
				const sb = brandImpactScore(b);
				if (sb !== sa) return sb - sa;
				const ea = a.why && a.why.length > 20 ? 1 : 0;
				const eb = b.why && b.why.length > 20 ? 1 : 0;
				return eb - ea;
			});
	});

	const filteredFirms = $derived.by(() => {
		const q = search.trim().toLowerCase();
		return firms
			.filter((f) => {
				if (cat !== 'all' && !f.cats.includes(cat as never)) return false;
				if (q) {
					const hay = [f.name, f.summary, ...f.brands].join(' ').toLowerCase();
					if (!hay.includes(q)) return false;
				}
				if (matchOnly) {
					const c = classify(f.harms, f.aligns, $userValues);
					if (c.kind === 'neutral') return false;
				}
				if (recentOnly && f.addedAt !== latestDate()) return false;
				return true;
			})
			.sort((a, b) => b.harmScore - a.harmScore);
	});
</script>

<svelte:head>
	<meta property="og:type" content="website" />
	<meta property="og:title" content="Starbird" />
	<meta property="og:description" content="Shop in line with your values. Track which brands align — and which don't." />
	<meta property="og:image" content="https://wabbazzar.github.io/starbird/cards/palantir_technologies.png" />
	<meta property="og:url" content="https://wabbazzar.github.io/starbird/" />
	<meta property="twitter:card" content="summary_large_image" />
	<meta property="twitter:title" content="Starbird" />
	<meta property="twitter:description" content="Shop in line with your values. Track which brands align — and which don't." />
	<meta property="twitter:image" content="https://wabbazzar.github.io/starbird/cards/palantir_technologies.png" />
</svelte:head>

<div class="app">
	<TopBar
		searchTerm={search}
		settingsOpen={showEditValues}
		onsearch={(v) => (search = v)}
		onsettings={() => (showEditValues = !showEditValues)}
		onscrolltop={scrollToTop}
	/>
	<StatStrip {firms} {brands} />
	{#if panel === 'brands' || panel === 'firms'}
		<FilterRow
			activeCat={cat}
			onchange={(id) => (cat = id)}
			{matchOnly}
			ontoggleMatch={() => (matchOnly = !matchOnly)}
			{recentOnly}
			ontoggleRecent={() => (recentOnly = !recentOnly)}
		/>
	{/if}

	<div class="scroll" bind:this={scrollEl} onscroll={onScroll}>
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
					{@const intrinsic = intrinsicKind(b.harms, b.aligns)}
					{@const t = valueTags(b.harms, b.aligns, $userValues)}
					<BrandCard
						brand={b}
						classification={c.kind}
						{intrinsic}
						tags={t}
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
					{@const intrinsic = intrinsicKind(f.harms, f.aligns)}
					{@const t = valueTags(f.harms, f.aligns, $userValues)}
					<FirmCard firm={f} classification={c.kind} {intrinsic} tags={t} />
				{/each}
			{/if}
		{:else if panel === 'charts'}
			<ChartsPanel {firms} {brands} />
		{:else if panel === 'about'}
			<AboutPanel oneditValues={() => (showEditValues = true)} />
		{/if}
	</div>

	<BottomNav active={panel} onchange={(p) => (panel = p)} />

	{#if showScrollBtn}
		<button
			type="button"
			class="scroll-top-btn"
			aria-label="Scroll to top"
			onclick={scrollToTop}
		>
			<span aria-hidden="true">↑</span>
		</button>
	{/if}
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
		height: 100vh;
		height: 100dvh;
		height: -webkit-fill-available; /* iOS PWA: fills the actual screen */
		display: flex;
		flex-direction: column;
		overflow: hidden;
	}
	.scroll {
		flex: 1;
		min-height: 0;
		overflow-y: auto;
		padding: 12px;
		-webkit-overflow-scrolling: touch;
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
	.scroll-top-btn {
		position: fixed;
		bottom: calc(env(safe-area-inset-bottom, 0px) + 62px);
		right: 14px;
		width: 40px;
		height: 40px;
		border-radius: 50%;
		background: var(--primary);
		color: var(--bg);
		border: none;
		font-size: 1.1rem;
		font-weight: 700;
		display: flex;
		align-items: center;
		justify-content: center;
		cursor: pointer;
		box-shadow: 0 2px 10px rgba(0, 0, 0, 0.3);
		z-index: 20;
		transition: opacity 150ms ease, transform 150ms ease;
	}
	.scroll-top-btn:active {
		transform: scale(0.9);
	}
</style>
