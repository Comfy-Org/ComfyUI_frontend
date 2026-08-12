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

## The ecosystem matrix (execution rung)

`build_matrix.py` + `matrix_runner.ts` generate one vitest spec per
JS-shipping pack and execute its real extension code against the real
frontend runtime (registration lifecycle, a user-operation battery,
serialize/reload), one JSON row per pack. Packs with no extension JS are
skipped and reported only as a count.

**PASS criteria** — applied once by the `matrix-verdict` job over all four
shards combined (`summarize_matrix.py`, whose exit code is the verdict):

| criterion             | floor           | measured baseline |
| --------------------- | --------------- | ----------------- |
| entry JS loads clean  | >= 95%          | 97.9%             |
| registerNodeDef OK    | >= 99%          | 100%              |
| every operation clean | >= 99% of packs | ~100%             |

All three must hold. Each floor sits under the baseline so a handful of
broken pack HEADs cannot flip the verdict, while a frontend regression that
breaks pack integration craters all three at once. Shard jobs check harness
integrity only (every built spec wrote its row; vitest's own exit code is
ignored because pack code leaks unhandled rejections).

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
