# Playwright Coverage Strategy

Research and plan for raising both code coverage and behavior coverage of the
Playwright suite without adding redundant tests or CI time.

Numbers below come from the `main` run at commit `e05e929f` (2026-09-01):
the `CI: Tests E2E` sharded job logs, the `CI: E2E Coverage Package` job log
(per-file `lines=/hit=` output), and the `CI: Tests Unit` vitest text report.
The analysis script is described in the appendix so the tables can be
regenerated.

## 1. Summary

- Coverage is already instrumented end to end for the `chromium` project and
  published to Codecov (`e2e` flag), GitHub Pages, and Slack. Nothing gates on it and
  there is no per-area view, so gaps go unnoticed.
- The headline E2E figure (68.1% of executable lines in loaded chunks) is
  incomplete. V8 coverage only sees chunks the browser actually loaded, so 457
  source files (~65k raw lines) never enter the denominator. Raw source lines
  cannot be compared with lcov's executable-line count, so the corrected
  percentage is not yet known. The `cloud`, `mobile-chrome`, `chromium-2x`, and
  `chromium-0.5x` projects do not collect coverage, so everything cloud-only
  looks worse than it is, or is invisible.
- The three cheapest wins are measurement fixes rather than new tests: collect
  coverage in supported CI projects, count never-loaded files, and report
  coverage per feature area (Codecov components). Each is a one-PR change and
  turns the existing pipeline into a gap finder.
- The largest genuine behavior gaps, ranked by user risk times uncovered code:
  workspace/billing/subscription flows, the layer editor, custom-node manager
  install/update/conflict flows, model upload, and the video edit panel. The
  litegraph canvas and legacy canvas widgets are covered by no other layer
  because the unit config excludes them.
- Redundancy to reclaim: three node-search specs with duplicated describe
  blocks, four entry points into the asset browser, and one spec that owns 62
  of the suite's 185 screenshot assertions. Consolidating those pays for the
  new tests.

## 2. How coverage is measured today

### Pipeline

| Layer       | Where collected                                                                                  | Output                                                                                           |
| ----------- | ------------------------------------------------------------------------------------------------ | ------------------------------------------------------------------------------------------------ |
| Unit        | `ci-tests-unit.yaml`, `pnpm test:coverage` (vitest, v8 provider)                                 | `coverage/lcov.info`, Codecov flag `unit`, `unit-coverage` artifact                              |
| E2E         | `ci-tests-e2e.yaml`, sharded `chromium` job only, `COLLECT_COVERAGE=true` at build and test time | Per-shard lcov via monocart (`ComfyPage.ts` `page` fixture, `globalTeardown.ts`)                 |
| E2E merge   | `ci-tests-e2e-coverage-package.yaml`, `scripts/cicd/package-e2e-coverage.sh`                     | `lcov -a` merge, `genhtml` report, `e2e-coverage` + `e2e-coverage-html` artifacts                |
| E2E publish | `ci-tests-e2e-coverage.yaml` (workflow_run)                                                      | Codecov flag `e2e`, GitHub Pages deploy on `main`                                                |
| Reporting   | `coverage-slack-notify.yaml`, `scripts/coverage-slack-notify.ts`                                 | Slack post per merged PR with unit and E2E deltas against an 80% target                          |
| Gating      | `codecov.yml`                                                                                    | Project status disabled; patch status `informational` except `apps/website`; flags carry forward |

### Current numbers (main, 2026-09-01)

| Metric                                     | Value                                                                                           |
| ------------------------------------------ | ----------------------------------------------------------------------------------------------- |
| Unit lines / statements / branches / funcs | 76.5% / 75.0% / 68.1% / 70.4%                                                                   |
| Unit test files, wall time                 | 1450 files, 17.2 min in one job                                                                 |
| E2E lines (merged, as reported)            | 68.1% (48,026 of 70,520)                                                                        |
| E2E lines, single shard                    | ~31.5% (each shard sees a third)                                                                |
| E2E spec files / `test()` calls            | 327 / 1,948 (`chromium` project: ~1,890)                                                        |
| E2E `chromium` shards                      | 16 shards x 2 workers, 6 to 10 min each                                                         |
| E2E other projects                         | `cloud` 154 tests 6.3 min; `mobile-chrome` 0.8 min; `2x`, `0.5x`, `mobile-safari` under 0.3 min |
| E2E wall clock (main push)                 | ~16 min; ~150 runner-minutes                                                                    |
| Retries in CI                              | 3 (a test may fail three times and still pass)                                                  |

