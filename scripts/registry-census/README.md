# Registry corpus & ecosystem matrix

Weekly-refreshed local mirror of the frontend JS of every registry pack
(~5,000 packs, ~1GB), kept honest by ETag revalidation: the registry
snapshot is re-pinned (the target list — new packs only enter through it),
missing packs are fetched, and cached packs whose HEAD-ref tarball ETag
drifted are refetched (tarball ETags are commit-derived, so a changed ETag
means the pack's default branch moved).

Vendored from `Comfy-Org/ComfyUI_ECS_Compat_Check` (`compat/paths.py`,
`fetch_corpus.py`, `refresh_registry.py`), a private migration-phase
instrument slated for archival. Adapted here: all state lives under one
cacheable root (`CENSUS_ROOT`, default `.census/`, gitignored), and
`fetch_corpus.py` gains `--revalidate`. The upstream static idiom scan (L1)
is deliberately not vendored: its false-positive/negative rate was judged
too high to act on. Packs are measured by executing their code — the
ecosystem matrix — instead.

## Running locally

```bash
python3 scripts/registry-census/refresh_registry.py     # pin the registry snapshot
python3 scripts/registry-census/fetch_corpus.py         # fetch missing packs (~1GB once)
python3 scripts/registry-census/fetch_corpus.py --revalidate   # also refetch drifted packs
```

Pure stdlib; needs `curl` and `tar` on PATH.

## In CI

`.github/workflows/ci-weekly-registry-census.yaml` runs weekly and on
dispatch: corpus restored from the actions cache, registry re-pinned,
drifted packs revalidated by ETag, `corpus.lock.json` uploaded as an
artifact, cache re-saved under a lockfile-hash key (so the cache updates
exactly when a pack moves).

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

- **The corpus tracks pack HEADs.** Two runs weeks apart are not the same
  corpus; `corpus.lock.json` (in the run artifact) records the exact ETags a
  run measured. Snapshot it alongside any published figure.
- The deep-execution complements are the custom-node core gate (6 packs,
  hermetic) and cloud gate (~90 packs, real backend) on the E2E suite branch.
