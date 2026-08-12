# Registry census

Full-registry breadth radar for the custom-node ecosystem: fetches the
frontend JS of every registry pack (~5,000 packs, ~1GB) and scans it for the
empirically-confirmed compatibility-breaking idioms, reporting population
counts weighted by downloads.

Vendored from `Comfy-Org/ComfyUI_ECS_Compat_Check` (`compat/paths.py`,
`fetch_corpus.py`, `scan_registry.py`, `refresh_registry.py`), which is a
private migration-phase instrument slated for archival. Adapted here: all
state lives under one cacheable root (`CENSUS_ROOT`, default `.census/`,
gitignored), and `fetch_corpus.py` gains `--revalidate` (per-pack tarball
ETag HEAD-check against `corpus.lock.json`; only drifted packs refetch).

## Running locally

```bash
python3 scripts/registry-census/refresh_registry.py     # pin the registry snapshot
python3 scripts/registry-census/fetch_corpus.py         # fetch missing packs (~1GB once)
python3 scripts/registry-census/fetch_corpus.py --revalidate   # also refetch drifted packs
python3 scripts/registry-census/scan_registry.py        # the census (~50s warm)
```

Pure stdlib; needs `curl`, `tar`, and GNU-compatible `grep` on PATH.

## In CI

`.github/workflows/ci-weekly-registry-census.yaml` runs weekly and on
dispatch: corpus restored from the actions cache, registry re-pinned, drifted
packs revalidated by ETag, scan output in the run's Summary panel, results
uploaded as an artifact, cache re-saved under a lockfile-hash key (so the
cache updates exactly when a pack moves).

## Read before citing any number

- **Static analysis.** It labels code, not outcomes, and carries the regex
  false-positive rate. Radar, never a gate.
- **Sensitivity is unmeasured.** "N packs clean" means the scan matched
  nothing, with the scan's own detection rate unknown.
- **The corpus tracks pack HEADs.** Two runs weeks apart are not the same
  corpus; `corpus.lock.json` (in the run artifact) records the exact ETags a
  run measured. Snapshot it alongside any published figure.
- The deep-execution complements are the custom-node core gate (6 packs,
  hermetic) and cloud gate (~90 packs, real backend) on the E2E suite branch.
