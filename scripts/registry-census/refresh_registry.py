#!/usr/bin/env python3
"""Refresh the pinned registry snapshot from the Comfy registry API.

`data/registry.json` is the target list for every fetch and the denominator for
every percentage this tool reports. It is gitignored and pulled on first use.

The registry gains packs continuously, so two runs weeks apart do not share
denominators. Snapshot this file alongside any published figure; re-pull with:

    ./run refresh-registry

Only the three fields the checker reads are kept (id, repo, downloads), which
is a fraction of what the API returns.
"""

from __future__ import annotations

import json
import os
import subprocess
import sys

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from paths import registry_snapshot  # noqa: E402

API = 'https://api.comfy.org/nodes'
PAGE_SIZE = 100


def fetch_page(page: int) -> dict:
    r = subprocess.run(
        ['curl', '-sfL', '--max-time', '60', f'{API}?page={page}&limit={PAGE_SIZE}'],
        capture_output=True,
        text=True,
    )
    if r.returncode != 0:
        raise SystemExit(f'registry API request failed on page {page}')
    return json.loads(r.stdout)


def main() -> int:
    first = fetch_page(1)
    total_pages = first.get('totalPages') or 1
    nodes = list(first.get('nodes') or [])

    for page in range(2, total_pages + 1):
        nodes.extend(fetch_page(page).get('nodes') or [])
        print(f'  page {page}/{total_pages}', end='\r', file=sys.stderr)

    out = [
        {
            'id': n['id'],
            'repo': n.get('repository') or '',
            'downloads': n.get('downloads') or 0,
        }
        for n in nodes
        if n.get('id')
    ]
    out.sort(key=lambda x: x['id'])

    dest = registry_snapshot()
    os.makedirs(os.path.dirname(dest), exist_ok=True)
    with open(dest, 'w', encoding='utf-8') as fh:
        json.dump(out, fh, indent=0, sort_keys=True)

    with_repo = sum(1 for x in out if x['repo'])
    print(
        f'\n{len(out)} packs ({with_repo} with a repo url) -> {dest}\n'
        f'this is the denominator for every figure the tool reports; snapshot it '
        f'alongside any published result',
        file=sys.stderr,
    )
    return 0


if __name__ == '__main__':
    raise SystemExit(main())
