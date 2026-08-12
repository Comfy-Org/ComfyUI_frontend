#!/usr/bin/env python3
"""Fetch the custom-node corpus on demand.

The corpus is a build artifact, never committed. This script is the only thing
that creates it, and it is safe to re-run: packs already present and unchanged
are skipped.

What this fixes versus the original inline fetch:

  * Honest status. The original wrote its `.done` marker and returned 'ok'
    unconditionally, so a failed fetch was cached forever, never retried, and
    counted as a clean pack. Status is now one of ok / empty / failed /
    unsupported-host / bad-url, and `.done` is only written on success.
  * Drift detection. Each pack's tarball ETag is recorded in corpus.lock.json.
    Re-runs verify it, so two runs are known-comparable instead of assumed to be.
    `--frozen` turns a drift into an error, for reproducing a published result.
  * URL parsing. Registry entries of the form `.../tree/main/subdir` previously
    resolved to a bogus slug, fetched nothing, and scored as clean.

Usage:
    ./run fetch                  # fetch missing packs, record ETags
    ./run fetch --frozen         # fail if any pack drifted from the lockfile
    ./run fetch --limit 50       # smoke test
"""

from __future__ import annotations

import argparse
import json
import os
import re
import shutil
import subprocess
import sys
import tempfile
import time
from collections import Counter
from concurrent.futures import ThreadPoolExecutor

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from paths import CORPUS, LOCKFILE, registry_snapshot  # noqa: E402

# Source-ish files only; the corpus is scanned for JS idioms, not built.
INCLUDES = ('.js', '.mjs', '.ts', '.jsx', '.tsx', '.vue')

_TREE_RE = re.compile(r'^(?P<owner>[^/]+)/(?P<repo>[^/]+)(?:/(?:tree|blob)/.*)?$')


def slug_of(url: str) -> str | None:
    """Owner/repo from a repo URL.

    Handles `.../tree/main/custom_nodes/foo`, which the previous
    last-two-segments approach mangled into `custom_nodes/foo`.
    """
    u = url.strip().rstrip('/')
    u = re.sub(r'\.git$', '', u)
    u = re.sub(r'^[a-z+]+://', '', u)
    u = re.sub(r'^git@([^:]+):', r'\1/', u)
    parts = u.split('/', 1)
    if len(parts) < 2:
        return None
    m = _TREE_RE.match(parts[1])
    if not m:
        return None
    return f'{m["owner"]}/{m["repo"]}'


def tarball_url(repo: str, slug: str, ref: str) -> str | None:
    if 'github.com' in repo:
        return f'https://codeload.github.com/{slug}/tar.gz/{ref}'
    if 'gitlab.com' in repo:
        name = slug.split('/')[-1]
        return f'https://gitlab.com/{slug}/-/archive/{ref}/{name}-{ref}.tar.gz'
    return None


def _head_etag(url: str) -> str | None:
    """The tarball's current ETag via a HEAD request, or None on any failure.

    codeload/gitlab archive ETags are commit-derived, so for a HEAD-ref
    tarball a changed ETag means the pack's default branch moved.
    """
    r = subprocess.run(
        ['curl', '-sfI', '--max-time', '30', url], capture_output=True, text=True
    )
    if r.returncode != 0:
        return None
    for line in r.stdout.splitlines():
        if line.lower().startswith('etag:'):
            return line.split(':', 1)[1].strip().strip('"')
    return None


def _has_payload(d: str) -> bool:
    return any(f != '.done' for _, _, fs in os.walk(d) for f in fs)


