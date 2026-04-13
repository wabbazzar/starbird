#!/usr/bin/env python3
"""
Deterministic strategy scorer for Starbird Runner.

Reads:
  tmp/runner-metrics-history.jsonl  (append-only observed runs)
  static/data.json                  (current entity counts per value)

Writes:
  tmp/starbird-runner-strategy-scores.json

Claude never touches either the history or the scores. The launcher
invokes this script before and after every run. compute-run-metrics.py
writes the history from a data.json before/after diff.

Score formula (v2):
    base = sum(new_entities) / sum(cost_usd)   over last 10 runs
    value_weight = max(0, 1 - current_count / target)   per-value linear falloff
    score[strategy] = base * value_weight

When a value hits its target, every strategy under that value gets
score=0 and exploration_eligible=False, so the bandit naturally
redirects toward under-filled values. The research loop converges.

Usage:
    python3 scripts/update-strategy-scores.py
"""
import json
import pathlib
import sys

REPO = pathlib.Path(__file__).resolve().parent.parent
HISTORY_FILE = REPO / "tmp" / "runner-metrics-history.jsonl"
SCORES_FILE = REPO / "tmp" / "starbird-runner-strategy-scores.json"
DATA_FILE = REPO / "static" / "data.json"
WINDOW = 10  # number of recent runs per strategy to score over

# Target entries per value system. When a value hits this count, its
# strategies stop getting scored upward and the bandit moves on.
TARGETS_PER_VALUE = {
    "workers": 100,
    "environment": 100,
    "animals": 100,
    "health": 100,
    "extraction": 100,
    "elite_impunity": 100,
}

# Strategy registry. Each strategy knows which value it contributes to.
# When adding a new strategy, add it here AND in scripts/labels.py AND
# in scripts/starbird-runner-prompt.md — three files, one truth.
#
# Each tuple is (strategy_id, value_id). The value_id must be a key in
# TARGETS_PER_VALUE.
STRATEGIES = [
    # ── workers (ICE cooperation, etc.) ─────────────────────────
    ("mijente_no_tech_for_ice", "workers"),
    ("usaspending_ice_contracts", "workers"),
    ("ice_foia_library", "workers"),
    ("adjacent_source_discovery_workers", "workers"),
    # ── environment ─────────────────────────────────────────────
    ("epa_tri_toxics_release", "environment"),
    ("climate_trace_emissions", "environment"),
    ("ewg_consumer_scores", "environment"),
    ("adjacent_source_discovery_environment", "environment"),
    # ── animals ─────────────────────────────────────────────────
    ("cruelty_free_international_db", "animals"),
    ("peta_cruelty_list", "animals"),
    ("mercy_for_animals_investigations", "animals"),
    ("adjacent_source_discovery_animals", "animals"),
    # ── health ──────────────────────────────────────────────────
    ("ewg_food_scores", "health"),
    ("ultraprocessed_nova_tracker", "health"),
    ("cspi_additive_tracker", "health"),
    ("adjacent_source_discovery_health", "health"),
    # ── extraction (PE / asset-stripping) ───────────────────────
    ("pesp_bankruptcy_tracker", "extraction"),
    ("sec_lbo_filings", "extraction"),
    ("nyt_dealbook_archive", "extraction"),
    ("adjacent_source_discovery_extraction", "extraction"),
    # ── elite impunity (Epstein network, oligarch ties) ─────────
    ("epstein_flight_logs", "elite_impunity"),
    ("littlesis_power_network", "elite_impunity"),
    ("icij_panama_pandora_papers", "elite_impunity"),
    ("adjacent_source_discovery_elite_impunity", "elite_impunity"),
]

STRATEGY_VALUE = {sid: vid for sid, vid in STRATEGIES}
STRATEGY_IDS = [sid for sid, _ in STRATEGIES]


def load_history():
    if not HISTORY_FILE.exists():
        return []
    runs = []
    for line in HISTORY_FILE.read_text().splitlines():
        line = line.strip()
        if not line:
            continue
        try:
            runs.append(json.loads(line))
        except json.JSONDecodeError:
            continue
    return runs