### What the numbers hide

1. Never-loaded chunks are not counted. monocart converts V8 coverage for
   scripts the page fetched. Lazy chunks that no test triggers never appear in
   the lcov, so the denominator excludes them. Absent from the E2E report
   entirely: 457 `src/` files. The biggest clusters, in raw source lines:

   | Absent cluster                               | Raw lines | Files |
   | -------------------------------------------- | --------- | ----- |
   | `workbench/extensions/agent`                 | 9,567     | 65    |
   | `renderer/extensions/layerEditor`            | 8,904     | 51    |
   | `platform/workspace/components`              | 8,525     | 39    |
   | `platform/workspace/composables`             | 3,206     | 11    |
   | `platform/cloud/onboarding`                  | 3,039     | 32    |
   | `platform/telemetry/providers`               | 2,712     | 10    |
   | `platform/cloud/subscription`                | 2,141     | 16    |
   | `composables/video` + `components/videoEdit` | 2,296     | 12    |
   | `composables/boundingBoxes`                  | 1,037     | 2     |
   | `renderer/extensions/compositor`             | 788       | 8     |

   Some of these are type-only or cloud-only (see point 2). Their raw line
   count does not establish a corrected E2E percentage because lcov counts
   executable lines, not raw source lines.

2. Only the `chromium` project collects coverage. The `cloud` project runs
   154 tests against the cloud build, including the agent panel, workspace
   switcher, billing and subscription dialogs, and sign-in. None of that work
   is credited. `workspace` shows 33.9% and `auth` 26.6% in the report, and
   the agent panel shows 2 files, purely because the measuring job never runs
   those tests.

3. The litegraph canvas has one measuring layer. `vite.config.mts`
   excludes `src/lib/litegraph/src/canvas/**`, `widgets/**`, and the top-level
   `src/lib/litegraph/src/*.ts` from unit coverage. E2E is therefore the only
   coverage those 11.9k lines get, and it stands at 49.6% (canvas) and 48.3%
   (widgets). `CurveEditor`, `KnobWidget`, `ColorWidget`,
   `GradientSliderWidget`, `InputIndicators`, and `FloatingRenderLink` are at
   0 to 5%.

4. There is no per-area view: Codecov's project status is off and patch
   status is informational. The Slack post reports two global percentages. A global 68%
   cannot tell anyone that `platform/workspace` is at 34% while `vueNodes` is
   at 81%.

5. CI ignores the organizational tags: `@smoke` is applied to 46 tests and
   nothing runs it, and there is no list of the user journeys the suite
   promises to protect, so behavior coverage is unmeasured.

6. Three retries mask flakes, because a test that fails twice per run is
   still green. The `cloud` job on the analysed run had one flaky test.
   `report.json` records `flaky` outcomes, and nothing aggregates them.

## 3. Principles from the research

### Composable tests (Kent Beck)

Beck's argument: a test suite is judged as a whole on properties like
sensitivity, specificity, speed, and cost of change. Isolated tests that each
set up everything from scratch are easy to reason about but multiply. When two
dimensions are demonstrably orthogonal, test each dimension once instead of
the cross product: four interest calculations times five report formats needs
about nine tests instead of twenty. The cost is that orthogonality must be designed
and shown, and that fewer assertions per test can feel unsafe.

How this applies here:

- Widgets x renderers x node states is a cross product we currently walk
  in places. Test widget behavior once (Vue nodes, since it is the DOM
  path), test the renderer toggle once for geometry parity, and test node
  states once. Do not add a litegraph copy of every Vue-nodes widget spec.
- Feature x view mode (graph view, linear/app mode, mobile) is another
  cross product. A feature spec proves the feature; one or two view-mode
  specs prove the mode swaps the same store state in and out.
