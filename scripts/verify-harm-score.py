#!/usr/bin/env python3
"""
Guardian check: verify the harm score rubric is internally consistent
and that every firm in static/data.json lands in exactly one defined
bucket. Run as a preflight in scripts/starbird-guardian-prompt.md.

The rubric is the single source of truth at src/lib/harm-score-rubric.json.
If the rubric and the About page drift apart, that's caught by svelte-check
via the TypeScript import in src/lib/harmScore.ts — not this script.
This script catches the other two failure modes:

  1. Gaps or overlaps in the 0–100 range (e.g. someone edits one bucket
     and forgets to update the next one's min)
  2. firm.harmScore values that don't map to any defined bucket (e.g.
     a runner produces a score of 100 but the top bucket ends at 94)

Exit 0 on success. Exit 1 on any failure with a specific error message
the Guardian can surface in its notification.
"""
import json
import pathlib
import sys

REPO = pathlib.Path(__file__).resolve().parent.parent
RUBRIC_FILE = REPO / "src" / "lib" / "harm-score-rubric.json"
DATA_FILE = REPO / "static" / "data.json"


def fail(msg: str) -> None:
    print(f"HARM SCORE RUBRIC FAIL: {msg}", file=sys.stderr)
    sys.exit(1)


def main() -> None:
    if not RUBRIC_FILE.exists():
        fail(f"rubric file missing: {RUBRIC_FILE}")
    if not DATA_FILE.exists():
        fail(f"data file missing: {DATA_FILE}")

    rubric = json.loads(RUBRIC_FILE.read_text())
    buckets = rubric.get("buckets", [])
    if not buckets:
        fail("rubric has no buckets")

    # 1. Every bucket has the required shape
    required_fields = {"min", "max", "label", "short", "description", "example"}
    for i, b in enumerate(buckets):
        missing = required_fields - set(b.keys())
        if missing:
            fail(f"bucket {i} ({b.get('label', '?')}) missing fields: {sorted(missing)}")
        if not isinstance(b["min"], int) or not isinstance(b["max"], int):
            fail(f"bucket {b['label']} has non-integer bounds")
        if b["min"] > b["max"]:
            fail(f"bucket {b['label']} has min {b['min']} > max {b['max']}")

    # 2. Buckets span exactly 0–100 with no gaps and no overlaps
    sorted_buckets = sorted(buckets, key=lambda b: b["min"])
    if sorted_buckets[0]["min"] != 0:
        fail(f"rubric does not start at 0 (starts at {sorted_buckets[0]['min']})")
    if sorted_buckets[-1]["max"] != 100:
        fail(f"rubric does not end at 100 (ends at {sorted_buckets[-1]['max']})")

    prev_max = -1
    for b in sorted_buckets:
        if b["min"] != prev_max + 1:
            fail(
                f"gap or overlap at bucket {b['label']}: "
                f"previous max was {prev_max}, this bucket starts at {b['min']}"
            )
        prev_max = b["max"]

    # 3. Every firm's harmScore maps to exactly one bucket
    data = json.loads(DATA_FILE.read_text())
    firms = data.get("firms", [])
    unmapped = []
    for f in firms:
        score = f.get("harmScore")
        if not isinstance(score, (int, float)):
            unmapped.append((f.get("id", "?"), score))
            continue
        matching = [b for b in buckets if b["min"] <= score <= b["max"]]
        if len(matching) == 0:
            unmapped.append((f.get("id", "?"), score))
        elif len(matching) > 1:
            fail(
                f"firm {f.get('id')} harmScore {score} maps to "
                f"multiple buckets: {[b['label'] for b in matching]}"
            )

    if unmapped:
        summary = ", ".join(f"{fid}={score}" for fid, score in unmapped[:5])
        extra = f" ... and {len(unmapped) - 5} more" if len(unmapped) > 5 else ""
        fail(f"{len(unmapped)} firm(s) with unmappable harmScore: {summary}{extra}")

    print(
        f"harm score rubric OK: {len(buckets)} buckets span 0-100, "
        f"{len(firms)} firms all mapped"
    )


if __name__ == "__main__":
    main()
