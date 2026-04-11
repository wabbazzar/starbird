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
			fallback: 'index.html',
			precompress: false,
			strict: false
		}),
		paths: {
			base: dev ? '' : process.env.BASE_PATH ?? '/starbird'
		},
		alias: {
			$lib: './src/lib'
		}
	}
};

export default config;
