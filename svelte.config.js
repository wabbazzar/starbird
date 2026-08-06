import adapterStatic from '@sveltejs/adapter-static';
import { vitePreprocess } from '@sveltejs/vite-plugin-svelte';

const dev = process.env.NODE_ENV !== 'production';

/** @type {import('@sveltejs/kit').Config} */
const config = {
	preprocess: vitePreprocess(),

	kit: {
		adapter: adapterStatic({
			pages: 'build',
			assets: 'build',
			fallback: '404.html',
			precompress: false,
			strict: false
		}),
		paths: {
			base: process.env.BASE_PATH ?? ''
		},
		alias: {
			$lib: './src/lib'
		},
		prerender: {
			handleMissingId: 'ignore'
		},
		// The runner redeploys daily, which renames every hashed JS chunk.
		// Poll for a new deployment so the `updated` store flips; +layout.svelte
		// then forces a full reload on the next navigation instead of importing a
		// chunk the new build already deleted ("Failed to fetch dynamically
		// imported module").
		version: {
			pollInterval: 60000
		}
	}
};

export default config;
