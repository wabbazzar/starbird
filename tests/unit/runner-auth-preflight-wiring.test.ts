import { describe, it, expect } from 'vitest';
import { readFileSync } from 'fs';
import { resolve } from 'path';

// Guard: the runner must pre-flight claude auth BEFORE the paid retry loop,
// emit a distinct job.end reason, and page via the shared notify path.
describe('starbird-runner.sh auth pre-flight wiring', () => {
	const source = readFileSync(resolve(process.cwd(), 'scripts/starbird-runner.sh'), 'utf-8');

	it('calls the preflight before the claude retry loop', () => {
		const pre = source.indexOf('claude_preflight_auth');
		const loop = source.indexOf('while [ "$RETRY"');
		expect(pre).toBeGreaterThan(-1);
		expect(loop).toBeGreaterThan(-1);
		expect(pre).toBeLessThan(loop);
	});

	it('emits a distinct auth_expired job.end reason', () => {
		expect(source).toMatch(/reason="auth_expired"/);
	});

	it('pages via QUARTET_NOTIFY_CMD', () => {
		expect(source).toMatch(/QUARTET_NOTIFY_CMD:-\$NOTIFY/);
	});
});
