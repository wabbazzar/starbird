export type ValueId =
	| 'workers'
	| 'environment'
	| 'animals'
	| 'health'
	| 'extraction'
	| 'elite_impunity';

export interface ValueDef {
	id: ValueId;
	label: string;
	short: string;
	description: string;
	icon: string;
}

export const VALUES: readonly ValueDef[] = [
	{
		id: 'workers',
		label: 'Workers',
		short: 'Labor conditions',
		description:
			'Fair pay, safe conditions, union rights, no mass layoffs used as a financial lever.',
		icon: '◆'
	},
	{
		id: 'environment',
		label: 'Environment',
		short: 'Climate & planet',
		description: 'Emissions, sourcing, waste, and pressure on ecosystems.',
		icon: '◇'
	},
	{
		id: 'animals',
		label: 'Animals',
		short: 'Welfare & cruelty-free',
		description: 'Factory farming, testing, and treatment of animals in supply chains.',
		icon: '○'
	},
	{
		id: 'health',
		label: 'Health',
		short: 'What it does to you',
		description: 'Ingredient quality, additives, and long-term effects on the people who use it.',
		icon: '△'
	},
	{
		id: 'extraction',
		label: 'Extraction',
		short: 'Predatory capital',
		description:
			'Private-equity and debt-driven ownership that strips value from companies, workers, and communities.',
		icon: '▣'
	},
	{
		id: 'elite_impunity',
		label: 'Elite impunity',
		short: 'Epstein-class networks',
		description:
			'Ties to the billionaire / political-donor network that escapes consequences for serious abuse.',
		icon: '▲'
	}
] as const;

export const VALUE_BY_ID: Record<ValueId, ValueDef> = Object.fromEntries(
	VALUES.map((v) => [v.id, v])
) as Record<ValueId, ValueDef>;

export function valueLabel(id: ValueId): string {
	return VALUE_BY_ID[id]?.label ?? id;
}
