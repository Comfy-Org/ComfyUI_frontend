# Registry corpus & ecosystem matrix

A PR gate that executes the frontend JS of every registry pack (~5,100 packs)
against the commit under review and gates on the population result.

Vendored from `Comfy-Org/ComfyUI_ECS_Compat_Check` (`compat/paths.py`,
`fetch_corpus.py`, `refresh_registry.py`), a private migration-phase
instrument slated for archival. Adapted here: all state lives under one
cacheable root (`CENSUS_ROOT`, default `.census/`, gitignored), and
`fetch_corpus.py` gains `--revalidate`. The upstream static idiom scan (L1)
is deliberately not vendored: its false-positive/negative rate was judged
too high to act on. Packs are measured by executing their code — the
ecosystem matrix — instead.

## The corpus

Only the executable surface is kept: `.js` / `.mjs`, plus the text assets a
module can import by relative path (`.css`, `.json`, `.svg`, capped at 256KB
each). Binary assets are staged as **empty placeholders at the same path** —
an image import resolves to a URL that is never read, so the path is all the
matrix needs. `.ts` / `.jsx` / `.tsx` / `.vue` are build inputs ComfyUI never
serves and the matrix never globs, so they are not fetched at all.

That is what makes the corpus cacheable: **~0.9GB on disk, ~0.32GB
compressed**. Keeping every asset byte put it at 6.0GB against the repo's
shared 10GB Actions budget, which evicted itself mid-run — run 31753242605
saved the entry, shard 2 restored it, and shards 1/3/4 found no corpus at
all.

## Pins — read this before wondering why a pack looks stale

`corpus.pins.json` is **checked in** and names the exact commit of every pack
the matrix measures. The fetch uses those commits, not `HEAD`.

This is the difference between a PR gate and a liability. Tracking pack HEADs
makes every one of ~5,100 pack authors a committer to this repo's CI: one of
them pushes a bug at 3am and the next unrelated PR goes red for it, and the
person who has to work that out is whoever opened it. Pinned, a pack can only
change through a reviewed bump.

**Bumping is manual, and currently the only thing keeping the pins honest.**

