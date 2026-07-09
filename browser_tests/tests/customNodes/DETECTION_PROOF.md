# Detection Proof

How we prove the custom-node regression suite actually catches every failure
mode it claims to in [ARCHITECTURE.md](ARCHITECTURE.md). The proof is a
separate, deliberately-red pull request branched off the suite branch: each
commit breaks one surface on purpose, cites the real regression class it
recreates, and turns the custom-nodes CI check red at exactly the named tier
with the named message. (A frontend break may also trip other layers, e.g.
unit tests - that is layered coverage, not noise.) A green custom-nodes check
anywhere in that PR would mean the gate failed to catch a regression.

This replaces the earlier ad-hoc "kill-test" name. The verb is **falsify**: we
falsify each guard by breaking the thing it watches and confirming it fires.

## Why this exists

The suite's value claim is that a frontend PR can no longer silently break a
widely-installed custom-node pack. That claim is only worth as much as its
ability to go red on a real break. A green suite proves nothing on its own -
it could be green because everything works, or green because it checks nothing.
The Detection Proof PR removes that doubt: it shows, break by break, that every
tier in ARCHITECTURE.md turns red on the exact class of regression it was built
to catch, and names the offender in the failure message.

## How to read the proof PR

- **It must never merge.** Every commit is a deliberate break. A reviewer reads
  it, they do not ship it.
- **One commit per surface.** Each commit is a single-file change plus a comment
  naming the historical regression it recreates and the red it should produce.
  Check out a commit, watch the named CI check go red, read the message, move on.
