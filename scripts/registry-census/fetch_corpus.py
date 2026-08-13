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

# Source files the matrix executes plus the assets packs import from them
# (a CSS/JSON import that is absent on disk scores the pack as broken).
INCLUDES = (
    '.js', '.mjs', '.ts', '.jsx', '.tsx', '.vue',
    '.css', '.json', '.svg', '.woff2', '.png',
)
MAX_FILE_BYTES = 2_000_000

_TREE_RE = re.compile(r'^(?P<owner>[^/]+)/(?P<repo>[^/]+)(?:/(?:tree|blob)/.*)?$')
_PACK_ID_RE = re.compile(r'[A-Za-z0-9][A-Za-z0-9._-]{0,127}')


def _host(url: str) -> str:
    u = url.strip().lower()
    u = re.sub(r'^[a-z+]+://', '', u)
    u = re.sub(r'^git@([^:]+):.*$', r'\1', u)
    return u.split('/', 1)[0].removeprefix('www.')


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
    host = _host(repo)
    if host == 'github.com':
        return f'https://codeload.github.com/{slug}/tar.gz/{ref}'
    if host == 'gitlab.com':
        name = slug.split('/')[-1]
        return f'https://gitlab.com/{slug}/-/archive/{ref}/{name}-{ref}.tar.gz'
    return None


def _auth_args(url: str) -> list[str]:
    """Bearer header for github.com only, when a token is available.

    Anonymous codeload is rate-limited per IP; a run where many packs drift at
    once exhausts it and every remaining fetch fails, which reads as an
    ecosystem-wide outage. curl drops the header on a cross-host redirect
    unless --location-trusted, which is deliberately not used here.
    """
    token = os.environ.get('GITHUB_TOKEN') or os.environ.get('GH_TOKEN')
    if not token or not url.startswith('https://codeload.github.com/'):
        return []
    return ['-H', f'Authorization: Bearer {token}']


def _head_etag(url: str) -> str | None:
    """The tarball's current ETag via a HEAD request, or None on any failure.

    codeload/gitlab archive ETags are commit-derived, so for a HEAD-ref
    tarball a changed ETag means the pack's default branch moved. Follows
    redirects and keeps the LAST ETag seen, mirroring the GET path, so a
    redirecting host compares the same value both ways.
    """
    r = subprocess.run(
        ['curl', '-sfIL', '--max-time', '30', *_auth_args(url), url],
        capture_output=True, text=True
    )
    if r.returncode != 0:
        return None
    etag = None
    for line in r.stdout.splitlines():
        if line.lower().startswith('etag:'):
            etag = line.split(':', 1)[1].strip().strip('"')
    return etag


def _has_payload(d: str) -> bool:
    return any(f != '.done' for _, _, fs in os.walk(d) for f in fs)


