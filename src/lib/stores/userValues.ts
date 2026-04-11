import { writable, derived } from 'svelte/store';
import { browser } from '$app/environment';
import type { ValueId } from '$lib/values';

const STORAGE_KEY = 'starbird:values';

function initial(): ValueId[] {
	if (!browser) return [];
	try {
		const raw = localStorage.getItem(STORAGE_KEY);
		if (!raw) return [];
		const parsed = JSON.parse(raw);
		return Array.isArray(parsed) ? (parsed as ValueId[]) : [];
	} catch {
		return [];
	}
}

function createUserValues() {
	const store = writable<ValueId[]>(initial());

	function persist(v: ValueId[]) {
		if (browser) localStorage.setItem(STORAGE_KEY, JSON.stringify(v));
	}

	return {
		subscribe: store.subscribe,
		set: (v: ValueId[]) => {
			persist(v);
			store.set(v);
		},
		toggle: (id: ValueId) =>
			store.update((current) => {
				const next = current.includes(id)
					? current.filter((x) => x !== id)
					: [...current, id];
				persist(next);
				return next;
			}),
		clear: () => {
			persist([]);
			store.set([]);
		}
	};
}

export const userValues = createUserValues();

export const hasOnboarded = derived(userValues, ($v) => $v.length > 0);
