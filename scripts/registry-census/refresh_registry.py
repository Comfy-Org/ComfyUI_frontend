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
        [
            'curl', '-sfL', '--max-time', '60',
            '--retry', '5', '--retry-all-errors', '--retry-delay', '2',
            f'{API}?page={page}&limit={PAGE_SIZE}',
        ],
        capture_output=True,
        text=True,
    )
    if r.returncode != 0:
        raise RegistryUnavailable(f'registry API request failed on page {page}')
    try:
        return json.loads(r.stdout)
    except ValueError as exc:
        raise RegistryUnavailable(
            f'registry API returned non-JSON on page {page}: {exc}'
        ) from exc


class RegistryUnavailable(Exception):
    pass


def keep_cached(reason: str) -> int:
    """A transient registry problem must not kill the weekly run: the cached
    snapshot is a complete, recently-valid target list. Only a first-ever run
    (no cache to fall back on) fails hard."""
    dest = registry_snapshot()
    if os.path.exists(dest):
        print(f'{reason}; keeping the cached snapshot at {dest}', file=sys.stderr)
        return 0
    raise SystemExit(reason + ' and no cached snapshot exists')


def main() -> int:
    # Everything between fetch and a fully-built snapshot goes through the
    # cached fallback: a malformed payload (string totalPages, non-mapping
    # node rows) is the same operational event as an unreachable API.
    try:
        first = fetch_page(1)
        total_pages = int(first.get('totalPages') or 1)
        nodes = list(first.get('nodes') or [])

        for page in range(2, total_pages + 1):
            nodes.extend(fetch_page(page).get('nodes') or [])
            print(f'  page {page}/{total_pages}', end='\r', file=sys.stderr)

        seen: set[str] = set()
        out = []
        for n in nodes:
            node_id = n.get('id')
            if not node_id or node_id in seen:
                continue
            seen.add(node_id)
            out.append(
                {
                    'id': node_id,
                    'repo': n.get('repository') or '',
                    'downloads': n.get('downloads') or 0,
                }
            )
    except RegistryUnavailable as exc:
        return keep_cached(str(exc))
    except (TypeError, ValueError, KeyError, AttributeError) as exc:
        return keep_cached(f'registry payload malformed: {exc!r}')

    out.sort(key=lambda x: x['id'])

    dest = registry_snapshot()
    if os.path.exists(dest):
        prev_count = len(json.load(open(dest)))
        if len(out) < 0.9 * prev_count:
            return keep_cached(
                f'registry returned {len(out)} packs vs {prev_count} cached -'
                ' likely API shape drift, not mass unpublishing'
            )
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
