<script lang="ts">
	import { VALUES } from '$lib/values';

	type Props = { oneditValues: () => void };
	let { oneditValues }: Props = $props();

	// Sources grouped by the value system they feed. Kept in parallel with
	// scripts/labels.py STRATEGY_LABELS — when a new strategy is added to
	// the research bank, add its primary source here too.
	type SourceLink = { label: string; url: string; note?: string };
	const SOURCES: { value: string; title: string; links: SourceLink[] }[] = [
		{
			value: 'workers',
			title: 'Workers — labor & ICE',
			links: [
				{ label: 'Mijente — No Tech for ICE', url: 'https://notechforice.com/' },
				{ label: 'USASpending.gov — federal contracts', url: 'https://www.usaspending.gov/' },
				{ label: 'ICE FOIA reading room', url: 'https://www.ice.gov/foia/library' },
				{
					label: 'PESP — PE bankruptcy tracker',
					url: 'https://pestakeholder.org/private-equity-bankruptcy/'
				},
				{
					label: 'Americans for Tax Fairness — PE public damage',
					url: 'https://americansfortaxfairness.org/private-equity-public-damage/'
				}
			]
		},
		{
			value: 'environment',
			title: 'Environment — emissions & pollution',
			links: [
				{
					label: 'EPA Toxics Release Inventory',
					url: 'https://www.epa.gov/toxics-release-inventory-tri-program'
				},
				{ label: 'Climate TRACE — satellite emissions', url: 'https://climatetrace.org/' },
				{ label: 'EWG Consumer Guides', url: 'https://www.ewg.org/consumer-guides' }
			]
		},
		{
			value: 'animals',
			title: 'Animals — welfare & cruelty-free',
			links: [
				{
					label: 'Cruelty Free International database',
					url: 'https://crueltyfreeinternational.org/'
				},
				{
					label: 'PETA — companies that test on animals',
					url: 'https://www.peta.org/living/beauty/companies-test-animals/'
				},
				{
					label: 'Mercy For Animals investigations',
					url: 'https://mercyforanimals.org/investigations/'
				}
			]
		},
		{
			value: 'health',
			title: 'Health — ingredients & processing',
			links: [
				{ label: 'EWG Food Scores', url: 'https://www.ewg.org/foodscores/' },
				{
					label: 'CSPI — Chemical Cuisine additive ratings',
					url: 'https://www.cspinet.org/chemical-cuisine'
				},
				{
					label: 'NOVA ultra-processed classification',
					url: 'https://www.ncbi.nlm.nih.gov/pmc/articles/PMC6322572/'
				}
			]
		},
		{
			value: 'extraction',
			title: 'Extraction — private equity & asset stripping',
			links: [
				{
					label: 'PESP — PE bankruptcy tracker',
					url: 'https://pestakeholder.org/private-equity-bankruptcy/'
				},
				{ label: 'SEC EDGAR — 10-K / Form D filings', url: 'https://www.sec.gov/edgar/search-and-access' },
				{ label: 'NYT DealBook archive', url: 'https://www.nytimes.com/section/business/dealbook' },
				{
					label: 'Wikipedia — PE bankruptcy list',
					url: 'https://en.wikipedia.org/wiki/List_of_private_equity_owned_companies_that_have_filed_for_bankruptcy'
				}
			]
		},
		{
			value: 'elite_impunity',
			title: 'Elite impunity — billionaire & donor networks',
			links: [
				{
					label: 'Unsealed Epstein court documents',
					url: 'https://www.documentcloud.org/documents/24380582-epstein-documents'
				},
				{ label: 'LittleSis — power network', url: 'https://littlesis.org/' },
				{
					label: 'ICIJ Offshore Leaks (Panama / Pandora Papers)',
					url: 'https://offshoreleaks.icij.org/'
				},
				{ label: 'Galloway — Resist & Unsubscribe', url: 'https://www.resistandunsubscribe.com/' }
			]
		}
	];
</script>

<section class="block">
	<h2>Shop in line with your values.</h2>
	<p>
		Starbird is a reference for people who want their spending to match what they actually believe
		in. Pick the values that matter to you, and the app highlights brands that conflict with them,
		along with independent alternatives.
	</p>
	<p>
		The data is a living list — brands, firms, and the harms or alignments attached to each are
		something we keep refining. It's opinionated, not encyclopedic.
	</p>
	<button class="btn btn-ghost" onclick={oneditValues}>Edit my values</button>
