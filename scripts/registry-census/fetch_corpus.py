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
    resolved to a bogus slug, fetched nothing, and scored as clean. The ref and
    subdirectory are now retained: that ref is fetched and only that subtree is
    staged, so a pack registered against a branch or a monorepo subdirectory is
    measured as the thing the registry actually points at.

Usage:
    python3 scripts/registry-census/fetch_corpus.py
    python3 scripts/registry-census/fetch_corpus.py --frozen   # drift is an error
    python3 scripts/registry-census/fetch_corpus.py --limit 50 # smoke test
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
from typing import NamedTuple

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from paths import CORPUS, LOCKFILE, registry_snapshot  # noqa: E402

# ComfyUI serves plain browser ES modules out of a pack's web directory, so
# .js/.mjs is the entire executable surface - .ts/.jsx/.tsx/.vue are build
# inputs the server never ships and the matrix never globs.
EXECUTABLE = ('.js', '.mjs')
# Text assets a module can import by relative path; absent on disk, the import
# fails and scores the pack as broken. Capped because the long tail here is
# example workflows and bundled icon sprites, not import targets.
IMPORTABLE_TEXT = ('.css', '.json', '.svg')
# Binary imports resolve to a URL and are never read, so the corpus keeps the
# path and drops the bytes. This is what makes the corpus cacheable: kept in
# full it was 6.0GB against the repo's shared 10GB budget, and run 31753242605
# lost it to eviction mid-run - three of four shards found no corpus at all.
PLACEHOLDER = ('.png', '.woff2', '.jpg', '.jpeg', '.gif', '.webp', '.ico')
MAX_FILE_BYTES = 2_000_000
MAX_TEXT_ASSET_BYTES = 262_144
# A pack that stages more than this is not a frontend extension; the budget
# bounds decompression before the per-file caps can apply.
MAX_PACK_BYTES = 33_554_432
MAX_ARCHIVE_BYTES = 134_217_728

_TREE_RE = re.compile(
    r'^(?P<owner>[^/]+)/(?P<repo>[^/]+)'
    r'(?:/(?:tree|blob)/(?P<ref>[^/]+)(?:/(?P<subdir>.*))?)?$'
)
_PACK_ID_RE = re.compile(r'[A-Za-z0-9][A-Za-z0-9._-]{0,127}')


def _host(url: str) -> str:
    u = url.strip().lower()
    u = re.sub(r'^[a-z+]+://', '', u)
    u = re.sub(r'^git@([^:]+):.*$', r'\1', u)
    return u.split('/', 1)[0].removeprefix('www.')


class Target(NamedTuple):
    slug: str
    ref: str
    subdir: str


