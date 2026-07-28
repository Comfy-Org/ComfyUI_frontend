# Detection Proof

How we prove the custom-node regression suite actually catches every failure
mode it claims to in [ARCHITECTURE.md](ARCHITECTURE.md). The proof is a
separate, never-merge pull request branched off the suite branch whose CI job
is a matrix: **one leg per matrix row, each leg applying exactly one break to
an otherwise-clean tree**, running the whole suite, and then asserting that
the suite redded with that row's own class-stable message. Isolation is the
point: with one break live per leg, every red is attributable to its break,
and no break can mask, starve, or be shaped around another. (A frontend break
may also trip other layers, e.g. unit tests - that is layered coverage, not
noise.)

Leg semantics: the suite run inside a leg is EXPECTED to fail; the leg's final
assert step is the verdict. **Leg green = the break was caught with its
promised red. Leg red = the proof failed** - either the suite missed the break,
or it redded with an unattributable message, or the patch no longer applies
(which fails loudly rather than running a clean tree and faking a catch).

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

- **It must never merge.** The branch carries the break patches and the matrix
  workflow. A reviewer reads it, they do not ship it.
- **One patch file per surface.** Each src-mode row is a checked-in patch under
  `detection-proof/row-NN-*.patch` naming the historical regression it
  recreates and the red it should produce; each pack-mode row is one fenced
  case in the workflow's pack-break step. The tree itself carries ZERO live
  breaks - a break exists only inside the one CI leg that applies it. Open a
  leg, read its assert step's verdict, move on.
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
  broken version). The gate catches these too. CI clones every pack fresh at
  its pin, so editing pack files in the frontend repo does nothing - the clone
  overwrites them. Two ways deliver a pack break on CI: (a) point the manifest
  (`browser_tests/fixtures/data/customNodeManifest.core.json`) `repo`/`pin` at a
  broken fork, which is exactly the pinned-bump scenario and the most
  production-faithful; or (b) a self-contained CI step that patches each cloned
  pack in place right after install. The proof PR uses (b) - no external repos,
  and each patch asserts it landed (`grep`, fails the job otherwise) so a silent
  no-op cannot fake a pass. Both reproduce the same edits captured against a
  local backend (which is how the exact reds below were captured).

Each row below is labelled with its mode.

## The correlation matrix

Every "Exact red" below is the real message captured when the break was applied
and the tier was run against a real backend - not a prediction. The canonical
per-row evidence is the matrix leg: one CI leg per row, one break live in that
leg, the leg's assert step requiring the row's class-stable message. Earlier
captures (from the retired stacked design, or the two one-off isolated
branches for rows 12/13) remain quoted where the message text is instructive,
but a stacked capture is NOT attribution evidence - only a leg is. One scope
note:
for the corpus-derived tiers (rows 2, 3, 4, 6, 9) the named offender and pair
list are re-derived from `/object_info` each run, so a pin bump can legitimately
change WHICH pair or node the message names without weakening the catch - the
promise is the tier and the failure class, not byte-identical offender text
across pin changes. Rows 2 and 3 name rgthree-comfy, which left the manifest in
PR #13389: those two captures are historical and re-running the break now names
a node from a currently installed pack instead. Row 11 names SplineEditor, since
ledgered in `GEOMETRY_UNSTABLE_NODES` and excluded from measurement, so that
capture is historical too; the geometry tier's live coverage is the remaining
baselined nodes.

Sections refer to [ARCHITECTURE.md](ARCHITECTURE.md).

**Proof run:** matrix run
[30318248639](https://github.com/Comfy-Org/ComfyUI_frontend/actions/runs/30318248639) -
legs 1-13 green with in-log catch verdicts for rows 1-13. Row 14's leg in
that run is RETIRED as evidence: its green came from the pattern matching a
source snippet embedded in the results file, not a real compare message
(the assert has since been hardened to match failure MESSAGES only, via jq,
for every row). Row 14's valid evidence is the next matrix run after that
hardening. Row N's evidence is its own leg, job
`custom-nodes-e2e-core (N)`: the suite's red (with the row's message) is in
that leg's "Run custom-node suite" log, and the leg's assert step quotes the
matched pattern. Every push to this branch re-runs the whole matrix, so the
proof is repeatable, not archival.

