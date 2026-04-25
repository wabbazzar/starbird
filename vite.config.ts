import { sveltekit } from '@sveltejs/kit/vite';
import { defineConfig } from 'vite';

// Stamps each build with a unique id so we can cache-bust data.json.
// GitHub Pages serves static assets with Cache-Control: max-age=600,
// which means the CDN can serve a stale data.json for up to 10 min
// after the runner pushes. Appending ?v=<build-id> to the fetch URL
// gives each deploy its own cache key, so users never read a stale
// copy on first load.
const BUILD_ID = Date.now().toString(36);

export default defineConfig({
	plugins: [sveltekit()],
	define: {
		__BUILD_ID__: JSON.stringify(BUILD_ID)
	},
	server: {
		port: 5173,
		strictPort: false
	}
});
