#!/usr/bin/env python3
"""
One-shot migration from the old data.json shape to the hardened v2 schema.

Run from repo root: `python3 scripts/migrate-schema.py`
Reads:  static/data.json  (expects v1 shape — no version field, old brand.owner string, ValueId tags)
Writes: static/data.json  (v2 shape — IDs, Ownership[], QuestId tags)

This is idempotent to a point: if the file is already v2, it aborts.
Kept in-repo for reproducibility and so Guardian can re-run the check.
"""
import json
import pathlib
import re
import sys

REPO = pathlib.Path(__file__).resolve().parent.parent
DATA = REPO / "static" / "data.json"


def slugify(s: str, *, drop_after_slash: bool = False) -> str:
    s = s.lower().strip()
    # Strip parenthetical qualifiers like "(partial)", "(former)"
    s = re.sub(r"\([^)]*\)", "", s)
    if drop_after_slash:
        # For brand display names like "Albertsons / Safeway" keep first
        s = re.sub(r"\s*/.*", "", s)
    s = re.sub(r"&", " and ", s)
    s = re.sub(r"['’`]", "", s)
    s = re.sub(r"[^a-z0-9]+", "_", s)
    s = re.sub(r"_+", "_", s).strip("_")
    return s


# Mapping old ValueId harm tags → new QuestId tags.
# "_general" quests are the catch-all for untriaged data.
VALUE_TO_GENERAL_QUEST = {
    "workers": "workers_general",
    "environment": "environment_general",
    "animals": "animals_general",
    "health": "health_general",
    "extraction": "extraction_general",
    "elite_impunity": "elite_impunity_general",
}


def value_ids_to_quest_ids(values):
    return [VALUE_TO_GENERAL_QUEST[v] for v in values if v in VALUE_TO_GENERAL_QUEST]


# Parse brand.owner free-text into Ownership[] records.
# Examples seen in v1 data:
#   "Blackstone (Jan 2025)"
#   "Apollo Global Management (2021, $5B LBO)"
#   "JAB Holding Company (since 2017)"
#   "BC Partners + Apollo minority (2015/2023)"
#   "Leonard Green — bankrupt Dec 2024"
#   "Golden Gate Capital (former) — bankrupt 2024"
#   "BDT & MSD Partners (since 2019)"
def parse_ownership(owner_text: str, firm_id_map: dict) -> list:
    """
    Best-effort parser. Matches firm names by longest-prefix inside owner_text
    against known firm ids. Detects stake keywords. Extracts year where visible.
    If we can't match any known firm, returns an "unknown_firm" record and we
    patch it by hand in the migration. Exits non-zero on unresolved entries.
    """
    text = owner_text.strip()
    out = []

    # Add aliases so short forms in owner strings still resolve.
    # "JAB Holding" should resolve to JAB Holding Company, etc.
    ALIASES = {
        "JAB Holding": "jab_holding_company",
        "Leonard Green": "leonard_green_and_partners",
        "Hellman & Friedman": "hellman_and_friedman_permira",
        "Permira": "hellman_and_friedman_permira",
    }
    aliased_map = dict(firm_id_map)
    for alias, fid in ALIASES.items():
        if fid in firm_id_map.values():
            aliased_map[alias] = fid
    firm_id_map = aliased_map

    # Build longest-first list so "Leonard Green & Partners" matches before "Leonard Green"
    firm_entries = sorted(firm_id_map.items(), key=lambda kv: -len(kv[0]))

    # Heuristic: find each firm name mentioned, determine stake by surrounding text
    matched_ranges = []
    for firm_name, firm_id in firm_entries:
        for m in re.finditer(re.escape(firm_name), text, flags=re.IGNORECASE):
            start, end = m.span()
            # Skip if overlaps a prior match
            if any(not (end <= s or start >= e) for s, e in matched_ranges):
                continue
            matched_ranges.append((start, end))

            # Determine stake from surrounding window
            window = text[max(0, start - 20):min(len(text), end + 60)].lower()
            if "former" in window or "bankrupt" in window and "post" not in window:
                stake = "former"
            elif "post-bankrupt" in window or "post bankrupt" in window:
                stake = "post_bankrupt"
            elif "minority" in window:
                stake = "minority"
            else:
                stake = "majority"

            # Extract year(s) — first 4-digit year in the window
            year_m = re.search(r"\b(19|20)\d{2}\b", window)
            since = year_m.group(0) if year_m else None

            out.append(
                {"firmId": firm_id, "stake": stake, **({"since": since} if since else {})}
            )

    if not out:
        # Unresolved — return empty so the caller can decide whether to inject unknown_pe
        return []

    # Dedupe by firmId (aliases can match twice for the same underlying firm)
    seen = set()
    deduped = []
    for o in out:
        if o["firmId"] in seen:
            continue
        seen.add(o["firmId"])
        deduped.append(o)
    return deduped


