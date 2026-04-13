import { z } from 'zod';
import { VALUES } from './values';
import { QUEST_IDS } from './quests';
import { CATEGORY_IDS } from './categories';

const VALUE_ID_LIST = VALUES.map((v) => v.id) as [string, ...string[]];
const QUEST_ID_LIST = [...QUEST_IDS] as [string, ...string[]];
const CATEGORY_ID_LIST = [...CATEGORY_IDS] as [string, ...string[]];

export const ValueIdSchema = z.enum(VALUE_ID_LIST);
export const QuestIdSchema = z.enum(QUEST_ID_LIST);
export const CategoryIdSchema = z.enum(CATEGORY_ID_LIST);

const SlugIdSchema = z
	.string()
	.min(2)
	.regex(/^[a-z0-9][a-z0-9_]*$/, 'ids must be lowercase alphanumeric + underscore');

export const OwnershipSchema = z.object({
	firmId: SlugIdSchema,
	stake: z.enum(['majority', 'minority', 'former', 'post_bankrupt']),
	since: z.string().optional(),
	until: z.string().optional()
});

export const FirmSchema = z.object({
	id: SlugIdSchema,
	name: z.string().min(1),
	aum: z.string().min(1),
	aumVal: z.number().nonnegative(),
	summary: z.string().min(1),
	brands: z.array(z.string()),
	layoffs: z.string(),
	notableBk: z.string(),
	harmScore: z.number().int().min(0).max(100),
	source: z.string().url(),
	cats: z.array(CategoryIdSchema),
	harms: z.array(QuestIdSchema),
	aligns: z.array(QuestIdSchema),
	addedAt: z.string().date().optional()
});

export const BrandSchema = z.object({
	id: SlugIdSchema,
	avoid: z.string().min(1),
	ownership: z.array(OwnershipSchema).min(1),
	cat: CategoryIdSchema,
	alts: z.array(z.string()),
	why: z.string().min(1),
	harms: z.array(QuestIdSchema),
	aligns: z.array(QuestIdSchema),
	addedAt: z.string().date().optional()
});

export const DataFileSchema = z
	.object({
		version: z.number().int().positive(),
		firms: z.array(FirmSchema),
		brands: z.array(BrandSchema)
	})
	.superRefine((data, ctx) => {
		// Cross-reference: every ownership.firmId must exist in firms
		const firmIds = new Set(data.firms.map((f) => f.id));
		data.brands.forEach((brand, bi) => {
			brand.ownership.forEach((own, oi) => {
				if (!firmIds.has(own.firmId)) {
					ctx.addIssue({
						code: 'custom',
						path: ['brands', bi, 'ownership', oi, 'firmId'],
						message: `unknown firmId "${own.firmId}" on brand "${brand.avoid}"`
					});
				}
			});
		});
		// Unique firm IDs
		const seenFirms = new Set<string>();
		data.firms.forEach((f, i) => {
			if (seenFirms.has(f.id)) {
				ctx.addIssue({
					code: 'custom',
					path: ['firms', i, 'id'],
					message: `duplicate firm id "${f.id}"`
				});
			}
			seenFirms.add(f.id);
		});
		// Unique brand IDs
		const seenBrands = new Set<string>();
		data.brands.forEach((b, i) => {
			if (seenBrands.has(b.id)) {
				ctx.addIssue({
					code: 'custom',
					path: ['brands', i, 'id'],
					message: `duplicate brand id "${b.id}"`
				});
			}
			seenBrands.add(b.id);
		});
	});

export type ValidatedDataFile = z.infer<typeof DataFileSchema>;
