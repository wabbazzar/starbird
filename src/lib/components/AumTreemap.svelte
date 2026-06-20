<script lang="ts">
	import type { Firm } from '$lib/types';
	import { squarify } from '$lib/aggregations';

	type Props = { firms: Firm[]; topN?: number };
	let { firms, topN = 28 }: Props = $props();

	const W = 1000;
	const H = 560;

	const rects = $derived.by(() => {
		const items = firms
			.filter((f) => f.aumVal > 0)
			.sort((a, b) => b.aumVal - a.aumVal)
			.slice(0, topN)
			.map((f) => ({ value: f.aumVal, firm: f }));
		return squarify(items, W, H);
	});

	// Color by harm score: higher harm = more saturated red.
	const fill = (harm: number) =>
		`color-mix(in srgb, var(--avoid) ${Math.max(8, Math.min(100, harm))}%, var(--surface-2))`;
	const fmtAum = (b: number) => (b >= 1000 ? `$${(b / 1000).toFixed(1)}T` : `$${b}B`);
</script>

<section class="block">
	<div class="section-label">// AUM treemap — area = assets under management, color = harm score</div>
	<p class="caption">
		Area-encoded so the magnitude spread reads correctly (a bar chart compresses the long tail).
	</p>
	<svg viewBox="0 0 {W} {H}" preserveAspectRatio="xMidYMid meet" role="img" aria-label="Firms sized by AUM, colored by harm score">
		{#each rects as r (r.item.firm.id)}
			<g>
				<rect
					x={r.x + 1}
					y={r.y + 1}
					width={Math.max(0, r.w - 2)}
					height={Math.max(0, r.h - 2)}
					rx="3"
					fill={fill(r.item.firm.harmScore)}
				/>
				{#if r.w > 90 && r.h > 34}
					<text x={r.x + 8} y={r.y + 20} class="lbl">{r.item.firm.name}</text>
					<text x={r.x + 8} y={r.y + 36} class="sub">{fmtAum(r.item.firm.aumVal)} · harm {r.item.firm.harmScore}</text>
				{:else if r.w > 50 && r.h > 18}
					<text x={r.x + 6} y={r.y + 14} class="sub">{fmtAum(r.item.firm.aumVal)}</text>
				{/if}
			</g>
		{/each}
	</svg>
</section>

<style>
	.block {
		background: var(--surface);
		border: 1px solid var(--border);
		border-radius: var(--radius);
		padding: 14px 16px;
		margin-bottom: 12px;
	}
	.section-label {
		font-family: 'DM Mono', monospace;
		font-size: 0.66rem;
		color: var(--ink-muted);
		letter-spacing: 0.04em;
	}
	.caption {
		font-size: 0.72rem;
		color: var(--ink-faint);
		margin: 6px 0 8px;
	}
	svg {
		width: 100%;
		height: auto;
		display: block;
	}
	.lbl {
		font-size: 13px;
		font-weight: 600;
		fill: var(--bg);
	}
	.sub {
		font-family: 'DM Mono', monospace;
		font-size: 11px;
		fill: var(--bg);
		opacity: 0.85;
	}
</style>