def target_of(url: str) -> Target | None:
    """Owner/repo plus the ref and subtree a registry URL actually points at.

    `.../tree/main/custom_nodes/foo` names a subdirectory of a monorepo, not a
    repository. Resolving it to the repo and scanning everything measures a
    different pack than the one registered.
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
    return Target(
        f'{m["owner"]}/{m["repo"]}',
        m['ref'] or 'HEAD',
        (m['subdir'] or '').strip('/'),
    )


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
    """'ships executable frontend JS', not 'the directory is non-empty'.

    Placeholder assets are files too, so a byte-count test would promote a
    pack that ships only images to 'ok' and quietly widen the denominator.
    """
    return any(
        f.lower().endswith(EXECUTABLE) for _, _, fs in os.walk(d) for f in fs
    )


class Fetched(NamedTuple):
    pack_id: str
    status: str
    etag: str | None
    detail: str
    tree: str = ''


def _archive_root(extracted: str) -> tuple[str, str]:
    """The archive's single top-level directory, and its name.

    Codeload names it `<repo>-<committish>`, so for a HEAD fetch the name
    records which commit was actually measured. That is the only per-pack
    identity available without a second request per pack, and it is what makes
    a red delta diffable: 'these 31 packs moved since the last green run'.
    """
    names = os.listdir(extracted)
    if len(names) == 1 and os.path.isdir(os.path.join(extracted, names[0])):
        return os.path.join(extracted, names[0]), names[0]
    return extracted, ''


def _identity_holds(prev: dict, etag: str | None) -> bool:
    """--frozen reproduces a published corpus only if identity was recorded.

    An absent ETag on either side previously ACCEPTED the fetch and replaced
    the content, so frozen mode could silently measure different bytes than
    the run it claims to reproduce.
    """
    known = prev.get('etag')
    return bool(known) and bool(etag) and known == etag


def _write_identity(dest: str, etag: str | None, tree: str) -> None:
    with open(os.path.join(dest, '.identity'), 'w', encoding='utf-8') as fh:
        json.dump({'etag': etag or '', 'tree': tree}, fh)


def _stage(src: str, staged: str) -> bool:
    """Copy the executable surface; keep paths for everything else.

    Binary assets are imported for their URL and never read, so the path is
    all the matrix needs - staging a placeholder keeps the import resolving at
    zero bytes. Returns False if the pack blew the uncompressed budget.
    """
    budget = MAX_PACK_BYTES
    for root, _dirs, files in os.walk(src):
        for name in files:
            lo = name.lower()
            keep = lo.endswith(EXECUTABLE) or lo.endswith(IMPORTABLE_TEXT)
            if not (keep or lo.endswith(PLACEHOLDER)):
                continue
            fp = os.path.join(root, name)
            # Tarballs ship symlinks, sometimes broken; walk lists them as
            # files and a follow-stat raises. Links have no place in the
            # corpus either way.
            if os.path.islink(fp):
                continue
            try:
                size = os.path.getsize(fp)
            except OSError:
                continue
            cap = MAX_FILE_BYTES if lo.endswith(EXECUTABLE) else MAX_TEXT_ASSET_BYTES
            keep = keep and size <= cap
            target = os.path.join(staged, os.path.relpath(fp, src))
            os.makedirs(os.path.dirname(target), exist_ok=True)
            if not keep:
                open(target, 'wb').close()
                continue
            budget -= size
            if budget < 0:
                return False
            shutil.move(fp, target)
    return True


def fetch_one(
    entry: dict, lock: dict, frozen: bool, revalidate: bool = False
) -> Fetched:
    pack_id = entry['id']
    repo = entry.get('repo') or ''
    # The id becomes a directory under CORPUS and a deletion target on
    # refetch; an unvalidated '..' would resolve to the census root itself.
    if not _PACK_ID_RE.fullmatch(pack_id):
        return Fetched(pack_id, 'bad-id', None, '')
    dest = os.path.join(CORPUS, pack_id)
    marker = os.path.join(dest, '.done')
    prev = lock.get(pack_id) or {}

    target = target_of(repo)
    if not target:
        return Fetched(pack_id, 'bad-url', None, '')

    url = tarball_url(repo, target.slug, target.ref)
    if not url:
        return Fetched(pack_id, 'unsupported-host', None, '')

    # Already fetched successfully and we are not being asked to verify.
    if os.path.exists(marker) and not frozen:
        if not revalidate:
            return Fetched(pack_id, 'cached', prev.get('etag'), '', prev.get('tree', ''))
        # Cheap drift check: one HEAD request against the lockfile ETag.
        # On any HEAD failure keep the cached copy - a network blip must
        # not evict corpus. A pack with no RECORDED etag but a live one
        # refetches once to establish the record instead of pinning to its
        # first fetch forever. The cached tree stays in place until the
        # replacement is fully staged below.
        live = _head_etag(url)
        if live is None or (prev.get('etag') and live == prev['etag']):
            return Fetched(pack_id, 'cached', prev.get('etag'), '', prev.get('tree', ''))

    with tempfile.TemporaryDirectory() as tmp:
        tar_path = os.path.join(tmp, 'a.tar.gz')
        hdr_path = os.path.join(tmp, 'h.txt')
        got = subprocess.run(
            [
                'curl', '-sfL', '--max-time', '180',
                '--retry', '3', '--retry-all-errors', '--retry-delay', '2',
                '--max-filesize', str(MAX_ARCHIVE_BYTES),
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
            return Fetched(pack_id, 'failed', None, f'http {code} curl {got.returncode}')

        etag = None
        try:
            with open(hdr_path, encoding='utf-8', errors='replace') as fh:
                for line in fh:
                    if line.lower().startswith('etag:'):
                        etag = line.split(':', 1)[1].strip().strip('"')
        except OSError:
            pass

        if frozen and not _identity_holds(prev, etag):
            return Fetched(pack_id, 'drifted', etag, '')

        # Extract WITHOUT tar filter flags: --include is bsdtar-only and GNU
        # tar (ubuntu CI) errors on it, which - with the return code
        # unchecked - silently produced an empty corpus that scanned 100%
        # clean. Extract everything to a scratch dir, keep only what the
        # matrix can reach, and swap into dest only on success so a failed
        # refetch never evicts the previous tree.
        extracted = os.path.join(tmp, 'extracted')
        os.makedirs(extracted)
        rc = subprocess.run(
            [
                'tar', '-xz', '--no-same-owner', '--no-same-permissions',
                '-f', tar_path, '-C', extracted,
            ],
            capture_output=True,
        ).returncode
        if rc != 0:
            return Fetched(pack_id, 'failed', None, 'tar')

        root_dir, tree = _archive_root(extracted)
        scoped = os.path.join(root_dir, target.subdir) if target.subdir else root_dir
        if not os.path.isdir(scoped):
            return Fetched(pack_id, 'failed', None, 'subdir absent')

        staged = os.path.join(tmp, 'staged')
        os.makedirs(staged)
        if not _stage(scoped, staged):
            return Fetched(pack_id, 'failed', None, 'pack budget')
        if os.path.isdir(dest):
            shutil.rmtree(dest)
        shutil.move(staged, dest)
        _write_identity(dest, etag, tree)

    # Both outcomes below are *successful* fetches, so both are marked done and
    # skipped next run. Only 'failed' is retried. The distinction between them
    # is recorded in the lockfile, not inferred from an empty directory — the
    # original conflated "ships no JS" with "download failed" and called both 'ok'.
    status = 'ok' if _has_payload(dest) else 'empty'
    with open(marker, 'w', encoding='utf-8') as fh:
        fh.write(etag or '')
    return Fetched(pack_id, status, etag, '', tree)


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
        print(
            'run `python3 scripts/registry-census/refresh_registry.py` first',
            file=sys.stderr,
        )
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
    def fetch_guarded(entry: dict) -> Fetched:
        try:
            return fetch_one(entry, lock, args.frozen, args.revalidate)
        except Exception as exc:  # noqa: BLE001
            pack_id = str(entry.get('id') or '?')
            print(f'  {pack_id}: {exc!r}', file=sys.stderr)
            return Fetched(pack_id, 'failed', None, type(exc).__name__)

    with ThreadPoolExecutor(max_workers=args.workers) as ex:
        results = list(ex.map(fetch_guarded, targets))

    counts = Counter(r.status for r in results)
    for r in results:
        if r.status in ('ok', 'cached', 'empty'):
            entry = lock.setdefault(r.pack_id, {})
            if r.etag:
                entry['etag'] = r.etag
            if r.tree:
                entry['tree'] = r.tree
            # 'cached' is a fact about this run, not about the pack — keep the
            # ok/empty distinction the original fetch established.
            if r.status != 'cached':
                entry['status'] = r.status

    with open(LOCKFILE, 'w', encoding='utf-8') as fh:
        json.dump({'packs': lock}, fh, indent=1, sort_keys=True)

    print(f'done in {time.time() - t0:.0f}s', file=sys.stderr)
    for status, n in counts.most_common():
        print(f'  {status:18} {n}', file=sys.stderr)

    reasons = Counter(r.detail for r in results if r.status == 'failed' and r.detail)
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
