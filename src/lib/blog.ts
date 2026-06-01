import { z } from 'zod';
import { VALUES } from './values';

const VALUE_ID_LIST = VALUES.map((v) => v.id) as [string, ...string[]];

/**
 * One blog post = one nightly runner run that added entities. Authored by the
 * runner (a short narrative step after data enrichment) and backfilled from
 * runner-metrics-history.jsonl. Stored in static/blog.json, separate from
 * data.json so the main payload stays lean.
 */
export const BlogPostSchema = z.object({
	// `${date}-${strategy}`, e.g. "2026-06-01-nyt_dealbook_archive"
	id: z.string().min(3),
	// ISO date (YYYY-MM-DD) of the run
	date: z.string().date(),
	title: z.string().min(1),
	// strategy id that produced the run (matches the strategy bank)
	strategy: z.string().min(1),
	strategyLabel: z.string().min(1),
	// the value this run contributed to (workers, environment, …)
	value: z.enum(VALUE_ID_LIST),
	// 1–2 sentence lede, shown in the list and at the top of the post
	summary: z.string().min(1),
	// prose body; paragraphs separated by blank lines (rendered as <p>)
	body: z.string().min(1),
	// firm/brand ids this run added — rendered as chips linking to their cards
	entityIds: z.array(z.string()),
	// primary source URL for the strategy (optional)
	source: z.string().url().optional()
});

export const BlogFileSchema = z.object({
	version: z.number().int().positive(),
	posts: z.array(BlogPostSchema)
});

export type BlogPost = z.infer<typeof BlogPostSchema>;
export type BlogFile = z.infer<typeof BlogFileSchema>;