</section>

<section class="block">
	<h2>How it works</h2>
	<p>
		Every brand and firm is tagged with two sets: <strong>harms</strong> (the values its behavior
		conflicts with) and <strong>aligns</strong> (the values it supports). When you pick your values,
		Starbird classifies each entry as <em>avoid</em>, <em>align</em>, or <em>neutral</em>. Many
		entries are neutral relative to any given value set — that's expected.
	</p>
	<ul class="values-list">
		{#each VALUES as v (v.id)}
			<li>
				<span class="icon">{v.icon}</span>
				<div>
					<strong>{v.label}</strong>
					<p>{v.description}</p>
				</div>
			</li>
		{/each}
	</ul>
</section>

<section class="block">
	<h2>A note on private equity</h2>
	<p>
		One of the lenses in the app is <strong>extraction</strong> — brands and firms whose ownership
		model is built on debt-loading companies, stripping assets, and cutting workers to manufacture
		returns. It's legal, it's profitable, and it's the reason a lot of beloved brands end up
		bankrupt within 3–5 years of being acquired. In 2024, PE-backed companies caused
		<strong>65,850+ layoffs</strong> and were behind
		<strong>56% of large U.S. bankruptcies</strong>, despite representing roughly 6.5% of the
		economy. That's one data point among several you can use.
	</p>
</section>

<section class="block">
	<h2>Sources</h2>
	<p class="source-intro">
		Data is pulled from public trackers, government databases, and investigative journalism —
		grouped here by the value system they feed.
	</p>
	{#each SOURCES as group (group.value)}
		<div class="source-group">
			<div class="source-title">{group.title}</div>
			<div class="source-links">
				{#each group.links as link (link.url)}
					<a href={link.url} target="_blank" rel="noopener">→ {link.label}</a>
				{/each}
			</div>
		</div>
	{/each}
	<p class="disclaimer">
		Not investment advice. Not comprehensive. Ownership and contract data as of 2024–2026. Report
		an error by opening an issue on the <a
			href="https://github.com/wabbazzar/starbird"
			target="_blank"
			rel="noopener">repo</a
		>.
	</p>
</section>

<style>
	.block {
		background: var(--surface);
		border: 1px solid var(--border);
		border-radius: var(--radius);
		padding: 18px 20px;
		margin-bottom: 14px;
	}
	h2 {
		font-size: 1.25rem;
		margin-bottom: 8px;
		color: var(--ink);
	}
	p {
		font-size: 0.88rem;
		color: var(--ink-muted);
		line-height: 1.6;
		margin-bottom: 8px;
	}
	strong {
		color: var(--ink);
	}
	em {
		color: var(--primary);
		font-style: normal;
	}
	.btn {
		margin-top: 6px;
	}
	.values-list {
		list-style: none;
		padding: 0;
		margin: 10px 0 0;
	}
	.values-list li {
		display: flex;
		gap: 12px;
		padding: 10px 0;
		border-top: 1px solid var(--border);
	}
	.values-list .icon {
		color: var(--gold);
		font-size: 1.1rem;
		flex-shrink: 0;
		width: 20px;
	}
	.values-list strong {
		display: block;
		margin-bottom: 2px;
	}
	.values-list p {
		margin: 0;
		font-size: 0.78rem;
	}
	.source-intro {
		font-size: 0.82rem;
		margin-bottom: 14px;
	}
	.source-group {
		padding: 10px 0;
		border-top: 1px solid var(--border);
	}
	.source-title {
		font-family: 'Bebas Neue', sans-serif;
		font-size: 0.92rem;
		letter-spacing: 0.04em;
		color: var(--primary);
		margin-bottom: 6px;
	}
	.source-links {
		display: flex;
		flex-direction: column;
		gap: 4px;
	}
	.source-links a {
		font-family: 'DM Mono', monospace;
		font-size: 0.7rem;
	}
	.disclaimer {
		margin-top: 14px;
		padding-top: 10px;
		border-top: 1px solid var(--border);
		font-family: 'DM Mono', monospace;
		font-size: 0.62rem;
		color: var(--ink-faint);
	}
</style>
