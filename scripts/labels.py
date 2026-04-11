#!/usr/bin/env python3
"""
Human-readable labels for Starbird IDs used in Signal notifications and logs.

Two maps here, both deliberately kept in parallel with their TypeScript homes
in src/lib/ so the bash launcher can print readable names without spawning
node or tsx. The Guardian checklist has a line telling us to keep these in
sync when quests or strategies are added.

Sources of truth:
  STRATEGY_LABELS  ← scripts/update-strategy-scores.py (STRATEGIES list)
  QUEST_LABELS     ← src/lib/quests.ts              (QUESTS array)

If this file drifts, human-readable output falls back to the raw ID with
underscores replaced by spaces, so nothing breaks — just gets uglier.
"""

STRATEGY_LABELS = {
    "mijente_no_tech_for_ice": {
        "label": "Mijente No Tech for ICE tracker",
        "description": "Named-company extraction from the Mijente campaign's tracker pages, cross-verified with a second source.",
        "primary_source": "https://notechforice.com/",
    },
    "usaspending_ice_contracts": {
        "label": "USASpending.gov ICE contracts",
        "description": "Top contracts awarded by ICE/DHS, vendors extracted and cross-referenced against existing firms and brands.",
        "primary_source": "https://www.usaspending.gov/",
    },
    "ice_foia_library": {
        "label": "ICE FOIA reading room",
        "description": "Recently released FOIA documents parsed for vendor/contractor company names.",
        "primary_source": "https://www.ice.gov/foia/library",
    },
    "adjacent_source_discovery": {
        "label": "Adjacent-source discovery (meta)",
        "description": "Finds *new* data sources via GitHub awesome-lists, academic citations, and investigative journalism. Meta-strategy — expands the bank itself.",
        "primary_source": "(various)",
    },
}

QUEST_LABELS = {
    "workers_general": "Workers — general",
    "workers_ice_cooperation": "Workers — ICE cooperation",
    "workers_mass_layoffs": "Workers — mass layoffs",
    "environment_general": "Environment — general",
    "animals_general": "Animals — general",
    "health_general": "Health — general",
    "extraction_general": "Extraction — general",
    "extraction_sale_leaseback": "Extraction — sale-leaseback",
    "extraction_debt_loading": "Extraction — debt loading",
    "elite_impunity_general": "Elite impunity — general",
    "elite_impunity_epstein_network": "Elite impunity — Epstein network",
}


def strategy_label(sid: str) -> str:
    return STRATEGY_LABELS.get(sid, {}).get("label", sid.replace("_", " "))


def strategy_description(sid: str) -> str:
    return STRATEGY_LABELS.get(sid, {}).get("description", "")


def strategy_source(sid: str) -> str:
    return STRATEGY_LABELS.get(sid, {}).get("primary_source", "")


def quest_label(qid: str) -> str:
    return QUEST_LABELS.get(qid, qid.replace("_", " "))


if __name__ == "__main__":
    # CLI usage from bash:
    #   python3 scripts/labels.py strategy mijente_no_tech_for_ice
    #   python3 scripts/labels.py quest workers_ice_cooperation
    #   python3 scripts/labels.py strategy-desc mijente_no_tech_for_ice
    import sys

    if len(sys.argv) < 3:
        sys.exit("usage: labels.py {strategy|strategy-desc|quest} <id>")
    kind, ident = sys.argv[1], sys.argv[2]
    if kind == "strategy":
        print(strategy_label(ident))
    elif kind == "strategy-desc":
        print(strategy_description(ident))
    elif kind == "quest":
        print(quest_label(ident))
    else:
        sys.exit(f"unknown kind: {kind}")