def load_value_counts():
    """
    Count tagged entries per value from static/data.json.

    An entry contributes to a value if any of its harms[] quest IDs
    roll up to that value. We use a minimal quest→value rollup table
    inlined here (parallel to src/lib/quests.ts) so this script has
    no TypeScript dependency.
    """
    if not DATA_FILE.exists():
        return {v: 0 for v in TARGETS_PER_VALUE}

    quest_to_value = {
        "workers_general": "workers",
        "workers_ice_cooperation": "workers",
        "workers_mass_layoffs": "workers",
        "environment_general": "environment",
        "animals_general": "animals",
        "health_general": "health",
        "extraction_general": "extraction",
        "extraction_sale_leaseback": "extraction",
        "extraction_debt_loading": "extraction",
        "elite_impunity_general": "elite_impunity",
        "elite_impunity_epstein_network": "elite_impunity",
    }

    data = json.loads(DATA_FILE.read_text())
    counts = {v: 0 for v in TARGETS_PER_VALUE}

    # Count unique entities per value. A "unique entity" is a brand or a
    # firm counted once — not once per record. For self-owned companies
    # where firm+brand share an ID, count once. Otherwise count both.
    seen_per_value = {v: set() for v in TARGETS_PER_VALUE}

    for f in data.get("firms", []):
        fid = f.get("id", "")
        touched_values = set()
        for q in f.get("harms", []):
            v = quest_to_value.get(q)
            if v:
                touched_values.add(v)
        for v in touched_values:
            seen_per_value[v].add(("firm", fid))

    for b in data.get("brands", []):
        bid = b.get("id", "")
        touched_values = set()
        for q in b.get("harms", []):
            v = quest_to_value.get(q)
            if v:
                touched_values.add(v)
        for v in touched_values:
            # If there's a firm with the same id tagged to the same value,
            # don't double-count — a self-owned company is one entity even
            # though it has two records.
            if ("firm", bid) in seen_per_value[v]:
                continue
            seen_per_value[v].add(("brand", bid))

    for v, seen in seen_per_value.items():
        counts[v] = len(seen)

    return counts


def value_weight(value_id, current_counts):
    """Linear falloff: 1.0 at zero entries, 0.0 at target."""
    current = current_counts.get(value_id, 0)
    target = TARGETS_PER_VALUE.get(value_id, 50)
    if target <= 0:
        return 0.0
    remaining = max(0, target - current)
    return remaining / target


def compute_scores(runs, value_counts):
    by_strategy = {sid: [] for sid in STRATEGY_IDS}
    for r in runs:
        sid = r.get("strategy_id")
        if sid in by_strategy:
            by_strategy[sid].append(r)

    scores = {}
    for sid, rs in by_strategy.items():
        value = STRATEGY_VALUE[sid]
        vw = value_weight(value, value_counts)
        value_at_target = vw == 0.0

        recent = rs[-WINDOW:]
        run_count = len(rs)

        if not recent:
            # Strategy has never run. Exploration-eligible IFF its value
            # is not already at target. Otherwise skip.
            scores[sid] = {
                "value": value,
                "score": 0.0,
                "base_yield": 0.0,
                "value_weight": round(vw, 4),
                "run_count": 0,
                "recent_new_entities": 0,
                "recent_cost_usd": 0.0,
                "exploration_eligible": not value_at_target,
                "value_at_target": value_at_target,
            }
            continue

        total_new = sum((r.get("new_firms", 0) + r.get("new_brands", 0)) for r in recent)
        total_cost = sum(float(r.get("cost_usd", 0.0)) for r in recent)
        base_yield = total_new / total_cost if total_cost > 0 else 0.0
        final_score = base_yield * vw

        scores[sid] = {
            "value": value,
            "score": round(final_score, 4),
            "base_yield": round(base_yield, 4),
            "value_weight": round(vw, 4),
            "run_count": run_count,
            "recent_new_entities": total_new,
            "recent_cost_usd": round(total_cost, 4),
            "exploration_eligible": False,
            "value_at_target": value_at_target,
        }
    return scores


def main():
    runs = load_history()
    value_counts = load_value_counts()
    scores = compute_scores(runs, value_counts)

    SCORES_FILE.parent.mkdir(parents=True, exist_ok=True)
    out = {
        "window": WINDOW,
        "total_runs": len(runs),
        "targets_per_value": TARGETS_PER_VALUE,
        "current_counts": value_counts,
        "remaining": {v: max(0, TARGETS_PER_VALUE[v] - value_counts.get(v, 0)) for v in TARGETS_PER_VALUE},
        "strategies": scores,
    }
    SCORES_FILE.write_text(json.dumps(out, indent=2) + "\n")
    done = sum(1 for v, c in value_counts.items() if c >= TARGETS_PER_VALUE[v])
    print(
        f"scored {len(STRATEGY_IDS)} strategies from {len(runs)} runs. "
        f"values complete: {done}/{len(TARGETS_PER_VALUE)}. "
        f"counts: {value_counts}"
    )


if __name__ == "__main__":
    main()
