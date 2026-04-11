#!/usr/bin/env python3
"""
Deterministic strategy scorer for Starbird Runner.

Reads the append-only run history at tmp/runner-metrics-history.jsonl
and writes per-strategy scores to tmp/starbird-runner-strategy-scores.json.

Claude never touches either file. The launcher invokes this script before
every run, and compute-run-metrics.py writes the history AFTER each run
from a data.json before/after diff — so Claude's self-reported numbers
never enter the loop.

Score formula (v1, deliberately simple):
    score[strategy] = sum(new_entities) / sum(cost_usd)
                      over the last N runs (N=10)
    if sum(cost_usd) == 0, score = 0
    strategies with 0 runs are flagged exploration-eligible

Call from Python or CLI:
    python3 scripts/update-strategy-scores.py
"""
import json
import pathlib
import sys

REPO = pathlib.Path(__file__).resolve().parent.parent
HISTORY_FILE = REPO / "tmp" / "runner-metrics-history.jsonl"
SCORES_FILE = REPO / "tmp" / "starbird-runner-strategy-scores.json"
WINDOW = 10  # number of recent runs per strategy to score over

# The strategy bank. Keep in sync with scripts/starbird-runner-prompt.md.
# New strategies added here start with 0 runs, which the picker will
# prioritize for exploration.
STRATEGIES = [
    "mijente_no_tech_for_ice",
    "usaspending_ice_contracts",
    "ice_foia_library",
    "adjacent_source_discovery",
]


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
            # Malformed history line — skip, don't let it poison the score
            continue
    return runs


def compute_scores(runs):
    by_strategy = {s: [] for s in STRATEGIES}
    for r in runs:
        sid = r.get("strategy_id")
        if sid in by_strategy:
            by_strategy[sid].append(r)

    scores = {}
    for sid, rs in by_strategy.items():
        recent = rs[-WINDOW:]
        run_count = len(rs)
        if not recent:
            scores[sid] = {
                "score": 0.0,
                "run_count": 0,
                "recent_new_entities": 0,
                "recent_cost_usd": 0.0,
                "exploration_eligible": True,
            }
            continue
        total_new = sum((r.get("new_firms", 0) + r.get("new_brands", 0)) for r in recent)
        total_cost = sum(float(r.get("cost_usd", 0.0)) for r in recent)
        score = total_new / total_cost if total_cost > 0 else 0.0
        scores[sid] = {
            "score": round(score, 4),
            "run_count": run_count,
            "recent_new_entities": total_new,
            "recent_cost_usd": round(total_cost, 4),
            "exploration_eligible": run_count == 0,
        }
    return scores


def main():
    runs = load_history()
    scores = compute_scores(runs)
    SCORES_FILE.parent.mkdir(parents=True, exist_ok=True)
    out = {
        "window": WINDOW,
        "total_runs": len(runs),
        "strategies": scores,
    }
    SCORES_FILE.write_text(json.dumps(out, indent=2) + "\n")
    print(f"scored {len(STRATEGIES)} strategies from {len(runs)} runs")


if __name__ == "__main__":
    main()