- **CI is the source of truth, not a local full run.** The CI job runs the
  suite against one fresh backend on an unloaded runner, which keeps every
  execution inside its budget. A local run of the whole
  suite against a single CPU backend is not reliable for this (see
  [Honest caveat](#honest-caveat-local-full-runs-and-machine-load)); run CI, or
  run one pack locally at a time.

## Two protection modes

The gate protects against two distinct things, and the proof covers both:

- **FE-regression** - a change to _this frontend_ breaks installed packs. This
  is the primary thing the gate guards on every frontend PR. These breaks live
  in `src/`.
- **Pack-bug** - a pack itself ships a bug (or a pinned pack is bumped to a
  broken version). The gate catches these too. On CI these breaks are
  delivered the only way a frontend-repo commit can deliver them: through the
  manifest (`browser_tests/fixtures/data/customNodeManifest.json`), by
  pointing the pack's `repo`/`pin` at a fork commit that carries the bug -
  which is exactly the pinned-bump scenario the mode describes. CI clones
  every pack fresh at its pin, so editing pack files in the frontend repo
  does nothing there; direct pack-file edits only work against a local
  backend (which is how the exact reds below were captured).

Each row below is labelled with its mode.

## The correlation matrix

Every "Exact red" below is the real message captured when the break was applied
and the tier was run against a real backend - not a prediction. One scope note:
for the corpus-derived tiers (rows 4, 6, 9) the named offender and pair list
are re-derived from `/object_info` each run, so a pin bump can legitimately
change WHICH pair or node the message names without weakening the catch - the
promise is the tier and the failure class, not byte-identical offender text
across pin changes. Sections refer to [ARCHITECTURE.md](ARCHITECTURE.md).

| #   | Surface (ARCH section)                           | Mode | Real regression it recreates                                                                                                          | The one-file break                                                                                                                                                                     | CI check that catches it                   | Exact red                                                                                                   |
| --- | ------------------------------------------------ | ---- | ------------------------------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------ | ----------------------------------------------------------------------------------------------------------- |
| 1   | Mount completeness, canvas / v1 (s1, s5)         | FE   | A change dropping declared parts on the canvas renderer (class; no single ticket - the v2 wave below shows how this family presents)  | `src/services/litegraphService.ts` `addInputs`: stop materializing the last declared input                                                                                             | Tests Custom Nodes / mount tier            | `BatchCount+: instance is missing declared input "batch" (litegraph)`                                       |
| 2   | Mount completeness, DOM / v2 (s1, s5)            | FE   | Widgets missing under Nodes 2.0 (FE-627/FE-634 iTools buttons; FE-841 is the adjacent wrong-style class, present but unproven caught) | `src/renderer/extensions/vueNodes/widgets/registry/widgetRegistry.ts`: drop the `int` widget component mapping                                                                         | Tests Custom Nodes / mount tier (Vue pass) | `Ideogram4PromptBuilderKJ: Vue mounts 9 of 15 widgets`                                                      |
| 3   | Persistence, save/reload (s1, s8)                | FE   | Widgets reverting to socket-only on reload: the defaultInput migration regression that PR #12279 (open) exists to fix                 | `src/lib/litegraph/src/LGraphNode.ts` `configure`: off-by-one drops the last `widgets_values` entry                                                                                    | Tests Custom Nodes / persistence tier      | `Seed (rgthree): widgets_values [1,"fixed"] -> [1,"randomize"] on set-values reload`                        |
| 4   | Wiring - type compatibility (s5, s6)             | FE   | A frontend change narrowing connectable types (class; no single verified ticket)                                                      | `src/lib/litegraph/src/LiteGraphGlobal.ts` `isValidConnection`: reject IMAGE links                                                                                                     | Tests Custom Nodes / connectivity sweep    | `AddLabel.IMAGE -> FastPreviewBatch.input: CONNECT_REJECTED` (full pair list)                               |
| 5   | Wiring - drop resolution (s5)                    | FE   | Drag/slot resolution family (nearest reported symptoms: FE-625/FE-632 EditUtils connections shift after drag)                         | `src/lib/litegraph/src/canvas/measureSlots.ts` `getNodeInputOnPos`: return undefined                                                                                                   | Tests Custom Nodes / connectivity drag     | `EmptyImage.IMAGE -> ImageBatch.image2 with VueNodes=false`                                                 |
| 6   | Execution - frontend prompt serialization (s7)   | FE   | A prompt-serialization change corrupting inputs (class; no single verified ticket)                                                    | `src/utils/executionUtil.ts`: drop numeric widget values from the API prompt                                                                                                           | Tests Custom Nodes / curated run (T1)      | `Prompt outputs failed validation; ImpactInt: value; ImpactFloat: value`                                    |
| 7   | Zero-visible-errors / load hook (s1)             | FE   | An extension hook crashing on graph load, the mechanism packs hook (FE-751 class; the break is in a core extension, hence FE mode)    | `src/composables/node/useNodeBadge.ts` `afterConfigureGraph`: throw                                                                                                                    | Tests Custom Nodes / curated run (T1)      | `Error calling extension 'Comfy.NodeBadge' method 'afterConfigureGraph' ...`                                |
| 8   | Console / pageerror ledger (s10)                 | Pack | An uncaught pack-JS error during save/reload (the betterCombos.js `typeof null` bug this suite found)                                 | manifest pin swap: point ComfyUI-Custom-Scripts at a fork commit whose `showText.js` logs a `console.error` in `onConfigure` (captured locally by editing the installed pack directly) | Tests Custom Nodes / curated run (T1)      | `console errors during curated run` + the exact text + script URL                                           |
| 9   | Execution - runtime (s7)                         | Pack | A pack node raising at execution (WAS Text Find/Replace infinite loop; KJ ImageGridtoBatch min violation)                             | manifest pin swap: point was-node-suite at a fork commit whose `return_constant_number` raises (captured locally by editing the installed pack directly)                               | Tests Custom Nodes / auto-run tier         | `Constant Number: EXECUTION_ERROR (Constant Number: ValueError) - not in cannotRunAlone; a regression, ...` |
| 10  | Registration / expectedNodes sentinels (s5, s10) | Pack | A pinned pack bump renaming a node key                                                                                                | manifest pin swap: point ComfyUI-Impact-Pack at a fork commit that renames the `ImpactInt` mapping key (captured locally by editing the installed pack directly)                       | Tests Custom Nodes / zero-skip gate        | job goes red on `skipped != 0` (T0 + T1 skip; the workflow's "Forbid skipped tests" step fails)             |

### Links of various types (surface 4/5 expanded)

"Links of various types" is covered breadth-first: the connectivity tier
plans one representative typed edge per slot across the whole installed corpus,
so a single break in the validator (#4) fails a broad, named list of concrete
pairs - not one hand-picked wire. The drag break (#5) additionally proves the
_pointer_ path resolves the exact slot. To show breadth explicitly, the proof PR
can add two more validator mutations, each turning a different link class red:

- Break the COMBO option-vocabulary compare (`vocabOf`) - the committed pure
  specs (typePairing.pure.spec.ts, same-vocabulary pairing tests) go red;
  dropdown slots are checked, not just primitive types.
- Break the wildcard exclusion (`isWildcard`) - the committed pure specs
  ("wildcard slots are excluded" test) go red; the exclusion is pinned as a
  design decision, not an accident. Both catches are at the pure-spec layer;
  whether the live corpus also exercises them per run is not asserted here.

### Execution of various types (surface 6/7/9 expanded)

Three distinct execution break-points, each caught by a different tier:

- **Frontend serialization** (#6) - the value never leaves the browser correctly;
  caught at submit as a named `VALIDATION_FAIL`.
- **Load-time hook** (#7) - an extension hook crashes the graph load (the same
  hook mechanism pack scripts use); caught by the console/pageerror ledger.
- **Backend runtime** (#9) - the node runs and raises; caught by the auto-run
  tier's two-way baseline, which isolates each node (single-node re-run) so
  the failing node names itself; a chain that fails because its synthesized
  producer raised still carries that producer's name in the backend's error
  event.

## What is already proven (the falsification pass)

Before writing this plan, every break in the matrix was applied one at a time
against a real backend and the tier was confirmed to catch and name it. That is
where the "Exact red" column comes from. Two of those runs also corrected the
suite itself, and those fixes are already committed on the suite branch:

- **Drag drop-resolution (#5)** was originally a _miss_: the curated drag test
  only targeted first-slot inputs, and a broken drop resolver falls back to the
  first compatible input (LinkConnector's drop-on-node path), so such a
  regression could not fail a first-slot-only pair. Fixed by adding the
  second-slot anchor (`EmptyImage.IMAGE -> ImageBatch.image2`); the matrix red
  above is from the fixed test.
- **Curated-run failure naming (#6)** originally reported `{}` for a backend
  validation rejection. Fixed by capturing and flattening the backend
  `node_errors`; the matrix now shows the named nodes and input.
- **Boot-time console noise** was confirmed out of the ledger's window by
  design (documented in ARCHITECTURE.md section 10 and README), backstopped by
  the startup zero-visible-errors check.

## Honest caveat: local full runs and machine load

All tests share ONE backend, locally and on CI alike (the CI job is
deliberately unsharded), and the suite enforces per-test backend isolation
itself: every test's
afterEach drains the backend to idle (`drainBackendToIdle`), the auto-run tier
waits out a still-draining prior execution instead of hard-failing, and the
non-executing tiers filter a foreign execution's async console lines
(`isForeignExecutionNoise`). This fixed the cross-test bleed class outright: a
test can no longer leave work running for the next test to inherit, and the
mount/persistence/wiring tiers no longer catch a neighbor's execution errors.

What remains genuinely load-sensitive is execution TIMING, not isolation: on a
machine that is busy with other work, slow CPU nodes can exceed even the raised
budgets (20s batch, 60s single re-run), which flips their classification and
trips the two-way cannotRunAlone baseline. That is the baseline doing its job
against an environment that changed under it, not a suite defect. Therefore:

- Use **CI** as the pass/fail oracle for the Detection Proof (a fresh backend
  on an unloaded runner, every run).
- A local full run is meaningful on an otherwise-idle machine; do not run it
  concurrently with heavy local work and expect baseline-exact results.

## Building the proof PR

1. Branch off the suite branch: `git checkout -b nathaniel/detection-proof nathaniel/custom-node-e2e-suite`.
2. For the three Pack-mode rows, first publish the broken fork commits (one
   fork per pack, each a one-line change matching its row); the demo commit in
   this repo is then the manifest `repo`/`pin` edit pointing at that fork. The
   FE-mode rows need no forks - their break is a direct `src/` edit.
3. One commit per matrix row, each a single-file break. FE-mode rows carry an
   inline comment in the changed `src/` file:
   `// DETECTION PROOF: recreates <FE-xxx / PR #12279> - <surface>. Expected: custom-nodes check red at <tier>.`
   Pack-mode rows change only the JSON manifest, which cannot carry a comment
   (a `//` line would break both the CI jq install loop and the loader's
   JSON.parse), so their provenance lives in the commit message per step 4.
4. Commit message names the surface and the reference, e.g.
   `demo(detection): break Vue widget mount (recreates FE-627/FE-634) - expect mount tier red`.
5. Open the PR against the suite branch (not main) with the correlation matrix as
   the description and a bold header: **This PR must never merge. Every commit is
   a deliberate break; green would mean the gate missed a regression.**
6. Let CI run. Each commit turns its named check red at the named tier. The
   reviewer bisects commit-by-commit to correlate break -> catch.

## References

- Linear "Custom Node Bugs" project issues (symptoms): FE-841, FE-627, FE-634,
  FE-630, FE-637, FE-629, FE-625, FE-632, FE-751, FE-489, FE-491, FE-492.
- The defaultInput migration regression (widgets revert to socket-only on reload) and its open fix: Comfy-Org/ComfyUI_frontend #12279.
- Suite-discovered bugs with no upstream ticket yet (betterCombos `typeof null`,
  WAS infinite-loop, WAS pip-install-in-execute, KJ ImageGridtoBatch min) are
  pending upstream filing.
