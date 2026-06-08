import type { EntryGenerator, PageLoad } from './$types';
import blogJson from '../../../../static/blog.json';

/**
 * Prerender one HTML page per blog dispatch. adapter-static uses
 * entries() to know which [id] values to generate at build time.
 * Each page carries post-specific OG meta tags so Slack/iMessage
 * render a tappable preview card when the URL is shared. Mirrors
 * the /card/[id]/ route used for brands and firms.
 */
export const entries: EntryGenerator = () => {
	return (blogJson.posts as { id: string }[]).map((p) => ({ id: p.id }));
};

export const prerender = true;
export const ssr = true; // Override parent's ssr:false so OG meta tags render in HTML

export const load: PageLoad = ({ params }) => {
	const post =
		(blogJson.posts as { id: string; title: string; summary: string }[]).find(
			(p) => p.id === params.id
		) ?? null;

	let title = 'Starbird — Dispatch';
	let description = 'A dispatch from the Starbird research runner.';

	if (post) {
		title = `Starbird — ${post.title}`;
		description = post.summary?.slice(0, 200) ?? description;
	}

	return {
		id: params.id,
		title,
		description
	};
};