def fetch_one(
    entry: dict, lock: dict, frozen: bool, revalidate: bool = False
) -> tuple[str, str, str | None, str]:
    """Returns (pack_id, status, etag, failure detail)."""
    pack_id = entry['id']
    repo = entry.get('repo') or ''
    # The id becomes a directory under CORPUS and a deletion target on
    # refetch; an unvalidated '..' would resolve to the census root itself.
    if not _PACK_ID_RE.fullmatch(pack_id):
        return (pack_id, 'bad-id', None, '')
    dest = os.path.join(CORPUS, pack_id)
    marker = os.path.join(dest, '.done')
    prev = lock.get(pack_id) or {}

    slug = slug_of(repo)
    if not slug:
        return (pack_id, 'bad-url', None, '')

    ref = prev.get('ref') or 'HEAD'
    url = tarball_url(repo, slug, ref)
    if not url:
        return (pack_id, 'unsupported-host', None, '')

    # Already fetched successfully and we are not being asked to verify.
    if os.path.exists(marker) and not frozen:
        if not revalidate:
            return (pack_id, 'cached', prev.get('etag'), '')
        # Cheap drift check: one HEAD request against the lockfile ETag.
        # On any HEAD failure keep the cached copy - a network blip must
        # not evict corpus. A pack with no RECORDED etag but a live one
        # refetches once to establish the record instead of pinning to its
        # first fetch forever. The cached tree stays in place until the
        # replacement is fully staged below.
        live = _head_etag(url)
        if live is None or (prev.get('etag') and live == prev['etag']):
            return (pack_id, 'cached', prev.get('etag'), '')

    with tempfile.TemporaryDirectory() as tmp:
        tar_path = os.path.join(tmp, 'a.tar.gz')
        hdr_path = os.path.join(tmp, 'h.txt')
        got = subprocess.run(
            [
                'curl', '-sfL', '--max-time', '180',
                '--retry', '3', '--retry-all-errors', '--retry-delay', '2',
                '-w', '%{http_code}', *_auth_args(url),
                '-D', hdr_path, '-o', tar_path, url,
            ],
            capture_output=True, text=True,
        )
        if got.returncode != 0 or not os.path.exists(tar_path):
            # Name the cause. Without it every corpus failure is indistinguishable
            # from every other, and a rate-limit wall reads the same as 145
            # simultaneously deleted repos (run 31738365496).
            code = (got.stdout or '').strip() or '000'
            return (pack_id, 'failed', None, f'http {code} curl {got.returncode}')

        etag = None
        try:
            with open(hdr_path, encoding='utf-8', errors='replace') as fh:
                for line in fh:
                    if line.lower().startswith('etag:'):
                        etag = line.split(':', 1)[1].strip().strip('"')
        except OSError:
            pass

        if frozen and prev.get('etag') and etag and etag != prev['etag']:
            return (pack_id, 'drifted', etag, '')

        # Extract WITHOUT tar filter flags: --include is bsdtar-only and GNU
        # tar (ubuntu CI) errors on it, which - with the return code
        # unchecked - silently produced an empty corpus that scanned 100%
        # clean. Extract everything to a scratch dir, keep only the wanted
        # extensions, and swap into dest only on success so a failed refetch
        # never evicts the previous tree.
        extracted = os.path.join(tmp, 'extracted')
        os.makedirs(extracted)
        rc = subprocess.run(
            ['tar', '-xz', '-f', tar_path, '-C', extracted], capture_output=True
        ).returncode
        if rc != 0:
            return (pack_id, 'failed', None, 'tar')
        staged = os.path.join(tmp, 'staged')
        os.makedirs(staged)
        for root, _dirs, files in os.walk(extracted):
            for name in files:
                if not name.lower().endswith(INCLUDES):
                    continue
                fp = os.path.join(root, name)
                # Tarballs ship symlinks, sometimes broken; walk lists them
                # as files and a follow-stat raises. Links have no place in
                # the corpus either way.
                if os.path.islink(fp):
                    continue
                try:
                    if os.path.getsize(fp) > MAX_FILE_BYTES:
                        continue
                except OSError:
                    continue
                rel = os.path.relpath(fp, extracted)
                target = os.path.join(staged, rel)
                os.makedirs(os.path.dirname(target), exist_ok=True)
                shutil.move(fp, target)
        if os.path.isdir(dest):
            shutil.rmtree(dest)
        shutil.move(staged, dest)

    # Both outcomes below are *successful* fetches, so both are marked done and
    # skipped next run. Only 'failed' is retried. The distinction between them
    # is recorded in the lockfile, not inferred from an empty directory — the
    # original conflated "ships no JS" with "download failed" and called both 'ok'.
    status = 'ok' if _has_payload(dest) else 'empty'
    with open(marker, 'w', encoding='utf-8') as fh:
        fh.write(etag or '')
    return (pack_id, status, etag, '')


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
    # One pack's unexpected exception must degrade to that pack's 'failed'
    # (feeding the mass-failure gate), never kill the other 5,000 fetches.
    def fetch_guarded(entry: dict) -> tuple[str, str, str | None, str]:
        try:
            return fetch_one(entry, lock, args.frozen, args.revalidate)
        except Exception as exc:  # noqa: BLE001
            pack_id = str(entry.get('id') or '?')
            print(f'  {pack_id}: {exc!r}', file=sys.stderr)
            return (pack_id, 'failed', None, type(exc).__name__)

    with ThreadPoolExecutor(max_workers=args.workers) as ex:
        results = list(ex.map(fetch_guarded, targets))

    counts = Counter(status for _, status, _, _ in results)
    for pack_id, status, etag, _detail in results:
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

    reasons = Counter(d for _, s, _, d in results if s == 'failed' and d)
    if reasons:
        print('  why failed:', file=sys.stderr)
        for reason, n in reasons.most_common(8):
            print(f'    {reason:24} {n}', file=sys.stderr)

    drifted = counts.get('drifted', 0)
    if args.frozen and drifted:
        print(f'\n{drifted} packs drifted from the lockfile', file=sys.stderr)
        return 1
    # A failed fetch is not a clean pack. Surface it rather than caching it.
    # A few failures are ecosystem weather (deleted repos, host blips); a
    # mass failure (rate limiting, host outage) would silently shrink every
    # downstream denominator, so it fails the run instead of shipping a
    # partial corpus as if it were complete. The denominator is what this
    # run actually ATTEMPTED over the network - on an incremental run most
    # packs short-circuit as cached, and measuring against the full target
    # list would let a 100% outage of the attempted fetches pass.
    if counts.get('failed'):
        attempted = sum(
            n for status, n in counts.items()
            if status in ('ok', 'empty', 'failed', 'drifted')
        )
        print(
            f"\n{counts['failed']} of {attempted} attempted fetches failed; "
            f're-run to retry (they are not marked done and will not be '
            f'skipped)',
            file=sys.stderr,
        )
        if counts['failed'] >= 5 and counts['failed'] > 0.05 * attempted:
            print(
                f"{counts['failed']}/{attempted} attempted exceeds the 5% "
                f'mass-failure threshold - refusing to treat a partial '
                f'corpus as complete',
                file=sys.stderr,
            )
            return 1
    return 0


if __name__ == '__main__':
    raise SystemExit(main())
