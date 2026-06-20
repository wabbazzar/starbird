#!/usr/bin/env python3
"""Merge backfilled evidence (tmp/backfill/out-*.json) into static/data.json.

Deterministic + defensive: the agents proposed evidence, but THIS script is the
authority that writes the file. It drops any evidence entry whose tag isn't
actually on the entity, validates amountKind, and reports per-tag linkage so we
know coverage before the dq-check gate runs.
"""
import json
import glob
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
DATA = ROOT / "static" / "data.json"
VALID_KINDS = {"fine", "settlement", "debt", "fees", "revenue", "deal", "donation"}


def clean_entry(e, allowed_tags):
    tag = e.get("tag")
    text = (e.get("text") or "").strip()
    if tag not in allowed_tags or not text:
        return None
    out = {"tag": tag, "text": text}
    if e.get("date"):
        out["date"] = str(e["date"])
    amt = e.get("amountUsd")
    kind = e.get("amountKind")
    if isinstance(amt, (int, float)) and amt >= 0 and kind in VALID_KINDS:
        out["amountUsd"] = amt
        out["amountKind"] = kind
    # else drop amount entirely — never keep an amount without a valid kind
    if e.get("actor"):
        out["actor"] = str(e["actor"])
    src = e.get("sourceUrl")
    if isinstance(src, str) and src.startswith("http"):
        out["sourceUrl"] = src
    return out


def main():
    data = json.loads(DATA.read_text())
    proposed = {}
    for path in sorted(glob.glob(str(ROOT / "tmp" / "backfill" / "out-*.json"))):
        try:
            for rec in json.loads(Path(path).read_text()):
                proposed[rec["id"]] = rec.get("evidence", [])
        except Exception as ex:  # noqa
            print(f"WARN: bad out file {path}: {ex}", file=sys.stderr)

    attached = 0
    missing_entities = []
    linkage_gaps = []  # (id, tag) tags with no evidence entry
    total_tags = 0
    linked_tags = 0

    def apply(entities, kind):
        nonlocal attached, total_tags, linked_tags
        for ent in entities:
            allowed = set(ent.get("harms", [])) | set(ent.get("aligns", []))
            raw = proposed.get(ent["id"])
            if raw is None:
                missing_entities.append((kind, ent["id"]))
                continue
            cleaned = [c for c in (clean_entry(e, allowed) for e in raw) if c]
            if cleaned:
                ent["evidence"] = cleaned
                attached += 1
            ev_tags = {c["tag"] for c in cleaned}
            for t in allowed:
                total_tags += 1
                if t in ev_tags:
                    linked_tags += 1
                else:
                    linkage_gaps.append((ent["id"], t))

    apply(data["firms"], "firm")
    apply(data["brands"], "brand")

    DATA.write_text(json.dumps(data, ensure_ascii=False, indent=2) + "\n")

    pct = (linked_tags / total_tags * 100) if total_tags else 100.0
    print(f"attached evidence to {attached} entities")
    print(f"tag->evidence linkage: {linked_tags}/{total_tags} = {pct:.1f}%")
    if missing_entities:
        print(f"entities with NO backfill output: {len(missing_entities)}")
        for k, i in missing_entities[:20]:
            print(f"  - {k}:{i}")
    if linkage_gaps:
        print(f"tags missing evidence: {len(linkage_gaps)}")
        for i, t in linkage_gaps[:30]:
            print(f"  - {i} :: {t}")


if __name__ == "__main__":
    main()