- Workflow: [`update-corpus-pins.yaml`](https://github.com/Comfy-Org/ComfyUI_frontend/actions/workflows/update-corpus-pins.yaml) (`workflow_dispatch`) — resolves every
  pack, opens a PR, and summarizes what moved.
- Locally: `python3 scripts/registry-census/fetch_corpus.py --write-pins`

**A red `CI: Ecosystem Matrix` on a pin-bump PR means the ecosystem moved, not
that the diff broke something.** That is what the bump PR is for. Anywhere
else, a red means the diff. Keeping those two apart is the whole point.

Every matrix run opens with a `pin-status` job printing the pin date, the age,
and the bump URL, and raises a `::warning::` annotation once the pins are more
than **30 days** old. It does not fail the build — a stale-pin failure would
block everyone for something nobody's PR caused — but it is the loudest thing
in the run, because a stale corpus is the one defect this instrument cannot
detect from the inside. Everything stays green while the ecosystem it claims
to measure moves on without it.

Packs registered since the last bump have no pin and track their registry ref
until the next one, rather than dropping out of the population.

Each pack's tarball ETag and the ref actually fetched are recorded in
`corpus.lock.json`, which ships as a run artifact — that is the identity a
published figure has to be cited with, and diffing two runs' lockfiles gives
you the packs that moved between them.

## Running locally

```bash
python3 scripts/registry-census/pins.py                 # how old is the corpus
python3 scripts/registry-census/refresh_registry.py     # re-pin the registry snapshot
python3 scripts/registry-census/fetch_corpus.py         # fetch at the pinned commits
python3 scripts/registry-census/fetch_corpus.py --limit 50      # smoke test
python3 scripts/registry-census/fetch_corpus.py --write-pins    # bump the pins
python3 -m unittest discover -s scripts/registry-census         # verdict unit tests
```

Pure stdlib; needs `curl` and `tar` on PATH.

## In CI

`.github/workflows/ci-ecosystem-matrix.yaml`. **Corpus freshness is a
push-to-main concern, not a PR concern:**

| event          | corpus                                         | metrics              |
| -------------- | ---------------------------------------------- | -------------------- |
| `push` to main | fetched at the pinned commits, cache **saved** | baseline **written** |
| `pull_request` | main's cached corpus, restored as-is           | baseline **read**    |

Both sides measure the same packs — the pins guarantee it across cache
evictions, the restore-without-refetch guarantees it within a run — so a red
delta is attributable to the diff rather than to a pack that moved. Actions
cache scoping also means only a default-branch run can produce an entry other
branches restore, so a PR never writes one.

## The ecosystem matrix (execution rung)

`build_matrix.py` + `matrix_runner.ts` generate one vitest spec per
JS-shipping pack and execute its real extension code against the real
frontend runtime (registration lifecycle, a user-operation battery,
serialize/reload), one JSON row per pack, sharded 4 ways. Packs with no
extension JS are skipped and reported only as a count.

### What the harness drives, and what it does not

This is the scope of every number below. `ComfyApp.setup()` non-null-asserts
five DOM elements and needs a 2D canvas context, so the real boot cannot run
under happy-dom and the lifecycle is simulated.

| extension hook                                                                                                                                                                                                                                                 | driven                      |
| -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | --------------------------- |
| `beforeRegisterNodeDef`                                                                                                                                                                                                                                        | yes, via `registerNodeDef`  |
| `registerCustomNodes`                                                                                                                                                                                                                                          | yes                         |
| `onNodeCreated`, `onSerialize`, `onConfigure`, `onConnectionsChange`                                                                                                                                                                                           | indirectly, via the battery |
| `init`, `setup`, `addCustomNodeDefs`, `beforeRegisterVueAppNodeDefs`, `beforeConfigureGraph`, `loadedGraphNode`, `afterConfigureGraph`, `refreshComboInNodes`, `onNodeOutputsUpdated`, `getCanvasMenuItems`, `getNodeMenuItems`, `getSelectionToolboxCommands` | **no**                      |

The order also differs from the app. Real order is `init` →
`addCustomNodeDefs(defs)` → `registerNodeDef` → `registerCustomNodes` →
`setup` (`src/scripts/app.ts`). Here `registerNodeDef` runs first against a
hardcoded set of defs, so a pack that mutates `defs` in `addCustomNodeDefs`
has that mutation discarded before the defs it meant to change are
registered.

**Consequences to read every green run against:** a pack whose only code path
is `setup(app)` — `api.addEventListener`, patching `LGraphCanvas.prototype`,
wrapping `app.graphToPrompt`, adding canvas menus — scores as a fully clean
row. A green matrix did not catch a `setup`-dispatch regression, and cannot.

### PASS criteria

Applied once by the `matrix-verdict` job over all four shards combined
(`summarize_matrix.py`; exit 0 PASS, 1 FAIL, 2 harness/withheld):

| criterion                                 | floor     | measured baseline |
| ----------------------------------------- | --------- | ----------------- |
| entry JS loads (any entry per pack)       | >= 95%    | 97.4%             |
| entry files load clean                    | >= 91%    | 94.1%             |
| `registerNodeDef` OK                      | >= 99%    | 100%              |
| `registerCustomNodes` OK                  | >= 99%    | 100%              |
| packs free of contained hook errors       | >= 98%    | 99.25%            |
| rows complete (no hang or crash)          | >= 98%    | ~100%             |
| every operation clean (`err` OR `desync`) | >= 99%    | 99.8%             |
| entry-clean delta vs baseline             | >= -1.5pp | carried by cache  |

All must hold. Each floor sits under the baseline so a handful of broken pack
HEADs cannot flip the verdict, while a frontend regression that breaks pack
integration craters them all at once; the delta gate catches gradual erosion
the absolute floors ignore.

**Withheld (exit 2), evaluated before any criterion:**

- fewer than `MATRIX_EXPECT_SHARDS` shard manifests, or a manifest/row
  identity mismatch. Every criterion is a ratio, so three of four shards
  produce a perfectly plausible number — and on PASS that partial population
  would be saved as the baseline the next run is measured against.
- fewer than 50% of packs pass the runner's self-check (the default workflow
  actually materialized: floors of 6 nodes / 6 KSampler widgets, one below
  today's 7/7 so a legitimate upstream workflow edit does not read as harness
  degradation).
- a strict majority of rows are incomplete stubs.

Incomplete stub rows (packs that hung past the test timeout or crashed the
worker) are excluded from the other criteria's denominators, but the stub
rate is itself a **gating** criterion — `rows complete >= 98%` FAILs the run.
Only a strict majority withholds it as a harness failure. Shard jobs check
harness integrity only (every built spec wrote its row; vitest's own exit
code is ignored because pack code leaks unhandled rejections).

**Telemetry, recorded but never gating:** `newTypes`, `driveTypes`, per-op
`sig` / `depr`, extension counts, no-JS skip counts. The report labels these
explicitly. A number that is printed is not thereby a number that gates.

Packs execute under real timers: the matrix config assigns `setupFiles`
explicitly, keeping `vitest.setup.ts` (environment globals) and dropping
the unit suite's `vitest.timer.setup.ts` fake timers that `mergeConfig`
array-concatenation would otherwise smuggle in.

### Environment

| var                    | used by            | meaning                                            |
| ---------------------- | ------------------ | -------------------------------------------------- |
| `CENSUS_ROOT`          | all                | state root, default `.census/`                     |
| `MATRIX_OUT`           | runner, summarizer | directory of per-pack row JSON                     |
| `MATRIX_PREV`          | summarizer         | baseline metrics to compare against                |
| `MATRIX_METRICS_OUT`   | summarizer         | where to write metrics on PASS                     |
| `MATRIX_RUN_ID`        | summarizer         | skips the delta when the baseline is this same run |
| `MATRIX_EXPECT_SHARDS` | summarizer         | required manifest count; unset disables the check  |
| `MATRIX_STALE_MARKER`  | summarizer         | path to `registry-stale.json`, if present          |

## Security posture

**This is the repo's first CI job that executes third-party code by design.**
The rules are load-bearing, not incidental:

- **No secret may ever be added to a pack-executing job.** `ecosystem-matrix`
  and `matrix-detection-proof` run unreviewed code from ~5,100 repositories.
  Adding a Slack webhook, a token, or `id-token: write` to either job hands
  that credential to every pack author in the registry. If you need to
  notify on failure, do it from a separate `workflow_run` job.
- **`persist-credentials: false`** on those jobs' checkouts, so no usable git
  credential is left on disk for pack code to find.
- **`node_cache: 'false'`** on those jobs' `setup-frontend`. `actions/setup-node`
  registers a post step that writes the pnpm store _after_ the job body has
  executed pack code, and the same lockfile-derived key is restored by
  `release-npm-types.yaml`, `publish-design-system.yaml` and
  `release-pypi-dev.yaml`, which hold `NPM_TOKEN`, `PYPI_TOKEN` and
  `id-token: write`. Opting out removes the only write path out of the job.
- **The corpus fetch holds a token; pack execution does not.** They are
  separate jobs for that reason, and `corpus` stays at `contents: read` so it
  cannot also prune caches.

**Accepted, and worth stating plainly:** pack code runs as `runner` with full
Node `fs` / `child_process` / network access. The global `fetch` guard is not
a sandbox — pack code can import `node:http` or replace globals. All packs in
a shard share one output directory. Rows carry a `pack` field and are written
under a pack-derived filename, and the verdict job checks manifest-vs-row
identity, but the instrument is **not integrity-protected against the
population it measures**. A green run is evidence about the population; it is
not evidence about any specific pack. The containment that matters is that
the runner is ephemeral and tokenless.

## Runbook

The gate is red. In order:

1. **Exit 2 — verdict withheld.** This is a harness failure, not an ecosystem
   result. Read the banner: short population (a shard died — check the
   `vitest-shard.log` in that shard's artifact), self-check floor (the default
   workflow stopped materializing — usually `browser_tests/assets/default.json`
   changed), or stub majority. Nothing about the ecosystem has been measured.
   Re-run; if it reproduces, it is a harness bug and blocks nothing else.
2. **Exit 1 — verdict FAIL.** Read which criterion breached, in the step
   summary. Then distinguish the two causes:
   - **The diff.** Compare against the baseline run on main. Same corpus by
     construction, so a criterion that moved is attributable to the diff.
     Fix or justify.
   - **Pack churn.** Only possible if the corpus was refetched — i.e. on a
     main run. `corpus.lock.json` in the run artifact records each pack's
     ETag and tree; diff it against the last green run's to get the list of
     packs that moved.
3. **`matrix-detection-proof` is red.** Treat this as more serious than a
   FAIL. It means a measurement channel stopped firing, so every _green_
   matrix run since the change is worth less than it appeared. Do not
   silence it.

**Blast radius:** the matrix is a PR gate but is **not currently a required
check** — `ProtectMain` requires `test`, `lint-and-format`, `e2e-status` and
`website-e2e`. Until it is added there, a red matrix informs but does not
block.

## Detection proof (counter-evidence)

`detection-proof/corpus/` is a synthetic corpus of six poison packs, each
broken in exactly one measured way, plus three clean controls. The
`matrix-detection-proof` job runs the real matrix over it and passes only if
`verify_detection.py` sees every channel fire with its exact poison message
**and** breach the criterion it targets, AND `summarize_matrix.py` exits
FAIL. Asserting only that the combined verdict went red would certify a
channel as "fired" while it contributed nothing to the gate.

| pack                     | breaks                         | detected as                      |
| ------------------------ | ------------------------------ | -------------------------------- |
| poison-load-throw        | throws at import               | `loadedOk` 0 + message (gated)   |
| poison-regdef-throw      | `beforeRegisterNodeDef` throws | `hookErrors` (app containment)   |
| poison-customnodes-throw | `registerCustomNodes` throws   | `hookErrors` (app containment)   |
| poison-op-break          | `onNodeCreated` throws         | `load`/`addNode` op errs (gated) |
| poison-serialize-throw   | `onSerialize` throws           | `serialize` op err (gated)       |
| poison-desync            | pushes an unregistered widget  | signature drift (`wn`, counts)   |
| clean-control            | nothing                        | fully clean row (specificity)    |
| clean-mjs-control        | nothing                        | `.mjs` entry loads (glob cover)  |
| clean-asset-control      | nothing                        | css/json import resolves         |

Insensitivity kept honest here: throwing extension hooks are CONTAINED by the
app (`extensionService` catches and logs), so they can never fail
registration — the runner records the containment signature as `hookErrors`
row data instead, and that is now gated.

## Read before citing any number

- **The corpus tracks pack HEADs.** Two runs weeks apart are not the same
  corpus; `corpus.lock.json` (in the run artifact) records the exact ETags
  and trees a run measured. Snapshot it alongside any published figure.
- **The scope is the hook table above**, not "extension compatibility".
- **A green run is evidence about the population, not about a pack.**
- The deep-execution complements are the custom-node core gate (6 packs,
  hermetic) and cloud gate (~90 packs, real backend) on the E2E suite branch.