| #   | Surface (ARCH section)                           | Mode | Real regression it recreates                                                                                                                                                                                                       | The one-file break                                                                                                                                                                                                            | CI check that catches it                   | Exact red                                                                                                                                                       |
| --- | ------------------------------------------------ | ---- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------ | --------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 1   | Mount completeness, canvas / v1 (s1, s5)         | FE   | A change dropping declared parts on the canvas renderer (class; no single ticket - the v2 wave below shows how this family presents)                                                                                               | `row-01` patch: `src/services/litegraphService.ts` `addInputs` stops materializing the last declared input, for every node                                                                                                    | Tests Custom Nodes / mount tier            | `ImpactBoolean: instance is missing declared input "value" (litegraph)`                                                                                         |
| 2   | Mount completeness, DOM / v2 (s1, s5)            | FE   | Widgets missing under Nodes 2.0 (FE-627/FE-634 iTools buttons; FE-841 is the adjacent wrong-style class, present but unproven caught)                                                                                              | `src/renderer/extensions/vueNodes/composables/useProcessedWidgets.ts`: skip numeric widgets in the Vue processing pipeline (see the registry self-heal note below)                                                            | Tests Custom Nodes / mount tier (Vue pass) | `Image Inset Crop (rgthree): Vue mounts 1 of 5 widgets`                                                                                                         |
| 3   | Persistence, save/reload (s1, s8)                | FE   | Widgets reverting to socket-only on reload: the defaultInput migration regression that PR #12279 (open) exists to fix                                                                                                              | `src/lib/litegraph/src/LGraphNode.ts` `configure`: off-by-one drops the last `widgets_values` entry                                                                                                                           | Tests Custom Nodes / persistence tier      | `Image Inset Crop (rgthree): widgets_values ["Percentage",8,8,8,8] -> ["Percentage",8,8,8,0] on set-values reload`                                              |
| 4   | Wiring - type compatibility (s5, s6)             | FE   | A frontend change narrowing connectable types (class; no single verified ticket)                                                                                                                                                   | `src/lib/litegraph/src/LiteGraphGlobal.ts` `isValidConnection`: reject IMAGE links                                                                                                                                            | Tests Custom Nodes / connectivity sweep    | `AddLabel.IMAGE -> FastPreviewBatch.input: CONNECT_REJECTED` (full pair list)                                                                                   |
| 5   | Wiring - drop resolution (s5)                    | FE   | Drag/slot resolution family (nearest reported symptoms: FE-625/FE-632 EditUtils connections shift after drag)                                                                                                                      | `src/lib/litegraph/src/canvas/measureSlots.ts` `getNodeInputOnPos`: return undefined                                                                                                                                          | Tests Custom Nodes / connectivity drag     | `EmptyImage.IMAGE -> ImageBatch.image2 with VueNodes=false`                                                                                                     |
| 6   | Execution - frontend prompt serialization (s7)   | FE   | A prompt-serialization change corrupting inputs (class; no single verified ticket)                                                                                                                                                 | `row-06` patch: `src/utils/executionUtil.ts` drops numeric widget values from the API prompt, for every node                                                                                                                  | Tests Custom Nodes / curated run (T1)      | `Prompt outputs failed validation; ImpactInt: value; ImpactFloat: value` (offender names re-derive per run; the leg asserts the class-stable `VALIDATION_FAIL`) |
| 7   | Zero-visible-errors / load hook (s1)             | FE   | An extension hook crashing on graph load, the mechanism packs hook (FE-751 class; the break is in a core extension, hence FE mode)                                                                                                 | `src/composables/node/useNodeBadge.ts` `afterConfigureGraph`: throw                                                                                                                                                           | Tests Custom Nodes / curated run (T1)      | `Error calling extension 'Comfy.NodeBadge' method 'afterConfigureGraph' ...`                                                                                    |
| 8   | Console / pageerror ledger (s10)                 | Pack | An uncaught pack-JS error during save/reload (the betterCombos.js `typeof null` bug this suite found)                                                                                                                              | CI step patches the cloned ComfyUI-Custom-Scripts `showText.js` to log a `console.error` in `onConfigure` - where the betterCombos class actually fires                                                                       | Tests Custom Nodes / curated run (T1)      | `console errors during curated run` + the exact text + script URL                                                                                               |
| 9   | Execution - runtime (s7)                         | Pack | A pack node raising at execution (WAS Text Find/Replace infinite loop; KJ ImageGridtoBatch min violation)                                                                                                                          | CI step patches the cloned was-node-suite `return_constant_number` to raise on entry (captured locally by editing the installed pack directly)                                                                                | Tests Custom Nodes / auto-run tier         | `Constant Number: EXECUTION_ERROR (Constant Number: ValueError) - not in cannotRunAlone; a regression, ...`                                                     |
| 10  | Registration / expectedNodes sentinels (s5, s10) | Pack | A pinned pack bump renaming a node key                                                                                                                                                                                             | CI step patches the cloned ComfyUI-Impact-Pack `__init__.py` to rename the `ImpactInt` mapping key (captured locally by editing the installed pack directly)                                                                  | Tests Custom Nodes / zero-skip gate        | job goes red on `skipped != 0` (T0 + T1 skip; the workflow's "Forbid skipped tests" step fails)                                                                 |
| 11  | Layout geometry (story S14; s5)                  | FE   | The "shrinking node" class: layout moves with no error anywhere. CAUGHT LIVE, no synthetic break needed: on the tier's first compare, a real cross-run render difference redded at identical code                                  | none required - the live catch is the proof (CI runs 29842484256 record vs 29843618522 compare); the differ's remaining red paths are pinned at the pure-spec layer (`geometry.pure.spec.ts`)                                 | Tests Custom Nodes / mount tier (geometry) | `SplineEditor.litegraph.widgets[13].y: expected 915, got 920`                                                                                                   |
| 12  | Frontend extension load (story S11; s1)          | FE   | A pack's frontend JS silently fails to load - a wrong web dir, a `loadExtensions` regression - while its backend nodes stay in `/object_info`, so every JS-driven behavior vanishes and the suite would quietly test vanilla nodes | `row-12` patch: `src/services/extensionService.ts` `loadExtensions` drops `ComfyUI-KJNodes` from the import list so its JS never loads (first captured in isolation on branch `nathaniel/cap-s11`, CI run 30292373406)        | Tests Custom Nodes / mount tier (T0 load)  | `ComfyUI-KJNodes: frontend extension "KJNodes.appearance" not registered - pack JS did not load` (`customNode.regression.spec.ts:118`)                          |
| 13  | Dynamic inputs / autogrow (story S12; s1)        | FE   | A change that stops pack JS's `onConnectionsChange` autogrow override from firing on a live connect - a class no def-driven tier can see, because the behavior is invisible to `/object_info`                                      | `row-13` patch: `src/lib/litegraph/src/LGraphNode.ts` connect suppresses the live-connect INPUT `onConnectionsChange` call the pack overrides (first captured in isolation on branch `nathaniel/cap-s12`, CI run 30292391836) | Tests Custom Nodes / dynamic-inputs tier   | `ImpactMakeImageList via drag with VueNodes=false: input count grows by one on connect` (expected 2, got 1; `dynamicInputs.spec.ts:229`)                        |
| 14  | Output regression (story S15; s7)                | FE   | A serialization change that drifts widget VALUES while staying valid: validation passes, execution succeeds, every def-driven tier stays green - the class only S15 can see                                                        | `row-14` patch: `src/utils/executionUtil.ts` serializes every integer widget off by one                                                                                                                                       | Tests Custom Nodes / curated run (S15)     | `output hash changed - expected sha256:..., got sha256:...` (leg asserts the class-stable `output hash changed`)                                                |

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

## Story coverage: S1-S15 -> rows -> legs

Every story the suite claims maps to a proof surface. Row = the matrix table
above; leg = job `custom-nodes-e2e-core (row)` in the proof run.

| Stories                                                                                                                                     | Surface                                                                                                                                                                                          | Proof                                                                                      |
| ------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ | ------------------------------------------------------------------------------------------ |
| S1-S10 (mount both renderers, persistence, wiring type+drop, execution serialize/load-hook/runtime, console ledger, registration sentinels) | rows 1-10                                                                                                                                                                                        | legs 1-10                                                                                  |
| S11 frontend extension load                                                                                                                 | row 12                                                                                                                                                                                           | leg 12                                                                                     |
| S12 dynamic-input autogrow                                                                                                                  | row 13                                                                                                                                                                                           | leg 13                                                                                     |
| S13                                                                                                                                         | no written definition exists in any project artifact - the story numbering in every plan and research doc skips from S12 to S14. Recorded here so the gap is a documented fact, not an oversight | none                                                                                       |
| S14 layout geometry                                                                                                                         | row 11                                                                                                                                                                                           | no synthetic leg: caught LIVE (runs 29842484256/29843618522), the strongest possible proof |
| S15 output regression                                                                                                                       | row 14                                                                                                                                                                                           | leg 14                                                                                     |
| S16 screenshot tier                                                                                                                         | backlog, not implemented, deliberately out of scope                                                                                                                                              | none                                                                                       |

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
2. The tree stays CLEAN: `src/` is byte-identical to the suite branch. Each
   src-mode row (1-7, 12, 13) is a checked-in patch file under
   `browser_tests/tests/customNodes/detection-proof/`, carrying an inline
   comment naming the regression class and the expected red.
3. The CI job becomes a matrix (`row: [1..10, 12, 13]`, `fail-fast: false`).
   A src-mode leg applies its one patch BEFORE the frontend build and fails
   loudly if it does not apply - a silently-clean tree reporting a catch is
   the worst possible outcome. A pack-mode leg (8-10) pokes its one break
   into its cloned pack right after install, grep-asserted the same way. The
   matrix and both break steps are fenced to this never-merge branch.
4. The suite step runs `continue-on-error`; the leg's final step asserts
   (a) the suite failed and (b) that row's class-stable message is present
   in the results json (row 10 instead asserts `skipped != 0`, since its
   catch IS the forbid-skips gate). Patterns are class-stable (the assert
   text), never offender-stable (a node name): in isolation the first
   offender can differ from any earlier capture.
5. Open the PR against the suite branch (not main) with the correlation
   matrix as the description and a bold header: **This PR must never merge.
   Every leg applies a deliberate break; a red LEG means the gate missed or
   misattributed a regression.**
6. Never shape a break so it can coexist with another. That was this proof's
   original sin: with all 12 breaks stacked in one tree, breaks masked each
   other along assert order, and rows 1, 6, and 8 were distorted (node-prefix
   scoping, a moved fire-point) to survive their neighbors. Isolation makes
   every such distortion unnecessary: each break is the plain, unscoped
   version of its regression class, because nothing else is broken in its leg.
7. Budget each leg for a red run: a red retries (3x on CI) and walks failure
   paths, so `timeout-minutes` stays raised on this branch (90).

### Registry self-heal: why row 2 targets the pipeline, not the registry

The first row 2 variant deleted the `int` entry from `widgetRegistry.ts`, and
the suite rightly stayed green: `useProcessedWidgets` falls back to
`WidgetLegacy` when a registry lookup misses, so the widget row still renders
and the mount count matches (INT/FLOAT widgets are runtime type `number`,
served by the `float` entry's aliases, so the `int` entry is not even on the
standard path). The falsification falsified the break, not the suite, and
documented a real resilience property of the Vue renderer. To make a widget
row genuinely disappear (the FE-627/FE-634 class), skip it in the
`useProcessedWidgets` pipeline - the suite catches that immediately.

## References

- Linear "Custom Node Bugs" project issues (symptoms): FE-841, FE-627, FE-634,
  FE-630, FE-637, FE-629, FE-625, FE-632, FE-751, FE-489, FE-491, FE-492.
- The defaultInput migration regression (widgets revert to socket-only on reload) and its open fix: Comfy-Org/ComfyUI_frontend #12279.
- Suite-discovered bugs with no upstream ticket yet (betterCombos `typeof null`,
  WAS infinite-loop, WAS pip-install-in-execute, KJ ImageGridtoBatch min) are
  pending upstream filing.
