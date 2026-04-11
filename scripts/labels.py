#!/usr/bin/env python3
"""
Human-readable labels for Starbird IDs used in Signal notifications and logs.

Three sources of truth kept in parallel:
  STRATEGY_LABELS  ← scripts/update-strategy-scores.py (STRATEGIES list)
  QUEST_LABELS     ← src/lib/quests.ts                 (QUESTS array)
  VALUE_LABELS     ← src/lib/values.ts                 (VALUES array)

If this file drifts, human-readable output falls back to the raw ID with
underscores replaced by spaces, so nothing breaks — just gets uglier.
"""

STRATEGY_LABELS = {
    # ── workers ──────────────────────────────────────────────────────
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
    "adjacent_source_discovery_workers": {
        "label": "Adjacent-source discovery (workers)",
        "description": "Meta-strategy: finds new workers/labor data sources via GitHub awesome-lists, academic citations, and investigative journalism.",
        "primary_source": "(various)",
    },
    # ── environment ──────────────────────────────────────────────────
    "epa_tri_toxics_release": {
        "label": "EPA Toxics Release Inventory",
        "description": "Top-polluting facilities from the EPA's TRI database, mapped back to parent companies and consumer-facing brands.",
        "primary_source": "https://www.epa.gov/toxics-release-inventory-tri-program",
    },
    "climate_trace_emissions": {
        "label": "Climate TRACE emissions data",
        "description": "Satellite-verified emissions from the Climate TRACE coalition, ranked by tons CO2-equivalent and mapped to parent companies.",
        "primary_source": "https://climatetrace.org/",
    },
    "ewg_consumer_scores": {
        "label": "EWG consumer product scores",
        "description": "Environmental Working Group's Consumer Guides — personal care, cleaning products, sunscreens — for low-scoring brands and their parent firms.",
        "primary_source": "https://www.ewg.org/consumer-guides",
    },
    "adjacent_source_discovery_environment": {
        "label": "Adjacent-source discovery (environment)",
        "description": "Meta-strategy: finds new environment data sources via academic papers, NGO trackers, and investigative reporting.",
        "primary_source": "(various)",
    },
    # ── animals ──────────────────────────────────────────────────────
    "cruelty_free_international_db": {
        "label": "Cruelty Free International database",
        "description": "Companies and parent conglomerates that continue to test on animals or source animal-tested ingredients.",
        "primary_source": "https://crueltyfreeinternational.org/",
    },
    "peta_cruelty_list": {
        "label": "PETA companies-that-test list",
        "description": "PETA's published list of companies that test on animals, including brand-parent mappings.",
        "primary_source": "https://www.peta.org/living/beauty/companies-test-animals/",
    },
    "mercy_for_animals_investigations": {
        "label": "Mercy For Animals investigations",
        "description": "Factory farming exposés — processor, supplier, and retail brand names extracted from published investigations.",
        "primary_source": "https://mercyforanimals.org/investigations/",
    },
    "adjacent_source_discovery_animals": {
        "label": "Adjacent-source discovery (animals)",
        "description": "Meta-strategy: finds new animal welfare data sources via academic papers, NGO trackers, and undercover investigations.",
        "primary_source": "(various)",
    },
    # ── health ───────────────────────────────────────────────────────
    "ewg_food_scores": {
        "label": "EWG Food Scores",
        "description": "EWG's Food Scores database — products rated on nutrition, ingredients, and processing — mapped to parent brands and firms.",
        "primary_source": "https://www.ewg.org/foodscores/",
    },
    "ultraprocessed_nova_tracker": {
        "label": "Ultra-processed (NOVA 4) product tracker",
        "description": "Products classified as NOVA group 4 (ultra-processed), primarily snack/beverage brands owned by the big-10 food conglomerates.",
        "primary_source": "https://www.ncbi.nlm.nih.gov/pmc/articles/PMC6322572/",
    },
    "cspi_additive_tracker": {
        "label": "CSPI Chemical Cuisine",
        "description": "Center for Science in the Public Interest's additive safety ratings — 'avoid' and 'certain people should avoid' categories, mapped to containing brands.",
        "primary_source": "https://www.cspinet.org/chemical-cuisine",
    },
    "adjacent_source_discovery_health": {
        "label": "Adjacent-source discovery (health)",
        "description": "Meta-strategy: finds new health / consumer-safety data sources via research papers, FDA databases, and watchdog reports.",
        "primary_source": "(various)",
    },
    # ── extraction (PE / asset-stripping) ────────────────────────────
    "pesp_bankruptcy_tracker": {
        "label": "PESP Private Equity bankruptcy tracker",
        "description": "Private Equity Stakeholder Project's running list of PE-owned companies that filed for bankruptcy, with links to parent firms.",
        "primary_source": "https://pestakeholder.org/private-equity-bankruptcy/",
    },
    "sec_lbo_filings": {
        "label": "SEC LBO filings (10-K / Form D)",
        "description": "Recent leveraged-buyout filings with the SEC, extracting acquirer and target names.",
        "primary_source": "https://www.sec.gov/edgar/search-and-access",
    },
    "nyt_dealbook_archive": {
        "label": "NYT DealBook archive",
        "description": "New York Times DealBook coverage of PE acquisitions, sale-leasebacks, and dividend recaps.",
        "primary_source": "https://www.nytimes.com/section/business/dealbook",
    },
    "adjacent_source_discovery_extraction": {
        "label": "Adjacent-source discovery (extraction)",
        "description": "Meta-strategy: finds new PE / extraction data sources via watchdog NGOs, academic papers, and financial journalism.",
        "primary_source": "(various)",
    },
    # ── elite impunity (Epstein network, oligarch ties) ──────────────
    "epstein_flight_logs": {
        "label": "Epstein flight logs & court filings",
        "description": "Documented associates from the unsealed Epstein court documents — individuals and the companies/institutions they own or run.",
        "primary_source": "https://www.documentcloud.org/documents/24380582-epstein-documents",
    },
    "littlesis_power_network": {
        "label": "LittleSis oligarch-network database",
        "description": "LittleSis's mapped relationships between billionaires, corporations, and political donors — used to identify companies owned by elite-impunity figures.",
        "primary_source": "https://littlesis.org/",
    },
    "icij_panama_pandora_papers": {
        "label": "ICIJ Panama + Pandora Papers",
        "description": "International Consortium of Investigative Journalists leaks — beneficial ownership records linking shell companies to named oligarchs and politicians.",
        "primary_source": "https://offshoreleaks.icij.org/",
    },
    "adjacent_source_discovery_elite_impunity": {
        "label": "Adjacent-source discovery (elite impunity)",
        "description": "Meta-strategy: finds new data sources for elite-impunity networks via investigative journalism and academic research.",
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

VALUE_LABELS = {
    "workers": "Workers",
    "environment": "Environment",
    "animals": "Animals",
    "health": "Health",
    "extraction": "Extraction",
    "elite_impunity": "Elite impunity",
}


def strategy_label(sid: str) -> str:
    return STRATEGY_LABELS.get(sid, {}).get("label", sid.replace("_", " "))


def strategy_description(sid: str) -> str:
    return STRATEGY_LABELS.get(sid, {}).get("description", "")


def strategy_source(sid: str) -> str:
    return STRATEGY_LABELS.get(sid, {}).get("primary_source", "")


def quest_label(qid: str) -> str:
    return QUEST_LABELS.get(qid, qid.replace("_", " "))


def value_label(vid: str) -> str:
    return VALUE_LABELS.get(vid, vid.replace("_", " "))


def strategy_value(sid: str) -> str:
    """Infer the parent value of a strategy by reading update-strategy-scores.py."""
    # Minimal hardcoded mirror to avoid importing the other script.
    for s, v in [
        ("mijente_no_tech_for_ice", "workers"),
        ("usaspending_ice_contracts", "workers"),
        ("ice_foia_library", "workers"),
        ("adjacent_source_discovery_workers", "workers"),
        ("epa_tri_toxics_release", "environment"),
        ("climate_trace_emissions", "environment"),
        ("ewg_consumer_scores", "environment"),
        ("adjacent_source_discovery_environment", "environment"),
        ("cruelty_free_international_db", "animals"),
        ("peta_cruelty_list", "animals"),
        ("mercy_for_animals_investigations", "animals"),
        ("adjacent_source_discovery_animals", "animals"),
        ("ewg_food_scores", "health"),
        ("ultraprocessed_nova_tracker", "health"),
        ("cspi_additive_tracker", "health"),
        ("adjacent_source_discovery_health", "health"),
        ("pesp_bankruptcy_tracker", "extraction"),
        ("sec_lbo_filings", "extraction"),
        ("nyt_dealbook_archive", "extraction"),
        ("adjacent_source_discovery_extraction", "extraction"),
        ("epstein_flight_logs", "elite_impunity"),
        ("littlesis_power_network", "elite_impunity"),
        ("icij_panama_pandora_papers", "elite_impunity"),
        ("adjacent_source_discovery_elite_impunity", "elite_impunity"),
    ]:
        if s == sid:
            return v
    return "unknown"


if __name__ == "__main__":
    import sys

    if len(sys.argv) < 3:
        sys.exit(
            "usage: labels.py {strategy|strategy-desc|strategy-value|quest|value} <id>"
        )
    kind, ident = sys.argv[1], sys.argv[2]
    if kind == "strategy":
        print(strategy_label(ident))
    elif kind == "strategy-desc":
        print(strategy_description(ident))
    elif kind == "strategy-value":
        print(strategy_value(ident))
    elif kind == "quest":
        print(quest_label(ident))
    elif kind == "value":
        print(value_label(ident))
    else:
        sys.exit(f"unknown kind: {kind}")
