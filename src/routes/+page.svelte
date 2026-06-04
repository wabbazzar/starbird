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
	import BlogPanel from '$lib/components/BlogPanel.svelte';
	import { BlogFileSchema, type BlogPost } from '$lib/blog';
	import OnboardingModal from '$lib/components/OnboardingModal.svelte';
	import HamburgerMenu from '$lib/components/HamburgerMenu.svelte';

	type Panel = 'brands' | 'firms' | 'charts' | 'blog' | 'about';

	let firms = $state<Firm[]>([]);
	let brands = $state<Brand[]>([]);
	let posts = $state<BlogPost[]>([]);
	let loading = $state(true);
	let loadError = $state<string | null>(null);

	let panel = $state<Panel>('brands');
	let cat = $state('all');
	let search = $state('');
	let matchOnly = $state(false);
	let sortKey = $state<'harm' | 'date'>('harm');
	let sortDir = $state<'desc' | 'asc'>('desc');
	let showOnboarding = $state(false);
	let showEditValues = $state(false);
	let menuOpen = $state(false);

	// firmId → Firm index for O(1) ownership lookup from BrandCard
	const firmById = $derived(new Map(firms.map((f) => [f.id, f])));

	// Sort entries by addedAt date; missing dates are pushed to the end
	// regardless of direction so unstamped entries don't dominate either pole.
	function compareByDate(a: { addedAt?: string }, b: { addedAt?: string }) {
		const ad = a.addedAt ?? '';
		const bd = b.addedAt ?? '';
		if (!ad && !bd) return 0;
		if (!ad) return 1;
		if (!bd) return -1;
		if (ad === bd) return 0;
		return sortDir === 'desc' ? bd.localeCompare(ad) : ad.localeCompare(bd);
	}

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
			const resp = await fetch(`${base}/data.json?v=${__BUILD_ID__}`);
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
			// Blog is non-critical: a missing/invalid blog.json must not block
			// the core brands/firms experience, so load it best-effort.
			loadBlog();
		} catch (err) {
			console.error('failed to load data.json', err);
			loadError = String(err);
			loading = false;
		}
	});

	async function loadBlog() {
		try {
			const resp = await fetch(`${base}/blog.json?v=${__BUILD_ID__}`);
			if (!resp.ok) return;
			const parsed = BlogFileSchema.safeParse(await resp.json());
			if (parsed.success) posts = parsed.data.posts as BlogPost[];
			else console.warn('blog.json failed validation', parsed.error.issues);
		} catch (err) {
			console.warn('failed to load blog.json', err);
		}
	}

	/**
	 * Navigate to a brand/firm card by id: switch to the matching panel,
	 * clear filters so the target isn't hidden, then scroll + highlight.
	 * Shared by hash deep-links and the blog panel's entity chips.
	 */
	async function goToEntity(id: string) {
		const isFirm = firms.some((f) => f.id === id);
		const isBrand = brands.some((b) => b.id === id);
		if (!isFirm && !isBrand) return;
		cat = 'all';
		matchOnly = false;
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
	 * If the user landed via /card/<id>/ (which redirects to /#<id>),
	 * jump to the matching brand or firm card. Resets filters first
	 * so the target isn't hidden by an active category or match-only
	 * toggle. Switches panel based on whether the id is a firm or
	 * a brand.
	 */
	async function deepLinkToHash() {
		const id = decodeURIComponent(location.hash.replace(/^#/, ''));
		if (!id) return;
		await goToEntity(id);
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
				return true;
			})
			.sort((a, b) => {
				if (sortKey === 'date') {
					const d = compareByDate(a, b);
					if (d !== 0) return d;
					// Tiebreaker: harm impact within the same date, descending
					return brandImpactScore(b) - brandImpactScore(a);
				}
				const sa = brandImpactScore(a);
				const sb = brandImpactScore(b);
				if (sb !== sa) return sortDir === 'desc' ? sb - sa : sa - sb;
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
				return true;
			})
			.sort((a, b) => {
				if (sortKey === 'date') {
					const d = compareByDate(a, b);
					if (d !== 0) return d;
					return b.harmScore - a.harmScore;
				}
				return sortDir === 'desc' ? b.harmScore - a.harmScore : a.harmScore - b.harmScore;
			});
	});
</script>

<svelte:head>
	<meta property="og:type" content="website" />
	<meta property="og:site_name" content="Starbird" />
	<meta property="og:title" content="Starbird" />
	<meta property="og:description" content="Shop in line with your values. Track which brands align — and which don't." />
	<meta property="og:image" content="https://starbird42.com/cards/_default.png" />
	<meta property="og:image:width" content="1200" />
	<meta property="og:image:height" content="630" />
	<meta property="og:image:alt" content="Starbird — shop your values" />
	<meta property="og:url" content="https://starbird42.com/" />
	<meta name="twitter:card" content="summary_large_image" />
	<meta name="twitter:title" content="Starbird" />
	<meta name="twitter:description" content="Shop in line with your values. Track which brands align — and which don't." />
	<meta name="twitter:image" content="https://starbird42.com/cards/_default.png" />
</svelte:head>

<div class="app">
	<TopBar
		searchTerm={search}
		{menuOpen}
		onsearch={(v) => (search = v)}
		onmenu={() => (menuOpen = !menuOpen)}
		onscrolltop={scrollToTop}
	/>
	<StatStrip {firms} {brands} />
	{#if panel === 'brands' || panel === 'firms'}
		<FilterRow
			activeCat={cat}
			onchange={(id) => (cat = id)}
			{matchOnly}
			ontoggleMatch={() => (matchOnly = !matchOnly)}
			{sortKey}
			{sortDir}
			onsort={(key) => {
				if (key === sortKey) {
					sortDir = sortDir === 'desc' ? 'asc' : 'desc';
				} else {
					sortKey = key;
				}
			}}
		/>
	{/if}

	<div class="scroll" class:wide-grid={panel === 'brands' || panel === 'firms'} bind:this={scrollEl} onscroll={onScroll}>
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
		{:else if panel === 'blog'}
			{#if posts.length === 0}
				<p class="empty">No dispatches yet. The nightly runner posts here after each run.</p>
			{:else}
				<BlogPanel {posts} {firms} {brands} onselect={goToEntity} />
			{/if}
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

	<HamburgerMenu
		open={menuOpen}
		onclose={() => (menuOpen = false)}
		oneditValues={() => (showEditValues = true)}
	/>
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

	/* ============================================================
	   DESKTOP — sidebar app shell (mobile is untouched below 1024px)
	   ============================================================ */
	@media (min-width: 1024px) {
		.app {
			max-width: 1280px;
			margin-inline: auto;
			border-inline: 1px solid var(--border);
			box-shadow: var(--shadow-panel);
			display: grid;
			grid-template-columns: 248px minmax(0, 1fr);
			grid-template-rows: auto auto auto 1fr;
			grid-template-areas:
				'header header'
				'stats  stats'
				'nav    main'
				'filter main';
		}

		.scroll {
			grid-area: main;
			border-left: 1px solid var(--border);
			padding: 22px 18px 36px;
			scrollbar-gutter: stable;
		}
		/* Single centered reading column; capped width keeps line length
		   readable while filling more of the main area than before. */
		.scroll.wide-grid {
			display: grid;
			grid-template-columns: minmax(0, 960px);
			justify-content: center;
			gap: 12px;
			align-content: start;
		}
		.wide-grid :global(.card) {
			margin-bottom: 0;
		}
		.wide-grid .count,
		.wide-grid .empty {
			grid-column: 1 / -1;
		}
		.count {
			font-size: 0.66rem;
			margin-bottom: 2px;
		}

		.scroll-top-btn {
			bottom: 24px;
			right: calc((100vw - 1280px) / 2 + 24px);
		}
	}
</style>
