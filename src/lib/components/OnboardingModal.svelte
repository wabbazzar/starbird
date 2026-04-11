<script lang="ts">
	import { VALUES, type ValueId } from '$lib/values';
	import { userValues } from '$lib/stores/userValues';

	type Props = {
		initial?: ValueId[];
		onclose: () => void;
		title?: string;
	};

	let { initial = [], onclose, title = 'What do you align with?' }: Props = $props();
	// Snapshot the initial selection once, not on every re-render.
	let selected = $state<ValueId[]>([...$state.snapshot(initial)]);

	function toggle(id: ValueId) {
		selected = selected.includes(id) ? selected.filter((x) => x !== id) : [...selected, id];
	}

	function confirm() {
		if (selected.length === 0) return;
		userValues.set(selected);
		onclose();
	}
</script>

<div class="backdrop">
	<div class="sheet">
		<div class="logo-mark" style="width:48px;height:48px;margin-bottom:14px"></div>
		<h1 class="display-title">Starbird</h1>
		<p class="intro">{title}</p>
		<p class="sub">
			Pick the values you want this app to use when it shows you brands. You can change this later.
		</p>

		<div class="grid">
			{#each VALUES as v (v.id)}
				{@const active = selected.includes(v.id)}
				<button
					type="button"
					class="value-card"
					class:active
					onclick={() => toggle(v.id)}
					aria-pressed={active}
				>
					<div class="row">
						<span class="icon" aria-hidden="true">{v.icon}</span>
						<span class="label">{v.label}</span>
						<span class="check" aria-hidden="true">{active ? '●' : '○'}</span>
					</div>
					<p class="desc">{v.description}</p>
				</button>
			{/each}
		</div>

		<div class="footer">
			<span class="count">{selected.length} selected</span>
			<button class="btn btn-primary" onclick={confirm} disabled={selected.length === 0}>
				Continue
			</button>
		</div>
	</div>
</div>

<style>
	.backdrop {
		position: fixed;
		inset: 0;
		background: rgba(0, 0, 0, 0.72);
		backdrop-filter: blur(6px);
		display: flex;
		align-items: flex-start;
		justify-content: center;
		padding: 20px;
		overflow-y: auto;
		z-index: 100;
	}
	.sheet {
		width: 100%;
		max-width: 560px;
		background: var(--surface);
		border: 1px solid var(--border);
		border-radius: var(--radius);
		padding: 26px 22px 22px;
		margin: 40px 0;
	}
	.display-title {
		font-family: 'Bebas Neue', sans-serif;
		font-size: 2.4rem;
		line-height: 1;
		letter-spacing: 0.04em;
		color: var(--primary);
		margin-bottom: 6px;
	}
	.intro {
		font-size: 1rem;
		color: var(--ink);
		margin-bottom: 4px;
	}
	.sub {
		font-size: 0.82rem;
		color: var(--ink-muted);
		margin-bottom: 18px;
		line-height: 1.45;
	}
	.grid {
		display: grid;
		grid-template-columns: 1fr;
		gap: 10px;
	}
	@media (min-width: 520px) {
		.grid {
			grid-template-columns: 1fr 1fr;
		}
	}
	.value-card {
		text-align: left;
		background: var(--surface-2);
		border: 1px solid var(--border);
		border-radius: 10px;
		padding: 12px 14px;
		cursor: pointer;
		transition: all 150ms ease;
		color: var(--ink);
		font-family: inherit;
	}
	.value-card:hover {
		border-color: var(--primary);
	}
	.value-card.active {
		background: var(--primary-dim);
		border-color: var(--primary);
	}
	.row {
		display: flex;
		align-items: center;
		gap: 10px;
		margin-bottom: 4px;
	}
	.icon {
		color: var(--gold);
		font-size: 1rem;
	}
	.label {
		font-weight: 600;
		font-size: 0.92rem;
		flex: 1;
	}
	.check {
		color: var(--primary);
		font-size: 1rem;
	}
	.desc {
		font-size: 0.74rem;
		color: var(--ink-muted);
		line-height: 1.4;
	}
	.footer {
		display: flex;
		align-items: center;
		justify-content: space-between;
		margin-top: 20px;
		padding-top: 14px;
		border-top: 1px solid var(--border);
	}
	.count {
		font-family: 'DM Mono', monospace;
		font-size: 0.7rem;
		color: var(--ink-muted);
	}
</style>
