import type { Config } from 'tailwindcss';

export default {
	content: ['./src/**/*.{html,js,svelte,ts}'],
	theme: {
		extend: {
			colors: {
				bg: 'var(--bg)',
				surface: 'var(--surface)',
				'surface-2': 'var(--surface-2)',
				border: 'var(--border)',
				'border-strong': 'var(--border-strong)',
				ink: 'var(--ink)',
				'ink-muted': 'var(--ink-muted)',
				'ink-faint': 'var(--ink-faint)',
				primary: 'var(--primary)',
				'primary-dim': 'var(--primary-dim)',
				gold: 'var(--gold)',
				'gold-dim': 'var(--gold-dim)',
				avoid: 'var(--avoid)',
				'avoid-dim': 'var(--avoid-dim)',
				align: 'var(--align)',
				'align-dim': 'var(--align-dim)'
			},
			fontFamily: {
				display: ['Bebas Neue', 'sans-serif'],
				sans: ['DM Sans', 'sans-serif'],
				mono: ['DM Mono', 'monospace']
			}
		}
	},
	plugins: []
} satisfies Config;
