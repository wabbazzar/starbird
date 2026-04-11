/**
 * Harm score rubric, imported from the JSON single source of truth.
 *
 * Do NOT inline the bucket definitions in this file. The Guardian runs
 * scripts/verify-harm-score.py against src/lib/harm-score-rubric.json
 * and will fail the build if the rubric drifts, gaps appear in the
 * 0–100 range, or any firm.harmScore in static/data.json lands outside
 * every defined bucket.
 */
import rubric from './harm-score-rubric.json';

export interface HarmBucket {
	min: number;
	max: number;
	label: string;
	short: string;
	description: string;
	example: string;
}

export interface HarmInput {
	label: string;
	detail: string;
}

export const HARM_SCORE_VERSION: number = rubric.version;
export const HARM_SCORE_DESCRIPTION: string = rubric.description;
export const HARM_SCORE_INPUTS: readonly HarmInput[] = rubric.inputs;
export const HARM_SCORE_BUCKETS: readonly HarmBucket[] = rubric.buckets;

export function bucketFor(score: number): HarmBucket | null {
	return (
		HARM_SCORE_BUCKETS.find((b) => score >= b.min && score <= b.max) ?? null
	);
}