- The `legacyDoNotReplicate` folder is the right shape for compatibility
  pins: one narrow test per contract rather than a copy of the feature suite.

### Playwright best practices (playwright.dev)

The suite's README already encodes most of these. The ones that bear on
coverage strategy:

- Test user-visible behavior, not implementation. A spec that reaches into
  `window.app.graph` to mutate state and then screenshots is a weaker
  behavior test than one that clicks and asserts on visible state.
- Keep tests isolated; put shared setup in fixtures. The `comfyPage` fixture
  and page objects are the composable building blocks Beck describes.
- Mock third parties, test what you control. The typed mock tables in
  `browser_tests/README.md` are the mechanism. Cloud, billing, and manager
  flows are testable in the `chromium` project with routes, without a live
  backend.
- Use web-first assertions and `expect.poll`; never fixed waits.
- Use tags and projects to route tests, and shard by test file. Both are in
  place. A tag-selected smoke project is the missing piece.
- Prefer user-visible assertions to screenshots; use screenshots when
  appearance is the behavior.

### Code coverage versus behavior coverage

Line coverage is an execution metric. The 2026 "behavioural gaps" paper finds
that about 17.5% of expected behaviours are entirely untested, with most of
those gaps in methods that already have high line coverage. Coverage cannot
see missing assertions. Mutation testing detects assertion gaps but is far too
slow for E2E suites.
For this suite the practical translation is:

- Use E2E coverage to find **execution gaps**: areas the suite never loads
  or barely touches. The tables in section 4 are that report.
- Use a **journey inventory** to find **assertion gaps**: for each critical
  user journey, name the spec that proves it and the observable it asserts.
- Reserve mutation testing (StrykerJS) for pure, well-unit-tested modules
  where it is cheap: schema validators, workflow migration, keybinding
  parsing. It is out of scope for Playwright.

## 4. Gap inventory

E2E percentages are measured lines hit. "Absent" means the chunk never loaded
in the `chromium` project, so nothing was measured. Unit percentages are per
directory from the vitest report.

### Feature areas

| Area                                        | E2E                                                                            | Unit                           | Risk if broken                      | Verdict                                       |
| ------------------------------------------- | ------------------------------------------------------------------------------ | ------------------------------ | ----------------------------------- | --------------------------------------------- |
| `renderer/extensions/vueNodes`              | 81.0% (3,784 lines)                                                            | high                           | Every node on the canvas            | Well covered; do not add more here            |
| `platform/workflow` (load/save/tabs)        | 68.2% (2,670)                                                                  | high                           | Data loss                           | Covered; keep                                 |
| `stores`                                    | 71.5% (4,630)                                                                  | 86%                            | Everything                          | Covered via UI and unit                       |
| `platform/settings`, setting dialog         | 87.6% / 92.8%                                                                  | high                           | Config                              | Covered                                       |
| `lib/litegraph/src/subgraph`                | 80.8% (1,335)                                                                  | excluded partly                | Subgraph editing                    | Covered by 24 specs                           |
| `lib/litegraph/src/canvas`                  | 49.6% (799)                                                                    | **excluded**                   | Canvas rendering, links, indicators | Sole layer; targeted specs needed             |
| `lib/litegraph/src/widgets`                 | 48.3% (720)                                                                    | **excluded**                   | Legacy-renderer widgets             | Sole layer; knob/color/gradient/curve at ~0%  |
| `extensions/core` (built-ins)               | 50.4% (5,487)                                                                  | 54%                            | Group nodes, reroutes, uploads, 3D  | Mixed; see per-extension table                |
| `extensions/core/cameraInfo`                | 6.8% (855)                                                                     | ~87%                           | 3D camera overlay                   | Unit-covered; low E2E priority                |
| `composables/maskeditor`                    | 52.1% (1,869)                                                                  | ~94%                           | Mask editor tools                   | Three specs exist; tool coverage thin         |
| `workbench/extensions/manager`              | 54.5% (1,858) + 2k absent                                                      | ~44% (components)              | Custom-node install/update          | Install, update, conflict dialogs untested    |
| `platform/assets` (browser)                 | 48.7% (2,234)                                                                  | mid                            | Media/model browsing                | Browse well covered by 37 specs               |
| `platform/assets/components/UploadModel*`   | 14.1% (64) + dialogs absent                                                    | wizard and components tested   | Model upload                        | Browser integration gap                       |
| `components/videoEdit`, `composables/video` | absent (2,296 raw)                                                             | ~78%                           | Video trim widget                   | Gap                                           |
| `renderer/extensions/layerEditor`           | absent (8,904 raw)                                                             | ~99% (GPU compositor excluded) | Image layer editing                 | No browser-level proof at all; unit is strong |
| `renderer/extensions/compositor`            | 7.0% (43) + 788 absent                                                         | ?                              | Image compositor overlay            | Gap                                           |
| `platform/workspace`                        | 33.9% (2,262) + 11.7k absent                                                   | store ~59%                     | Team membership, credits, billing   | Cloud-only; unmeasured, likely under-tested   |
| `platform/cloud/subscription`, checkout     | 43.3% (563) + 2.1k absent; `useSubscriptionCheckout.ts` 1,569 raw lines absent | high                           | Revenue                             | Cloud-only; unmeasured                        |
| `platform/cloud/onboarding`                 | absent (3,039 raw)                                                             | ~58%                           | First-run cloud flow                | Cloud-only; unmeasured                        |
| `workbench/extensions/agent`                | absent (9,567 raw)                                                             | ~93%                           | Cloud agent panel                   | 2 `@cloud` specs, unmeasured                  |
| `platform/auth`, `dialog/content/signin`    | 26.6% / 39.6%                                                                  | mixed                          | Sign-in                             | Cloud-only; unmeasured                        |
| `platform/telemetry`                        | 37.5% + providers absent                                                       | ~63%                           | Analytics only                      | Deliberately low E2E; unit is the right layer |

