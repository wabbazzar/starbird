#!/usr/bin/env python3
"""
append-blog-post.py — Append one blog post to static/blog.json for a runner run.

Mirrors the runner's core philosophy: the LAUNCHER owns ground truth, Claude
only contributes prose. The authoritative facts of a post (which entities were
added, the date, the value, the strategy) come from the data.json before/after
diff (passed in as GROUND_TRUTH). Claude's run writes only prose — title,
summary, body — to a small handoff file (tmp/blog-draft.json). If that draft is
missing or malformed, we fall back to a mechanical body so a post is never lost.

Usage:
  append-blog-post.py --ground-truth <file|-> [--draft tmp/blog-draft.json] \
                      [--out static/blog.json]

GROUND_TRUTH is the JSON emitted by compute-run-metrics.py and must contain
strategy_id, new_firm_ids, new_brand_ids, and (optionally) timestamp.
Exit 0 on success (post appended) or no-op (no new entities). Non-zero only on
a hard failure that should surface in the runner log.
"""
import argparse
import json
import pathlib
import re
import sys

REPO = pathlib.Path(__file__).resolve().parent.parent
DATA = REPO / "static" / "data.json"
VALUES = {"workers", "environment", "animals", "health", "extraction", "elite_impunity"}


def strategy_value_map() -> dict:
    """Parse the (strategy_id, value_id) tuples from update-strategy-scores.py."""
    txt = (REPO / "scripts" / "update-strategy-scores.py").read_text()
    return {m.group(1): m.group(2) for m in re.finditer(r'\("([a-z0-9_]+)",\s*"([a-z_]+)"\)', txt)}


def strategy_labels() -> dict:
    """Import STRATEGY_LABELS from labels.py without importing the whole package."""
    import importlib.util

    spec = importlib.util.spec_from_file_location("labels", REPO / "scripts" / "labels.py")
    mod = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(mod)
    return getattr(mod, "STRATEGY_LABELS", {})


def dedup(seq):
    seen, out = set(), []
    for x in seq:
        if x not in seen:
            seen.add(x)
            out.append(x)
    return out


def load_json(path: str):
    if path == "-":
        return json.load(sys.stdin)
    return json.loads(pathlib.Path(path).read_text())


def main() -> int:
    ap = argparse.ArgumentParser()
    ap.add_argument("--ground-truth", required=True, help="compute-run-metrics.py JSON, or - for stdin")
    ap.add_argument("--draft", default=str(REPO / "tmp" / "blog-draft.json"))
    ap.add_argument("--out", default=str(REPO / "static" / "blog.json"))
    args = ap.parse_args()

    gt = load_json(args.ground_truth)
    strategy = gt.get("strategy_id") or gt.get("strategy") or ""
    entity_ids = dedup((gt.get("new_firm_ids") or []) + (gt.get("new_brand_ids") or []))
    if not strategy or not entity_ids:
        print("[append-blog-post] no new entities; nothing to post")
        return 0

    date = (gt.get("timestamp") or "")[:10]
    if not re.fullmatch(r"\d{4}-\d{2}-\d{2}", date):
        from datetime import datetime, timezone

        date = datetime.now(timezone.utc).strftime("%Y-%m-%d")

    svmap = strategy_value_map()
    value = svmap.get(strategy)
    if value not in VALUES:
        print(f"[append-blog-post] ERROR: strategy '{strategy}' maps to no known value", file=sys.stderr)
        return 1

    labels = strategy_labels().get(strategy, {})
    strategy_label = labels.get("label", strategy)
    source = labels.get("primary_source", "")

    # Resolve entity display names for the title/fallback body.
    data = json.loads(DATA.read_text())
    name = {}
    for f in data.get("firms", []):
        name[f["id"]] = f.get("name", f["id"])
    for b in data.get("brands", []):
        name.setdefault(b["id"], b.get("avoid", b["id"]))
    pretty = [name.get(e, e) for e in entity_ids]

    # Claude's prose draft is best-effort. Missing/malformed → mechanical fallback.
    draft = {}
    try:
        d = json.loads(pathlib.Path(args.draft).read_text())
        if isinstance(d, dict):
            draft = d
    except Exception:
        pass

    def clean(s):
        return s.strip() if isinstance(s, str) and s.strip() else None

    joined = ", ".join(pretty[:-1]) + (" and " + pretty[-1] if len(pretty) > 1 else pretty[0])
    title = clean(draft.get("title")) or f"{len(entity_ids)} new {'entry' if len(entity_ids) == 1 else 'entries'}: {joined}"[:110]
    summary = clean(draft.get("summary")) or f"This run added {joined} via the {strategy_label}."
    body = clean(draft.get("body")) or (
        f"This nightly run added {joined} to the database. "
        f"Surfaced via the {strategy_label}."
    )

    post = {
        "id": f"{date}-{strategy}",
        "date": date,
        "title": title,
        "strategy": strategy,
        "strategyLabel": strategy_label,
        "value": value,
        "summary": summary,
        "body": body,
        "entityIds": entity_ids,
    }
    if isinstance(source, str) and source.startswith("http"):
        post["source"] = source

    out_path = pathlib.Path(args.out)
    blob = {"version": 1, "posts": []}
    if out_path.exists():
        try:
            blob = json.loads(out_path.read_text())
        except Exception:
            pass
    posts = blob.get("posts", [])

    # Same-day re-run of the same strategy replaces the earlier post; otherwise
    # disambiguate the id so two runs on one day both survive.
    existing = next((p for p in posts if p["id"] == post["id"]), None)
    if existing:
        posts[posts.index(existing)] = post
    else:
        posts.append(post)

    blob["version"] = blob.get("version", 1)
    blob["posts"] = sorted(posts, key=lambda p: (p["date"], p["id"]))
    out_path.write_text(json.dumps(blob, indent=2, ensure_ascii=False) + "\n")
    print(f"[append-blog-post] wrote post {post['id']} ({len(entity_ids)} entities) → {out_path}")
    return 0


if __name__ == "__main__":
    sys.exit(main())
