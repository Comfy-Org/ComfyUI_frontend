"""Path resolution for the registry census.

Vendored from Comfy-Org/ComfyUI_ECS_Compat_Check (compat/paths.py), reduced to
the census's needs. Everything lives under one root so CI can cache it as a
unit and the whole tree stays gitignored:

    <CENSUS_ROOT>/
      data/registry.json    pinned registry snapshot (refresh_registry.py)
      corpus/registry_js/   per-pack frontend JS (fetch_corpus.py, ~0.9GB)
      corpus.lock.json      per-pack tarball ETag + tree - the identity record
      corpus.ready.json     written only after the corpus meets its size floor
      registry-stale.json   present only when the snapshot is a fallback
      results/              scan outputs

CENSUS_ROOT defaults to `.census` under the current working directory; the CI
workflow and local runs both invoke from the repo root.
"""

import os

ROOT = os.path.abspath(os.environ.get('CENSUS_ROOT', '.census'))

DATA = os.path.join(ROOT, 'data')
RESULTS = os.path.join(ROOT, 'results')

CORPUS_ROOT = os.path.join(ROOT, 'corpus')
CORPUS = os.path.join(CORPUS_ROOT, 'registry_js')

LOCKFILE = os.path.join(ROOT, 'corpus.lock.json')
READY_MARKER = os.path.join(ROOT, 'corpus.ready.json')
STALE_MARKER = os.path.join(ROOT, 'registry-stale.json')


def registry_snapshot() -> str:
    """Pinned registry snapshot: the target list and download counts."""
    return os.path.join(DATA, 'registry.json')


def result(name: str) -> str:
    """Path to a result artifact, creating the directory if needed."""
    os.makedirs(RESULTS, exist_ok=True)
    return os.path.join(RESULTS, name)
