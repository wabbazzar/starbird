#!/usr/bin/env python3
"""
Release-battery check: verify the harm score rubric is internally consistent
and that every firm in static/data.json lands in exactly one defined
bucket. Run as a preflight by the release battery (see .agents/release.md).

The rubric is the single source of truth at src/lib/harm-score-rubric.json.
If the rubric and the About page drift apart, that's caught by svelte-check
via the TypeScript import in src/lib/harmScore.ts — not this script.
This script catches the other two failure modes:

  1. Gaps or overlaps in the 0–100 range (e.g. someone edits one bucket
     and forgets to update the next one's min)
  2. firm.harmScore values that don't map to any defined bucket (e.g.
     a runner produces a score of 100 but the top bucket ends at 94)
  3. (rubric v2) firms missing `scope`/`role`, or carrying a harmScore
     outside the [floor, cap] band their scope allows. This is the gate
     that stops the two failure modes the v2 recalibration fixed: a
     single-contract vendor scoring 83, and scores drifting upward with
     each research cohort. Bounds come from rubric["scopes"], which
     mirrors SCOPE_CAP / SCOPE_FLOOR in src/lib/ranking.ts.

Exit 0 on success. Exit 1 on any failure with a specific error message
the release battery can surface in its notification.
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

    # 4. (v2) Scope bounds. Skipped entirely on a v1 rubric so this script
    #    still runs against an older checkout.
    scopes = {s["id"]: s for s in rubric.get("scopes", [])}
    if scopes:
        valid_roles = {"actor", "owner", "both"}
        missing_scope = [f.get("id", "?") for f in firms if not f.get("scope")]
        missing_role = [f.get("id", "?") for f in firms if not f.get("role")]
        if missing_scope:
            fail(
                f"{len(missing_scope)} firm(s) missing `scope`: "
                f"{', '.join(missing_scope[:5])}"
            )
        if missing_role:
            fail(
                f"{len(missing_role)} firm(s) missing `role`: "
                f"{', '.join(missing_role[:5])}"
            )

        bad_enum = [
            f"{f['id']}={f.get('scope')}/{f.get('role')}"
            for f in firms
            if f["scope"] not in scopes or f["role"] not in valid_roles
        ]
        if bad_enum:
            fail(f"{len(bad_enum)} firm(s) with unknown scope/role: {', '.join(bad_enum[:5])}")

        out_of_band = []
        for f in firms:
            sc = scopes[f["scope"]]
            floor = sc.get("floor") or 0
            if not (floor <= f["harmScore"] <= sc["cap"]):
                out_of_band.append(
                    f"{f['id']}={f['harmScore']} ({f['scope']} allows {floor}-{sc['cap']})"
                )
        if out_of_band:
            summary = ", ".join(out_of_band[:5])
            extra = f" ... and {len(out_of_band) - 5} more" if len(out_of_band) > 5 else ""
            fail(f"{len(out_of_band)} firm(s) outside their scope band: {summary}{extra}")

    scope_note = f", {len(scopes)} scope bands enforced" if scopes else ""
    print(
        f"harm score rubric OK: {len(buckets)} buckets span 0-100, "
        f"{len(firms)} firms all mapped{scope_note}"
    )


if __name__ == "__main__":
    main()