### Built-in extensions with no E2E spec exercising them

Measured hits confirm the spec-name scan: `contextMenuFilter.ts` (8.9%),
`clipspace.ts` (4.8%), `saveMesh.ts` (22%), `load3dPreviewExtensions.ts`
(15%), `load3d/ModelExporter.ts` (7%), `load3d/PointCloudModelAdapter.ts`
(4%), `simpleTouchSupport.ts` (32%, mobile only), `dynamicPrompts.ts`,
`slotDefaults.ts`, `saveText.ts`, `imageCompositor.ts`, `layerEditor.ts`.
`groupNode.ts` (75%), `widgetInputs.ts` (75%), `rerouteNode.ts` (68%), and
`nodeTemplates.ts` (63%) are fine.

### Redundancy to reclaim

| Family                                                                                                                          | Observation                                                                                                      | Action                                                                                                  |
| ------------------------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------- |
| `nodeSearchBox.spec.ts` (24), `nodeSearchBoxV2.spec.ts` (12), `nodeSearchBoxV2Extended.spec.ts` (20)                            | V2 and V2Extended repeat the same describe titles (`Category navigation`, `Filter workflow`, `Category sidebar`) | Merge V2 files into `tests/nodeSearch/`; diff the duplicated describes and keep one                     |
| `sidebar/assets.spec.ts` (48), `sidebar/assetsSidebarTab.spec.ts` (16), `assetHelper.spec.ts` (21), `browseModelAssets.spec.ts` | Four entry points to one browser                                                                                 | Fold into `tests/assets/` by behavior (browse, filter, sort, select, context menu)                      |
| `interaction.spec.ts`                                                                                                           | 64 tests, 62 `toHaveScreenshot`; its snapshot folder is the most churned path in `browser_tests` since June      | Keep screenshots where the visual result is the behavior; otherwise assert another user-visible outcome |
| `appMode*.spec.ts` (11 files) + `linearMode.spec.ts`                                                                            | Fragmented but no duplication                                                                                    | Move under `tests/appMode/`; test bodies unchanged                                                      |
| `keybindings.spec.ts`, `defaultKeybindings.spec.ts`, `keyboardShortcutActions.spec.ts`, `keybindingPanel.spec.ts`               | Overlapping fixtures, distinct behaviors                                                                         | Leave; document the split in a folder README                                                            |
| `@screenshot` (104 tests, 185 assertions)                                                                                       | Screenshot maintenance dominates flake and regen PR volume                                                       | Audit against README rule "screenshots only when appearance is the behavior"                            |

