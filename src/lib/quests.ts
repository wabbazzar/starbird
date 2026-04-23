import type { ValueId } from './values';

export type QuestId =
	// workers
	| 'workers_general'
	| 'workers_ice_cooperation'
	| 'workers_mass_layoffs'
	| 'workers_positive'
	// environment
	| 'environment_general'
	| 'environment_positive'
	// animals
	| 'animals_general'
	| 'animals_positive'
	// health
	| 'health_general'
	| 'health_positive'
	// extraction
	| 'extraction_general'
	| 'extraction_sale_leaseback'
	| 'extraction_debt_loading'
	| 'extraction_positive'
	// elite impunity
	| 'elite_impunity_general'
	| 'elite_impunity_epstein_network'
	| 'elite_impunity_positive';

export interface QuestDef {
	id: QuestId;
	value: ValueId;
	label: string;
	short: string;
	description: string;
}

/**
 * Every quest rolls up to exactly one value. Users can filter by quest
 * or by value; when they filter by a value, any quest under it matches.
 *
 * First-class quest for v1 of the research loop: workers_ice_cooperation.
 * The *_general quests act as catch-alls for existing data that hasn't
 * been split into a more specific quest yet — they let us preserve
 * the existing tagging without forcing premature precision.
 */
export const QUESTS: readonly QuestDef[] = [
	// ─── workers ──────────────────────────────────────────────────
	{
		id: 'workers_general',
		value: 'workers',
		label: 'Workers (general)',
		short: 'General labor concerns',
		description: 'Catch-all for worker-hostile practices not yet split into a specific quest.'
	},
	{
		id: 'workers_ice_cooperation',
		value: 'workers',
		label: 'ICE cooperation',
		short: 'ICE contracts & data',
		description:
			'Companies with contracts, data-sharing, or services supporting ICE enforcement and detention.'
	},
	{
		id: 'workers_mass_layoffs',
		value: 'workers',
		label: 'Mass layoffs',
		short: 'Layoffs as strategy',
		description: 'Large-scale layoffs used as a financial or strategic lever post-acquisition.'
	},
	{
		id: 'workers_positive',
		value: 'workers',
		label: 'Worker-positive',
		short: 'Fair labor leaders',
		description:
			'Companies with strong labor practices: living wages, employee ownership, profit-sharing, union partnerships.'
	},

	// ─── environment ──────────────────────────────────────────────
	{
		id: 'environment_general',
		value: 'environment',
		label: 'Environment (general)',
		short: 'General environmental concerns',
		description: 'Catch-all for environmental harms not yet split into a specific quest.'
	},
	{
		id: 'environment_positive',
		value: 'environment',
		label: 'Environment-positive',
		short: 'Climate & planet leaders',
		description:
			'Companies leading on climate action: carbon-neutral operations, regenerative sourcing, circular economy models.'
	},

	// ─── animals ──────────────────────────────────────────────────
	{
		id: 'animals_general',
		value: 'animals',
		label: 'Animals (general)',
		short: 'General animal welfare',
		description: 'Catch-all for animal welfare concerns not yet split into a specific quest.'
	},
	{
		id: 'animals_positive',
		value: 'animals',
		label: 'Animal-positive',
		short: 'Cruelty-free leaders',
		description:
			'Companies committed to cruelty-free products: no animal testing, vegan formulations, certified humane supply chains.'
	},

	// ─── health ───────────────────────────────────────────────────
	{
		id: 'health_general',
		value: 'health',
		label: 'Health (general)',
		short: 'General health concerns',
		description: 'Catch-all for product/ingredient health concerns not yet split into a quest.'
	},
	{
		id: 'health_positive',
		value: 'health',
		label: 'Health-positive',
		short: 'Clean ingredient leaders',
		description:
			'Companies prioritizing consumer health: clean ingredients, organic certification, transparent labeling, minimal processing.'
	},

	// ─── extraction ───────────────────────────────────────────────
	{
		id: 'extraction_general',
		value: 'extraction',
		label: 'Extraction (general)',
		short: 'Predatory capital',
		description: 'Catch-all for PE-style asset-stripping not yet split into a specific quest.'
	},
	{
		id: 'extraction_positive',
		value: 'extraction',
		label: 'Extraction-positive',
		short: 'Stakeholder-first ownership',
		description:
			'Companies with ownership structures that build rather than extract value: cooperatives, employee-owned, B Corps, community-owned.'
	},
	{
		id: 'extraction_sale_leaseback',
		value: 'extraction',
		label: 'Sale-leaseback',
		short: 'Real estate strip',
		description:
			'Sale-leaseback deals that strip real estate and saddle operators with above-market rents.'
	},
	{
		id: 'extraction_debt_loading',
		value: 'extraction',
		label: 'Debt loading',
		short: 'LBO debt burden',
		description:
			'LBOs that transfer the acquisition debt onto the target company balance sheet, often preceding bankruptcy.'
	},

	// ─── elite impunity ───────────────────────────────────────────
	{
		id: 'elite_impunity_general',
		value: 'elite_impunity',
		label: 'Elite impunity (general)',
		short: 'Networked abuse',
		description: 'Catch-all for billionaire-class impunity not yet split into a specific quest.'
	},
	{
		id: 'elite_impunity_epstein_network',
		value: 'elite_impunity',
		label: 'Epstein network',
		short: 'Epstein-connected owners',
		description: 'Documented ties to the Jeffrey Epstein social/financial network.'
	},
	{
		id: 'elite_impunity_positive',
		value: 'elite_impunity',
		label: 'Accountability-positive',
		short: 'Transparent governance',
		description:
			'Companies with radical transparency, accountable governance, and leaders who use wealth for systemic accountability rather than impunity.'
	}
] as const;

export const QUEST_BY_ID: Record<QuestId, QuestDef> = Object.fromEntries(
	QUESTS.map((q) => [q.id, q])
) as Record<QuestId, QuestDef>;

export function questValue(id: QuestId): ValueId {
	return QUEST_BY_ID[id].value;
}

export function questsForValue(value: ValueId): QuestDef[] {
	return QUESTS.filter((q) => q.value === value);
}

export const QUEST_IDS: readonly QuestId[] = QUESTS.map((q) => q.id);
