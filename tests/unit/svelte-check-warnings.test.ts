import { describe, it, expect } from 'vitest';
import { readFileSync } from 'fs';
import { resolve } from 'path';

describe('svelte-check warning suppressions', () => {
	const brandCard = readFileSync(
		resolve(process.cwd(), 'src/lib/components/BrandCard.svelte'),
		'utf-8'
	);
	const firmCard = readFileSync(
		resolve(process.cwd(), 'src/lib/components/FirmCard.svelte'),
		'utf-8'
	);
	const cardPage = readFileSync(
		resolve(process.cwd(), 'src/routes/card/[id]/+page.svelte'),
		'utf-8'
	);

	it('BrandCard suppresses a11y_no_noninteractive_element_interactions', () => {
		expect(brandCard).toContain('svelte-ignore a11y_no_noninteractive_element_interactions');
	});

	it('FirmCard suppresses a11y_no_noninteractive_element_interactions', () => {
		expect(firmCard).toContain('svelte-ignore a11y_no_noninteractive_element_interactions');
	});

	it('card/[id] page uses $derived for data-derived constants', () => {
		expect(cardPage).toMatch(/const ogImage = \$derived\(/);
		expect(cardPage).toMatch(/const cardUrl = \$derived\(/);
		expect(cardPage).toMatch(/const appUrl = \$derived\(/);
	});
});
