import { writable } from 'svelte/store';
import { browser } from '$app/environment';

export type Theme = 'light' | 'dark';

const STORAGE_KEY = 'starbird:theme';

function initial(): Theme {
	if (!browser) return 'dark';
	const stored = localStorage.getItem(STORAGE_KEY) as Theme | null;
	if (stored === 'light' || stored === 'dark') return stored;
	return window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
}

function createTheme() {
	const { subscribe, set, update } = writable<Theme>(initial());

	function apply(t: Theme) {
		if (!browser) return;
		document.documentElement.setAttribute('data-theme', t);
		localStorage.setItem(STORAGE_KEY, t);
	}

	return {
		subscribe,
		set: (t: Theme) => {
			apply(t);
			set(t);
		},
		toggle: () =>
			update((t) => {
				const next: Theme = t === 'dark' ? 'light' : 'dark';
				apply(next);
				return next;
			}),
		init: () => {
			if (!browser) return;
			const t = initial();
			apply(t);
			set(t);
		}
	};
}

export const theme = createTheme();
