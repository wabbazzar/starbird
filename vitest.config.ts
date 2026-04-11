import { defineConfig } from 'vitest/config';
import { svelte } from '@sveltejs/vite-plugin-svelte';
import path from 'path';

export default defineConfig({
	plugins: [svelte({ hot: false })],
	test: {
		include: ['tests/unit/**/*.test.ts'],
		environment: 'jsdom',
		globals: true
	},
	resolve: {
		alias: {
			$lib: path.resolve(__dirname, 'src/lib')
		}
	}
});
