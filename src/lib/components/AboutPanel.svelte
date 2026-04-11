<script lang="ts">
	import { VALUES } from '$lib/values';
	import { userValues } from '$lib/stores/userValues';

	type Props = { oneditValues: () => void };
	let { oneditValues }: Props = $props();
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
		something we'll keep refining. It's opinionated, not encyclopedic.
	</p>
	<button class="btn btn-ghost" onclick={oneditValues}>Edit my values</button>
</section>

<section class="block">
	<h2>How it works</h2>
	<p>
		Every brand and firm is tagged with two sets: <strong>harms</strong> (the values its behavior conflicts with) and
		<strong>aligns</strong> (the values it supports). When you pick your values, Starbird classifies each entry as
		<em>avoid</em>, <em>align</em>, or <em>neutral</em>. Many entries are neutral relative to any given
		value set — that's expected.
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
	<div class="sources">
		<a href="https://pestakeholder.org/private-equity-bankruptcy/" target="_blank" rel="noopener">
			PESP Bankruptcy Tracker
		</a>
		<a
			href="https://americansfortaxfairness.org/private-equity-public-damage/"
			target="_blank"
			rel="noopener"
		>
			Americans for Tax Fairness
		</a>
		<a
			href="https://en.wikipedia.org/wiki/List_of_private_equity_owned_companies_that_have_filed_for_bankruptcy"
			target="_blank"
			rel="noopener"
		>
			Wikipedia — PE bankruptcies
		</a>
		<a href="https://www.resistandunsubscribe.com/" target="_blank" rel="noopener">
			Galloway — Resist &amp; Unsubscribe
		</a>
	</div>
	<p class="disclaimer">Not investment advice. Ownership data as of 2024–2025.</p>
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
	.sources {
		display: flex;
		flex-direction: column;
		gap: 6px;
		margin: 8px 0;
	}
	.sources a {
		font-family: 'DM Mono', monospace;
		font-size: 0.72rem;
	}
	.disclaimer {
		margin-top: 12px;
		font-family: 'DM Mono', monospace;
		font-size: 0.62rem;
		color: var(--ink-faint);
	}
</style>
