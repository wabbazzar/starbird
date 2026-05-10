// Pre-commit data.json gate for the runner.
// Exits 0 on success, 1 with a human-readable issue list on failure.
// Used by scripts/starbird-runner.sh between Claude's edit pass and
// `git commit`, so schema-invalid output never reaches main.
import { DataFileSchema } from '../src/lib/schema.ts';
import data from '../static/data.json' with { type: 'json' };

const result = DataFileSchema.safeParse(data);
if (result.success) {
	console.log(
		`schema OK — ${result.data.brands.length} brands, ${result.data.firms.length} firms`
	);
	process.exit(0);
}

console.error(`schema FAILED — ${result.error.issues.length} issue(s):`);
for (const issue of result.error.issues) {
	console.error(`  - ${issue.path.join('.')}: ${issue.message}`);
}
process.exit(1);