def main():
    raw = json.loads(DATA.read_text())
    if raw.get("version"):
        print(f"data.json already v{raw['version']}, aborting", file=sys.stderr)
        sys.exit(1)

    # Build firm id map
    firm_name_to_id = {}
    firms_out = []
    for f in raw["firms"]:
        fid = slugify(f["name"])
        if fid in {x["id"] for x in firms_out}:
            raise SystemExit(f"slug collision on firm: {f['name']} → {fid}")
        firm_name_to_id[f["name"]] = fid
        firms_out.append(
            {
                "id": fid,
                "name": f["name"],
                "aum": f["aum"],
                "aumVal": f["aumVal"],
                "summary": f["summary"],
                "brands": f["brands"],
                "layoffs": f["layoffs"],
                "notableBk": f["notableBk"],
                "harmScore": f["harmScore"],
                "source": f["source"],
                "cats": f["cats"],
                "harms": value_ids_to_quest_ids(f.get("harms", [])),
                "aligns": value_ids_to_quest_ids(f.get("aligns", [])),
            }
        )

    # Inject known firms that appear in brand owner text but aren't in firms[]
    # (v1 mentioned Aurelius, Golden Gate, Elliott Management in brand owners)
    implicit_firms = {
        "unknown_pe": {
            "id": "unknown_pe",
            "name": "Unknown PE owner",
            "aum": "N/A",
            "aumVal": 0,
            "summary": "Placeholder for brands whose specific PE owner is not yet tracked. The research loop should replace these with specific firm records as they are identified.",
            "brands": [],
            "layoffs": "N/A",
            "notableBk": "N/A",
            "harmScore": 50,
            "source": "https://pestakeholder.org/private-equity-bankruptcy/",
            "cats": [],
            "harms": ["extraction_general"],
            "aligns": [],
        },
        "aurelius_group": {
            "id": "aurelius_group",
            "name": "Aurelius Group",
            "aum": "Private",
            "aumVal": 5,
            "summary": "German PE group. Acquired The Body Shop in 2023, drove it to bankruptcy in 2024 after closing all US stores.",
            "brands": ["The Body Shop (bankrupt 2024)"],
            "layoffs": "Mass closures",
            "notableBk": "The Body Shop (2024)",
            "harmScore": 70,
            "source": "https://en.wikipedia.org/wiki/The_Body_Shop",
            "cats": ["health"],
            "harms": ["workers_general", "extraction_general"],
            "aligns": [],
        },
        "golden_gate_capital": {
            "id": "golden_gate_capital",
            "name": "Golden Gate Capital",
            "aum": "$19B",
            "aumVal": 19,
            "summary": "Former owner of Red Lobster. Engineered sale-leaseback that stripped real estate and pushed rents above market, directly contributing to Red Lobster's 2024 bankruptcy.",
            "brands": ["Red Lobster (former, bankrupt 2024)"],
            "layoffs": "36,000 affected (Red Lobster 2024)",
            "notableBk": "Red Lobster (2024)",
            "harmScore": 84,
            "source": "https://www.cnbc.com/2025/02/25/red-lobster-tgi-fridays-bankruptcies-private-equity.html",
            "cats": ["food"],
            "harms": ["workers_general", "extraction_general", "extraction_sale_leaseback"],
            "aligns": [],
        },
    }
    for k, v in implicit_firms.items():
        if k not in {f["id"] for f in firms_out}:
            firms_out.append(v)
            firm_name_to_id[v["name"]] = k

    # Tag workers_ice_cooperation on any firm whose summary mentions ICE (none in seed data).
    # The runner will populate this quest going forward.

    # Transform brands
    brands_out = []
    unresolved = []
    for b in raw["brands"]:
        bid = slugify(b["avoid"], drop_after_slash=True)
        ownership = parse_ownership(b["owner"], firm_name_to_id)
        if not ownership:
            # Fall back to the unknown_pe catch-all so the record stays valid.
            # Research loop will replace with a specific firm later.
            stake = "former" if "bankrupt" in b["owner"].lower() or "former" in b["owner"].lower() else "majority"
            year_m = re.search(r"\b(19|20)\d{2}\b", b["owner"])
            entry = {"firmId": "unknown_pe", "stake": stake}
            if year_m:
                entry["since"] = year_m.group(0)
            ownership = [entry]
        # map harms
        harms = value_ids_to_quest_ids(b.get("harms", []))
        aligns = value_ids_to_quest_ids(b.get("aligns", []))
        brands_out.append(
            {
                "id": bid,
                "avoid": b["avoid"],
                "ownership": ownership,
                "cat": b["cat"],
                "alts": b["alts"],
                "why": b["why"],
                "harms": harms,
                "aligns": aligns,
            }
        )

    if unresolved:
        print("UNRESOLVED OWNERS (need hand-patch before migration):", file=sys.stderr)
        for name, owner in unresolved:
            print(f"  {name}: {owner}", file=sys.stderr)
        sys.exit(2)

    out = {"version": 2, "firms": firms_out, "brands": brands_out}
    DATA.write_text(json.dumps(out, indent=2) + "\n")
    print(f"migrated: {len(firms_out)} firms, {len(brands_out)} brands → v2")


if __name__ == "__main__":
    main()
