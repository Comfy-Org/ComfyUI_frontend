#!/usr/bin/env python3
"""
Compat-floor gate: Verify all high-impact behavior categories have test triples.

Per PLAN.md §Compat-floor: "Every blast_radius ≥ 2.0 pattern MUST pass v1 + v2 +
migration tests before v2 ships."

This script:
1. Reads research/touch-points/behavior-categories.yaml
2. Finds all categories with usage_weight >= 2.0 (blast_radius threshold)
3. Checks that each has all three test files: bc-XX.v1.test.ts, bc-XX.v2.test.ts, bc-XX.migration.test.ts
4. Exits 0 if all present, exits 1 if any missing (fails CI)

Usage: python3 scripts/check-compat-floor.py
"""

import sys
from pathlib import Path

try:
    import yaml
except ImportError:
    print("ERROR: PyYAML not installed. Run: pip install pyyaml", file=sys.stderr)
    sys.exit(1)

COMPAT_FLOOR_THRESHOLD = 2.0
BEHAVIOR_CATEGORIES_PATH = Path("research/touch-points/behavior-categories.yaml")
TESTS_DIR = Path("src/extension-api-v2/__tests__")

def main():
    # Check that behavior-categories.yaml exists
    if not BEHAVIOR_CATEGORIES_PATH.exists():
        print(f"ERROR: {BEHAVIOR_CATEGORIES_PATH} not found", file=sys.stderr)
        print("       Run scripts/build-behavior-categories.py first or copy from workspace", file=sys.stderr)
        sys.exit(1)

    # Load categories
    with open(BEHAVIOR_CATEGORIES_PATH, "r") as f:
        data = yaml.safe_load(f)

    categories = data.get("categories", [])

    # Find categories above compat floor
    above_floor = []
    for cat in categories:
        cat_id = cat.get("category_id", "")
        usage_weight = cat.get("usage_weight", 0)
        if usage_weight >= COMPAT_FLOOR_THRESHOLD:
            above_floor.append({
                "id": cat_id,
                "name": cat.get("name", ""),
                "usage_weight": usage_weight
            })

    print(f"Compat-floor check: {len(above_floor)} categories with usage_weight >= {COMPAT_FLOOR_THRESHOLD}")
    print()

    # Check each category for test triples
    missing = []
    for cat in above_floor:
        cat_id = cat["id"]
        # Extract number from BC.XX
        num_str = cat_id.replace("BC.", "").zfill(2)

        required_files = [
            f"bc-{num_str}.v1.test.ts",
            f"bc-{num_str}.v2.test.ts",
            f"bc-{num_str}.migration.test.ts"
        ]

        cat_missing = []
        for fname in required_files:
            fpath = TESTS_DIR / fname
            if not fpath.exists():
                cat_missing.append(fname)

        if cat_missing:
            missing.append({
                "category": cat_id,
                "name": cat["name"],
                "usage_weight": cat["usage_weight"],
                "missing": cat_missing
            })
            status = "❌ MISSING"
        else:
            status = "✅"

        print(f"  {cat_id} ({cat['usage_weight']:.2f}) {cat['name'][:40]:<40} {status}")
        if cat_missing:
            for m in cat_missing:
                print(f"       └─ {m}")

    print()

    if missing:
        print(f"FAIL: {len(missing)} categories missing test files", file=sys.stderr)
        print()
        print("Per PLAN.md §Compat-floor, all blast_radius >= 2.0 categories", file=sys.stderr)
        print("must have complete test triples (v1, v2, migration) before v2 ships.", file=sys.stderr)
        print()
        print("Missing files:", file=sys.stderr)
        for m in missing:
            for f in m["missing"]:
                print(f"  - {TESTS_DIR / f}", file=sys.stderr)
        sys.exit(1)
    else:
        print(f"PASS: All {len(above_floor)} compat-floor categories have test triples")
        sys.exit(0)

if __name__ == "__main__":
    main()
