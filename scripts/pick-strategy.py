#!/usr/bin/env python3
"""
Deterministic strategy picker for Starbird Runner.

Reads tmp/starbird-runner-strategy-scores.json and prints a single strategy
ID to stdout. The launcher captures this and exports it as PICKED_STRATEGY
before invoking Claude.

Policy:
  1. Exploration-first: if any strategy has 0 runs, pick it. Ties broken
     by the strategy order in update-strategy-scores.py (deterministic).
  2. Otherwise epsilon-greedy (epsilon=0.2) with the RNG seeded from the
     current UTC date. Same date → same pick. Different days → different
     picks. This is still deterministic given an external clock.
  3. If the greedy branch fires, pick the strategy with the highest score.
     Ties broken by strategy order.

No LLM involvement. No learned model. If we want UCB1 or Thompson sampling
later, swap the body of pick() — history format does not need to change.
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
    order = list(strategies.keys())

    # Exploration-first
    for sid in order:
        if strategies[sid]["exploration_eligible"]:
            return sid, "exploration"

    # Epsilon-greedy with date-seeded RNG
    seed = datetime.utcnow().strftime("%Y%m%d")
    rng = random.Random(seed)
    if rng.random() < EPSILON:
        return rng.choice(order), "epsilon_random"

    # Greedy: highest score, ties broken by order
    best = max(order, key=lambda s: (strategies[s]["score"], -order.index(s)))
    return best, "greedy"


def main():
    if not SCORES_FILE.exists():
        print("ERROR: scores file missing. Run update-strategy-scores.py first.", file=sys.stderr)
        sys.exit(2)
    payload = json.loads(SCORES_FILE.read_text())
    sid, reason = pick(payload)
    # stdout is the machine-readable output; stderr carries the rationale
    print(sid)
    print(f"picked {sid} via {reason}", file=sys.stderr)


if __name__ == "__main__":
    main()