## 5. Plan

Ordered by safety gained per hour. Each phase is independently shippable.

### Phase 0: make the existing measurement honest (three small PRs)

1. Collect coverage in the Chromium-based projects run by
   `ci-tests-e2e.yaml`: `chromium`, `cloud`, `mobile-chrome`, `chromium-2x`,
   and `chromium-0.5x`. Set `COLLECT_COVERAGE: 'true'` on the
   `playwright-tests` matrix job and pass it to `build-cloud-frontend` so the
   cloud bundle keeps its `sourceMappingURL` comments. Upload each project's
   `coverage/playwright/` under a unique artifact name that includes the
   project and, for sharded jobs, the shard index. Add `playwright-tests` to
   the package job's dependencies and reject an incomplete expected artifact
   set instead of silently producing a partial merge. `mobile-safari` remains
   excluded because Playwright coverage is Chromium-only. Keep `performance`
   uninstrumented under ADR 0022; no regular CI job runs `audit`.
2. Count never-loaded production files through monocart's `all` option so
   source files with no V8 entry are reported at 0% instead of omitted. The
   implementation must transform TypeScript and Vue files before monocart
   parses them and use the same production-source exclusions as Vitest rather
   than reusing `coverageSourceFilter`. The Slack target and Pages report then
   describe the same denominator. The headline number will drop, and that drop
   is the intended effect.
3. Report per area by adding Codecov `component_management` entries keyed to
   the areas in section 4 (vueNodes, litegraph canvas, litegraph widgets,
   extensions/core, workflow, assets, manager, workspace, cloud, layerEditor,
   maskeditor, agent). Each PR comment then shows combined coverage by
   component, while the existing flags show overall `unit` and `e2e` coverage.
   Keep statuses informational. Optionally extend
   `scripts/coverage-slack-notify.ts` to print the three lowest components.

Also worth folding into this phase: a `scripts/coverage-gaps.ts` that joins the
union of file paths in the two lcov files, treats a missing layer as zero, and
lists files where both layers are below 30%. Group the result by directory and
write it to the package job's step summary.

### Phase 1: write the journey inventory and run it as smoke

1. Create `browser_tests/JOURNEYS.md` listing the user journeys the suite
   promises to protect, each with the spec and the observable it asserts.
   First draft, from the product surface: open app and load default graph;
   load a template and queue it to completion; save, reload, and reopen a
   workflow tab; add a node via search and connect it; edit a widget and see
   its displayed value change; enter and exit a subgraph; undo and redo; copy and
   paste across tabs; open the mask editor and save; install a custom node
   pack; sign in and switch workspace (cloud); top up credits (cloud).
2. Tag exactly one spec per journey `@smoke`, and remove `@smoke` from tests
   that are not journeys. Add a `smoke` Playwright project that greps
   `@smoke`. Make the existing 16 shards depend on it so a broken journey
   stops the full run after about two minutes. This adds the smoke runtime to
   the critical path when it passes.
3. Journeys with no spec become the first new tests. From the current draft
   that is: install a custom node pack (manager), and top up credits and
   change plan (workspace/billing), both testable with typed route mocks in
   the `chromium` project.

### Phase 2: fill the highest-value execution gaps

One spec folder each, using existing page objects where they exist. Write each test around the journey. Line coverage follows because the chunk
loads.

