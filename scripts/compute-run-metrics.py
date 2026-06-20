#!/usr/bin/env python3
"""
Ground-truth metric computation for a single Starbird Runner run.

Given a snapshot of static/data.json taken BEFORE the run and the current
state of static/data.json AFTER the run, diff them and emit the observed
metrics as a JSON object on stdout. Also appends the result to
tmp/runner-metrics-history.jsonl so the next call to update-strategy-scores.py
sees it.

We compute the metrics from the diff rather than trusting Claude's
self-report. This is the whole point of the deterministic refactor:
the agent writes observations (what it claims it did), the launcher
writes facts (what the data file actually shows).

Usage:
    python3 scripts/compute-run-metrics.py \\
        --before tmp/data-before.json \\
        --strategy strategy_id \\
        --mode daily \\
        --tokens 45000 \\
        --cost-usd 0.18
"""
import argparse
import json
import pathlib
import sys
from datetime import datetime, timezone

REPO = pathlib.Path(__file__).resolve().parent.parent
DATA_FILE = REPO / "static" / "data.json"
HISTORY_FILE = REPO / "tmp" / "runner-metrics-history.jsonl"


def load(path: pathlib.Path) -> dict:
    return json.loads(path.read_text())


def compute(before: dict, after: dict) -> dict:
    before_firm_ids = {f["id"] for f in before.get("firms", [])}
    after_firm_ids = {f["id"] for f in after.get("firms", [])}
    before_brand_ids = {b["id"] for b in before.get("brands", [])}
    after_brand_ids = {b["id"] for b in after.get("brands", [])}

    new_firm_ids = after_firm_ids - before_firm_ids
    new_brand_ids = after_brand_ids - before_brand_ids

    # Refreshed = existed before, body changed
    before_firms = {f["id"]: f for f in before.get("firms", [])}
    after_firms = {f["id"]: f for f in after.get("firms", [])}
    refreshed_firm_ids = {
        fid
        for fid in (before_firm_ids & after_firm_ids)
        if before_firms[fid] != after_firms[fid]
    }
    before_brands = {b["id"]: b for b in before.get("brands", [])}
    after_brands = {b["id"]: b for b in after.get("brands", [])}
    refreshed_brand_ids = {
        bid
        for bid in (before_brand_ids & after_brand_ids)
        if before_brands[bid] != after_brands[bid]
    }

    # Evidence coverage: every new firm needs a source URL, every new brand
    # needs at least one non-empty `why`. Fraction of new entities that have it.
    covered = 0
    total = 0
    for fid in new_firm_ids:
        total += 1
        if after_firms[fid].get("source", "").startswith("http"):
            covered += 1
    for bid in new_brand_ids:
        total += 1
        if after_brands[bid].get("why", "").strip():
            covered += 1
    evidence_coverage = (covered / total) if total > 0 else 0.0

    # Graph connectivity: fraction of new brands whose ownership resolves to
    # a firm that existed BEFORE this run (rewards extending the graph vs
    # dropping orphans).
    connected = 0
    considered = 0
    for bid in new_brand_ids:
        brand = after_brands[bid]
        ownership = brand.get("ownership", [])
        if not ownership:
            continue
        considered += 1
        if any(o.get("firmId") in before_firm_ids for o in ownership):
            connected += 1
    graph_connectivity = (connected / considered) if considered > 0 else 0.0

    # Tag -> evidence linkage: among new/refreshed entities that carry a
    # structured evidence[] array, the fraction of their harm/align tags that
    # have a matching evidence.tag. Makes the "tags need evidence" rule
    # measurable per-tag (not just "why is non-empty"). Entities without an
    # evidence[] array yet are excluded so legacy records don't skew it.
    linked = 0
    tag_total = 0
    touched = [
        (after_firms[i] for i in (new_firm_ids | refreshed_firm_ids)),
        (after_brands[i] for i in (new_brand_ids | refreshed_brand_ids)),
    ]
    for group in touched:
        for ent in group:
            ev = ent.get("evidence")
            if not isinstance(ev, list):
                continue
            ev_tags = {e.get("tag") for e in ev}
            for tag in list(ent.get("harms", [])) + list(ent.get("aligns", [])):
                tag_total += 1
                if tag in ev_tags:
                    linked += 1
    tag_evidence_linkage = (linked / tag_total) if tag_total > 0 else 1.0

    return {
        "new_firms": len(new_firm_ids),
        "new_brands": len(new_brand_ids),
        "new_entities": len(new_firm_ids) + len(new_brand_ids),
        "refreshed_firms": len(refreshed_firm_ids),
        "refreshed_brands": len(refreshed_brand_ids),
        "evidence_coverage": round(evidence_coverage, 4),
        "tag_evidence_linkage": round(tag_evidence_linkage, 4),
        "graph_connectivity": round(graph_connectivity, 4),
        "new_firm_ids": sorted(new_firm_ids),
        "new_brand_ids": sorted(new_brand_ids),
    }


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--before", required=True, type=pathlib.Path)
    ap.add_argument("--strategy", required=True)
    ap.add_argument("--mode", required=True)
    ap.add_argument("--tokens", type=int, default=0)
    ap.add_argument("--cost-usd", type=float, default=0.0)
    args = ap.parse_args()

    before = load(args.before)
    after = load(DATA_FILE)
    metrics = compute(before, after)

    record = {
        "timestamp": datetime.now(timezone.utc).strftime("%Y-%m-%dT%H:%M:%SZ"),
        "strategy_id": args.strategy,
        "mode": args.mode,
        "tokens_spent": args.tokens,
        "cost_usd": args.cost_usd,
        **metrics,
    }

    HISTORY_FILE.parent.mkdir(parents=True, exist_ok=True)
    with HISTORY_FILE.open("a") as f:
        f.write(json.dumps(record) + "\n")

    print(json.dumps(record, indent=2))


if __name__ == "__main__":
    main()
