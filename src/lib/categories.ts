export type CategoryId =
	| 'tech'
	| 'food'
	| 'coffee'
	| 'retail'
	| 'health'
	| 'pets'
	| 'home'
	| 'hospitality'
	| 'finance';

export interface CategoryDef {
	id: CategoryId;
	label: string;
}

export const CATEGORIES: readonly CategoryDef[] = [
	{ id: 'tech', label: 'Tech' },
	{ id: 'food', label: 'Fast Food' },
	{ id: 'coffee', label: 'Coffee' },
	{ id: 'retail', label: 'Retail' },
	{ id: 'health', label: 'Health' },
	{ id: 'pets', label: 'Pets' },
	{ id: 'home', label: 'Home' },
	{ id: 'hospitality', label: 'Hotels' },
	{ id: 'finance', label: 'Services' }
] as const;

export const CATEGORY_BY_ID: Record<CategoryId, CategoryDef> = Object.fromEntries(
	CATEGORIES.map((c) => [c.id, c])
) as Record<CategoryId, CategoryDef>;

export const CATEGORY_IDS: readonly CategoryId[] = CATEGORIES.map((c) => c.id);
