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
shards combined (`summarize_matrix.py`; exit 0 PASS, 1 FAIL, 2 harness):

| criterion                           | floor     | measured baseline |
| ----------------------------------- | --------- | ----------------- |
| entry JS loads (any entry per pack) | >= 95%    | 97.4%             |
| entry files load clean              | >= 91%    | 94.1%             |
| registerNodeDef OK                  | >= 99%    | 100%              |
| every operation clean               | >= 99%    | ~100%             |
| entry-clean delta vs previous run   | >= -1.5pp | carried by cache  |

All must hold. Each floor sits under the baseline (measured over the full
1,879-pack registry, run 31563501583) so a handful of broken pack HEADs
cannot flip the verdict, while a frontend regression that breaks pack
integration craters them all at once; the delta gate catches gradual
erosion the absolute floors ignore. Before any criterion is evaluated, a
**harness gate** requires >= 50% of packs to pass the runner's self-check
(the default workflow actually materialized: floors of 6 nodes / 6 KSampler
widgets, one below today's 7/7 so a legitimate upstream workflow edit does
not read as harness degradation). Packs that hang past the test timeout or
crash the worker leave a write-ahead stub row - counted and reported,
excluded from every metric, and a majority of stubs also withholds the
verdict — below that the verdict is _withheld_ as a harness failure (exit 2) instead of emitting a false ecosystem FAIL. Shard jobs check harness
integrity only (every built spec wrote its row; vitest's own exit code is
ignored because pack code leaks unhandled rejections).

Packs execute under real timers: the matrix config assigns `setupFiles`
explicitly, keeping `vitest.setup.ts` (environment globals) and dropping
the unit suite's `vitest.timer.setup.ts` fake timers that `mergeConfig`
array-concatenation would otherwise smuggle in.

## Detection proof (counter-evidence)

`detection-proof/corpus/` is a synthetic corpus of seven packs, each broken
in exactly one measured way, plus a clean control. The
`matrix-detection-proof` job runs the real matrix over it and passes only if
`verify_detection.py` sees every channel fire with its exact poison message
AND `summarize_matrix.py` exits FAIL. Channels proven:

| poison pack              | breaks                         | detected as                      |
| ------------------------ | ------------------------------ | -------------------------------- |
| poison-load-throw        | throws at import               | `loadedOk` 0 + message (gated)   |
| poison-regdef-throw      | `beforeRegisterNodeDef` throws | `hookErrors` (app containment)   |
| poison-customnodes-throw | `registerCustomNodes` throws   | `hookErrors` (app containment)   |
| poison-op-break          | `onNodeCreated` throws         | `load`/`addNode` op errs (gated) |
| poison-serialize-throw   | `onSerialize` throws           | `serialize` op err (gated)       |
| poison-desync            | pushes an unregistered widget  | signature drift (`wn`, counts)   |
| clean-control            | nothing                        | fully clean row (specificity)    |

Two insensitivities the proof itself surfaced, kept honest here: throwing
extension hooks are CONTAINED by the app (`extensionService` catches and
logs), so they can never fail registration — the runner records the
containment signature as `hookErrors` row data instead; and the
store-vs-live widget desync comparator needs the Vue widget-store wiring,
which this happy-dom harness does not populate (`r`/`st` read `n/a`), so
mutations surface through the serialized signature rather than that
comparator.

## Read before citing any number

- **The corpus tracks pack HEADs.** Two runs weeks apart are not the same
  corpus; `corpus.lock.json` (in the run artifact) records the exact ETags a
  run measured. Snapshot it alongside any published figure.
- The deep-execution complements are the custom-node core gate (6 packs,
  hermetic) and cloud gate (~90 packs, real backend) on the E2E suite branch.
