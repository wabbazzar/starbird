#!/usr/bin/env python3
"""
Deterministic strategy picker for Starbird Runner.

Reads tmp/starbird-runner-strategy-scores.json and prints a single strategy
ID to stdout. The launcher captures this and exports it as PICKED_STRATEGY
before invoking Claude. Exit code 2 if no strategy is pickable (all values
at target — the research loop is done).

Policy (v2 — progress-aware):
  1. Drop any strategy whose value_at_target is True. If nothing remains,
     exit with a "complete" sentinel.
  2. Exploration-first over the survivors: pick the first strategy with
     zero runs whose parent value still needs entries.
  3. Otherwise epsilon-greedy (epsilon=0.2) with the RNG seeded from the
     current UTC date. Random choices drawn only from survivors.
  4. Greedy fallback: pick the survivor with the highest score, ties
     broken by strategy order.

No LLM involvement. No learned model.
"""
import json
import pathlib
import random
import sys
from datetime import datetime

REPO = pathlib.Path(__file__).resolve().parent.parent
SCORES_FILE = REPO / "tmp" / "starbird-runner-strategy-scores.json"
EPSILON = 0.2


def pick(scores_payload):
    strategies = scores_payload["strategies"]
    # Drop strategies whose value is already at target.
    order = [
        sid for sid in strategies.keys()
        if not strategies[sid].get("value_at_target", False)
    ]

    if not order:
        return None, "all_values_complete"

    # Exploration-first among survivors
    for sid in order:
        if strategies[sid].get("exploration_eligible", False):
            return sid, "exploration"

    # Epsilon-greedy with date-seeded RNG, survivors only
    seed = datetime.utcnow().strftime("%Y%m%d")
    rng = random.Random(seed)
    if rng.random() < EPSILON:
        return rng.choice(order), "epsilon_random"

    # Greedy: highest score among survivors
    best = max(order, key=lambda s: (strategies[s]["score"], -order.index(s)))
    return best, "greedy"


def main():
    if not SCORES_FILE.exists():
        print("ERROR: scores file missing. Run update-strategy-scores.py first.", file=sys.stderr)
        sys.exit(2)
    payload = json.loads(SCORES_FILE.read_text())
    sid, reason = pick(payload)
    if sid is None:
        print(f"no pick: {reason}", file=sys.stderr)
        sys.exit(3)  # sentinel: research loop is complete
    print(sid)
    print(f"picked {sid} via {reason}", file=sys.stderr)


if __name__ == "__main__":
    main()
