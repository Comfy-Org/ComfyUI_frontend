#!/usr/bin/env python3
"""Corpus pins: which commit of each pack the matrix measures.

The matrix is a required PR and merge-queue gate, so the corpus has to be a
constant. Tracking pack HEADs makes every pack author a committer to this
repo's CI: one of them pushes a bug and the next unrelated PR goes red for it.

`corpus.pins.json` is checked in, so a pack only changes when someone bumps
the pins in a reviewed PR - and that PR is the one place ecosystem churn is
allowed to be red.

Run standalone to print the pin banner and check its age:

    python3 scripts/registry-census/pins.py
"""

from __future__ import annotations

import json
import os
import sys
from datetime import date, datetime
from functools import cache

HERE = os.path.dirname(os.path.abspath(__file__))
PINS = os.path.join(HERE, 'corpus.pins.json')

MAX_AGE_DAYS = 30
UPDATE_WORKFLOW = (
    'https://github.com/Comfy-Org/ComfyUI_frontend/actions/workflows/'
    'update-corpus-pins.yaml'
)
UPDATE_LOCAL = (
    'python3 scripts/registry-census/fetch_corpus.py --write-pins'
)


@cache
def load() -> dict:
    try:
        with open(PINS, encoding='utf-8') as fh:
            data = json.load(fh)
    except (OSError, ValueError):
        return {}
    return data if isinstance(data, dict) else {}


def packs() -> dict[str, str]:
    entries = load().get('packs')
    return entries if isinstance(entries, dict) else {}


def updated_on() -> date | None:
    raw = load().get('updated')
    if not isinstance(raw, str):
        return None
    try:
        return datetime.strptime(raw, '%Y-%m-%d').date()
    except ValueError:
        return None


def age_days(today: date | None = None) -> int | None:
    pinned = updated_on()
    if pinned is None:
        return None
    return ((today or date.today()) - pinned).days


def banner(today: date | None = None) -> list[str]:
    """The loudest line in the run. Stale pins are silent by nature."""
    pinned = updated_on()
    age = age_days(today)
    count = len(packs())
    if pinned is None:
        head = 'CORPUS PINS: MISSING OR UNREADABLE - measuring pack HEADs'
        detail = (
            'every pack author is currently a committer to this check;'
            ' a bug pushed to any pack reds the next unrelated PR'
        )
    elif age is not None and age > MAX_AGE_DAYS:
        head = (
            f'CORPUS PINS ARE {age} DAYS OLD'
            f' (pinned {pinned.isoformat()}, limit {MAX_AGE_DAYS} days)'
        )
        detail = (
            'the check is measuring an ecosystem snapshot older than a month;'
            ' real pack breakage is invisible until the pins are bumped'
        )
    else:
        head = (
            f'corpus pinned {pinned.isoformat()}'
            f' ({age} day(s) ago, {count} packs)'
        )
        detail = ''
    lines = [
        '=' * 72,
        head,
        f'  update via   {UPDATE_WORKFLOW}',
        f'  or locally   {UPDATE_LOCAL}',
    ]
    if detail:
        lines.append(f'  why it matters   {detail}')
    lines.append('=' * 72)
    return lines


def is_stale(today: date | None = None) -> bool:
    age = age_days(today)
    return age is None or age > MAX_AGE_DAYS


def main() -> int:
    for line in banner():
        print(line, file=sys.stderr)
    if not is_stale():
        return 0
    pinned = updated_on()
    age = age_days()
    summary = (
        f'corpus pins are {age} days old (pinned {pinned.isoformat()}) -'
        f' bump them at {UPDATE_WORKFLOW}'
        if pinned
        else f'corpus pins are missing - create them at {UPDATE_WORKFLOW}'
    )
    print(f'::warning title=Corpus pins are stale::{summary}')
    step_summary = os.environ.get('GITHUB_STEP_SUMMARY')
    if step_summary:
        with open(step_summary, 'a', encoding='utf-8') as fh:
            fh.write(f'> [!WARNING]\n> {summary}\n\n')
    return 0


if __name__ == '__main__':
    raise SystemExit(main())
