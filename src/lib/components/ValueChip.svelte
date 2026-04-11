<script lang="ts">
	import type { ValueId } from '$lib/values';
	import { VALUE_BY_ID } from '$lib/values';

	type Props = {
		id: ValueId;
		variant?: 'neutral' | 'avoid' | 'align' | 'active';
		onclick?: () => void;
	};

	let { id, variant = 'neutral', onclick }: Props = $props();
	const def = $derived(VALUE_BY_ID[id]);

	const variantClass = $derived(
		variant === 'avoid' ? 'chip chip-avoid' :
		variant === 'align' ? 'chip chip-align' :
		variant === 'active' ? 'chip chip-active' :
		'chip'
	);
</script>

{#if onclick}
	<button type="button" class={variantClass} {onclick}>
		<span aria-hidden="true">{def.icon}</span>
		<span>{def.label}</span>
	</button>
{:else}
	<span class={variantClass}>
		<span aria-hidden="true">{def.icon}</span>
		<span>{def.label}</span>
	</span>
{/if}