| Order | Area                               | First test to write                                                                                                         | Why first                                                                                                            |
| ----- | ---------------------------------- | --------------------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------- |
| 1     | Layer editor                       | Open from an image node, add a layer, transform it, apply, and see the edited image on the node                             | 8.9k lines never executed in a browser; the WebGL compositor has no unit test either; a single flow loads most of it |
| 2     | Manager install/update/conflict    | Mock registry and manager routes; install a pack, see the restart prompt; open a version popover; trigger a conflict dialog | User-facing failure mode is "extension broke ComfyUI"                                                                |
| 3     | Model upload                       | Open Upload Model dialog, pick a file, see upload progress, and find the asset in the browser                               | Component behavior has unit coverage; the gap is dialog-to-browser integration                                       |
| 4     | Video edit panel                   | Open the trim panel on a video widget, set in/out points, and see the selected range in the panel                           | 2.3k lines absent; widget-level behavior                                                                             |
| 5     | Litegraph canvas widgets           | One spec per legacy widget kind (knob, color, gradient, curve): interact and see the displayed value change                 | Sole coverage layer; each spec is small                                                                              |
| 6     | Mask editor tools                  | Brush size and opacity, eraser, layer toggle, undo inside editor                                                            | Heavily used; composables at 52%                                                                                     |
| 7     | Workspace and subscription (cloud) | Decide after Phase 0 step 1 reveals what the 154 cloud tests already cover                                                  | Highest business risk, but currently unmeasured                                                                      |

Skip on purpose: `cameraInfo` (unit-covered, niche), `telemetry` (unit is
the correct layer), `mobile-safari` expansion (README says use sparingly),
and any second-renderer copy of an existing Vue-nodes widget spec.

### Phase 3: consolidate and cap cost

1. Merge the node-search and asset-browser spec families per the redundancy
   table. Measure before and after with the per-component report from
   Phase 0; the merged files must not lower any component.
2. Keep `interaction.spec.ts` screenshots where the visual result is the
   behavior. Replace the rest only when another user-visible assertion proves
   the same result. This reduces churn without testing implementation state.
3. Aggregate `flaky` outcomes from `report.json` in `merge-reports` and post
   the count in the PR comment. Once the count is stable, lower CI
   `retries` from 3 to 2. Lowering it before the count exists would only hide
   which tests are flaky.
4. Shard `ci-tests-unit.yaml` (vitest `--shard`) to cut its 17-minute wall
   clock; unrelated to coverage but the same runner budget.

### Phase 4: keep it from regressing

- Once Phase 0 has run for a month, set per-component Codecov thresholds at
  current value minus 2% for the well-covered areas only (vueNodes, workflow,
  settings, subgraph). A global threshold is what got the project status disabled, so none is
  added.
- Review `JOURNEYS.md` whenever a feature ships behind a flag flip; a flag
  that turns a feature on for users should turn its journey into `@smoke`.

## 6. What this plan does not do

- It does not chase a global percentage. The Slack target of 80% stays as a
  trend line only.
- It does not add E2E tests for pure logic that has unit tests. Coverage gaps
  that are unit-shaped, such as schema validators, parsers, and agent graph
  mutations, go to Vitest.
- It does not introduce mutation testing for the browser suite.
- It does not add tests to `legacyDoNotReplicate`; new compatibility pins
  follow that folder's pattern only when a custom-node breakage proves the
  contract matters.

## Appendix: reproducing the numbers

1. Find the latest green `CI: Tests E2E` run on `main` and its
   `upload-e2e-coverage / package` job. The job log contains one
   `Processing file <path>` and `lines=<n> hit=<n>` pair per source file that
   entered the merged lcov, followed by `Overall coverage rate`. Parse those
   pairs into `path, lines, hit`.
2. From the matching `CI: Tests Unit` run, the vitest text reporter prints
   the per-directory table (`File | % Stmts | % Branch | % Funcs | % Lines`).
   Directory rows are complete; file names are truncated and need suffix
   matching against the repo tree. The `unit-coverage` artifact
   (`lcov.info`) is the exact source when artifact download is available.
3. Files under `src/` that have no `Processing file` entry are the
   never-loaded set. Count their raw lines with `wc -l`.
4. Per-shard `Coverage summary` blocks and `N passed (Xm)` lines are at the
   end of each `playwright-tests-chromium-sharded` job log.

Sources consulted: Kent Beck, "Composable Tests" (tidyfirst.substack.com);
Playwright, "Best Practices" (playwright.dev/docs/best-practices);
monocart-coverage-reports documentation; Codecov, "Mutation Testing: How to
Ensure Code Coverage Isn't a Vanity Metric"; "Beyond Coverage and Kill Scores:
Empirically Measuring Test Suite Behavioural Gaps" (arXiv 2606.10417).