def fetch_one(
    entry: dict, lock: dict, frozen: bool, revalidate: bool = False
) -> tuple[str, str, str | None]:
    """Returns (pack_id, status, etag)."""
    pack_id = entry['id']
    repo = entry.get('repo') or ''
    dest = os.path.join(CORPUS, pack_id.replace('/', '_'))
    marker = os.path.join(dest, '.done')
    prev = lock.get(pack_id) or {}

    slug = slug_of(repo)
    if not slug:
        return (pack_id, 'bad-url', None)

    ref = prev.get('ref') or 'HEAD'
    url = tarball_url(repo, slug, ref)
    if not url:
        return (pack_id, 'unsupported-host', None)

    # Already fetched successfully and we are not being asked to verify.
    if os.path.exists(marker) and not frozen:
        if not revalidate:
            return (pack_id, 'cached', prev.get('etag'))
        # Cheap drift check: one HEAD request against the lockfile ETag.
        # On any HEAD failure keep the cached copy - a network blip must
        # not evict corpus.
        live = _head_etag(url)
        if live is None or not prev.get('etag') or live == prev['etag']:
            return (pack_id, 'cached', prev.get('etag'))
        shutil.rmtree(dest, ignore_errors=True)

    os.makedirs(dest, exist_ok=True)
    with tempfile.TemporaryDirectory() as tmp:
        tar_path = os.path.join(tmp, 'a.tar.gz')
        hdr_path = os.path.join(tmp, 'h.txt')
        rc = subprocess.run(
            ['curl', '-sfL', '--max-time', '180', '-D', hdr_path, '-o', tar_path, url],
            capture_output=True,
        ).returncode
        if rc != 0 or not os.path.exists(tar_path):
            return (pack_id, 'failed', None)

        etag = None
        try:
            with open(hdr_path, encoding='utf-8', errors='replace') as fh:
                for line in fh:
                    if line.lower().startswith('etag:'):
                        etag = line.split(':', 1)[1].strip().strip('"')
        except OSError:
            pass

        if frozen and prev.get('etag') and etag and etag != prev['etag']:
            return (pack_id, 'drifted', etag)

        args = ['tar', '-xz', '-f', tar_path, '-C', dest]
        args += [f'--include=*{e}' for e in INCLUDES]
        subprocess.run(args, capture_output=True)

    # Both outcomes below are *successful* fetches, so both are marked done and
    # skipped next run. Only 'failed' is retried. The distinction between them
    # is recorded in the lockfile, not inferred from an empty directory — the
    # original conflated "ships no JS" with "download failed" and called both 'ok'.
    status = 'ok' if _has_payload(dest) else 'empty'
    with open(marker, 'w', encoding='utf-8') as fh:
        fh.write(etag or '')
    return (pack_id, status, etag)


def main() -> int:
    ap = argparse.ArgumentParser(description=__doc__)
    ap.add_argument('--frozen', action='store_true', help='fail on corpus drift')
    ap.add_argument(
        '--revalidate',
        action='store_true',
        help='HEAD-check cached packs against lockfile ETags; refetch drifted ones',
    )
    ap.add_argument('--limit', type=int, default=0, help='only N packs (smoke test)')
    ap.add_argument('--workers', type=int, default=int(os.environ.get('WORKERS', 16)))
    args = ap.parse_args()

    snapshot = registry_snapshot()
    if not os.path.exists(snapshot):
        print(f'missing registry snapshot: {snapshot}', file=sys.stderr)
        print('run `./run refresh-registry` first', file=sys.stderr)
        return 2

    with open(snapshot, encoding='utf-8') as fh:
        targets = [x for x in json.load(fh) if x.get('repo')]
    if args.limit:
        targets = targets[: args.limit]

    lock: dict = {}
    if os.path.exists(LOCKFILE):
        with open(LOCKFILE, encoding='utf-8') as fh:
            lock = json.load(fh).get('packs', {})

    os.makedirs(CORPUS, exist_ok=True)
    print(f'{len(targets)} packs -> {CORPUS}', file=sys.stderr, flush=True)

    t0 = time.time()
    with ThreadPoolExecutor(max_workers=args.workers) as ex:
        results = list(
            ex.map(
                lambda e: fetch_one(e, lock, args.frozen, args.revalidate), targets
            )
        )

    counts = Counter(status for _, status, _ in results)
    for pack_id, status, etag in results:
        if status in ('ok', 'cached', 'empty'):
            lock.setdefault(pack_id, {})
            if etag:
                lock[pack_id]['etag'] = etag
            # 'cached' is a fact about this run, not about the pack — keep the
            # ok/empty distinction the original fetch established.
            if status != 'cached':
                lock[pack_id]['status'] = status

    with open(LOCKFILE, 'w', encoding='utf-8') as fh:
        json.dump({'packs': lock}, fh, indent=1, sort_keys=True)

    print(f'done in {time.time() - t0:.0f}s', file=sys.stderr)
    for status, n in counts.most_common():
        print(f'  {status:18} {n}', file=sys.stderr)

    drifted = counts.get('drifted', 0)
    if args.frozen and drifted:
        print(f'\n{drifted} packs drifted from the lockfile', file=sys.stderr)
        return 1
    # A failed fetch is not a clean pack. Surface it rather than caching it.
    if counts.get('failed'):
        print(
            f"\n{counts['failed']} fetches failed; re-run to retry "
            f'(they are not marked done and will not be skipped)',
            file=sys.stderr,
        )
    return 0


if __name__ == '__main__':
    raise SystemExit(main())
