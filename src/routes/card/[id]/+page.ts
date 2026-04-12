import type { EntryGenerator, PageLoad } from './$types';
import dataJson from '../../../../static/data.json';

/**
 * Prerender one HTML page per brand and firm. adapter-static uses
 * entries() to know which [id] values to generate at build time.
 * Each page carries card-specific OG meta tags so Slack/iMessage
 * render a tappable preview card when the URL is shared.
 */
export const entries: EntryGenerator = () => {
	const ids = new Set<string>();
	for (const f of dataJson.firms) ids.add(f.id);
	for (const b of dataJson.brands) ids.add(b.id);
	return [...ids].map((id) => ({ id }));
};

export const prerender = true;
export const ssr = true;  // Override parent's ssr:false so OG meta tags render in HTML

export const load: PageLoad = ({ params }) => {
	const firm = dataJson.firms.find((f: { id: string }) => f.id === params.id) ?? null;
	const brand = dataJson.brands.find((b: { id: string }) => b.id === params.id) ?? null;

	// Build the display values for OG tags
	let title = 'Starbird';
	let description = 'Shop in line with your values.';
	let type: 'brand' | 'firm' | 'unknown' = 'unknown';

	if (brand) {
		type = 'brand';
		title = `Starbird — ${brand.avoid}`;
		description = brand.why?.slice(0, 200) ?? '';
	} else if (firm) {
		type = 'firm';
		title = `Starbird — ${firm.name}`;
		description = firm.summary?.slice(0, 200) ?? '';
		if (firm.harmScore) {
			description = `Harm score: ${firm.harmScore}/100. ${description}`;
		}
	}

	return {
		id: params.id,
		type,
		title,
		description,
		firm,
		brand
	};
};
