# 27. E2E Coverage Measurement and Test Selection

Date: 2026-09-01

## Status

Proposed

## Context

The Playwright suite has 327 spec files and about 1,950 tests, and CI already
collects V8 coverage for the sharded `chromium` project, merges it, and
publishes it to Codecov, GitHub Pages, and Slack. On the `main` run at
`e05e929f` the merged report shows 68.1% of lines covered. That number is not
usable for deciding what to test next, for three reasons.

1. V8 coverage only describes chunks the browser fetched. Lazy chunks no test
   triggers never enter the report, so 457 `src/` files (about 65k raw lines,
   against 70.5k measured lines) are absent rather than at 0%. The layer
   editor, agent panel, workspace and subscription UI, video edit panel, and
   compositor are all in that set.
2. Only the `chromium` project sets `COLLECT_COVERAGE`. The 154 `cloud`
   tests that exercise sign-in, workspaces, billing, and the agent panel are
   never credited.
3. Nothing reports coverage per feature area. Codecov's project status is
   disabled and patch status is informational, so a global figure hides that
   `platform/workspace` is at 34% while `vueNodes` is at 81%.

Two further facts shape the decision. The Vitest config excludes
`src/lib/litegraph/src/canvas/**` and `widgets/**` from unit coverage, so E2E
is the only measuring layer for those 11.9k lines and holds them at about
49%. And the suite has no inventory of the user journeys it protects: the
`@smoke` tag is applied to 46 tests and no CI job runs it.

Line coverage is an execution metric. Research on behavioural test adequacy
finds untested behavior in roughly a third of fully line-covered methods,
because coverage cannot see a missing assertion. Kent Beck's composable-tests
argument applies to the suite's largest cost driver: where dimensions such as
widget type, renderer, and node state are orthogonal, testing each dimension
once gives the same confidence as the cross product at a fraction of the
runtime.

The supporting analysis, per-area tables, and reproduction steps are in
[docs/testing/e2e-coverage-strategy.md](../testing/e2e-coverage-strategy.md).

## Decision

### Measurement

1. Every Playwright project collects coverage, including `cloud`, the mobile
   projects, and the scale projects. The cloud bundle is built with
   `COLLECT_COVERAGE` so it retains source-map comments, and each project
   uploads an `e2e-coverage-shard-*` artifact that the existing package step
   merges.
2. Source files that never load in any project are reported at 0% instead of
   being left out of the report. The headline number will fall when this
   lands, and the lower number is the accurate one.
3. Coverage is reported per feature area through Codecov components, with
   `unit`, `e2e`, and combined values in the PR comment. Component statuses
   are informational. No global project threshold is introduced; thresholds
   may later be set per component, at current value minus a small margin,
   for areas that are already well covered.
4. The package step emits a gap report: files below 30% in both layers,
   grouped by directory, so execution gaps are visible on every run.

### Behavior coverage

5. `browser_tests/JOURNEYS.md` lists the user journeys the suite protects,
   each with its spec and the observable it asserts. Exactly one spec per
   journey carries `@smoke`. A `smoke` project greps that tag and runs first
   in CI as a fast-fail; the sharded run is unchanged.
6. A journey without a spec is the highest-priority new test. A feature that
   ships to users, including by flag flip, gets its journey added.

### Test selection

7. E2E tests exist for user journeys and for execution gaps the coverage
   report shows. Logic that has a unit test does not get an E2E copy, and
   unit-shaped gaps are closed in Vitest.
8. Where two dimensions are orthogonal, each is tested once rather than as a
   cross product. Widget behavior is proven on the Vue-nodes renderer,
   renderer parity is proven by the toggle specs, and node states are proven
   once; no second-renderer copy of an existing widget spec is added. The
   same applies to feature × view mode.
9. Screenshot assertions are used only when appearance is the behavior under
   test. Link, position, and selection state are asserted through `nodeOps`.
10. A new feature directory under `src/renderer/extensions`, `src/platform`,
    or `src/workbench` is expected to ship with a matching
    `browser_tests/tests/<feature>/` folder. The PR report comment flags a
    missing folder as advice and never blocks a merge.
11. `legacyDoNotReplicate` grows only when a custom-node breakage proves a
    compatibility contract matters.

## Consequences

Positive:

- The coverage pipeline already paid for becomes a gap finder instead of a
  trend line. Per-area data decides where tests get added.
- Cloud-only surfaces (workspace, billing, subscription, agent) are measured
  before anyone decides how many tests they need.
- The journey inventory makes behavior coverage reviewable and gives CI a
  two-minute fail-fast for the paths users depend on.
- Test count grows where coverage is thin and shrinks where dimensions are
  duplicated, so runner minutes stay roughly flat.

Negative:

- The reported E2E percentage drops, possibly by 15 to 20 points, when
  never-loaded files are counted. The Slack target of 80% becomes a trend
  line only until per-component thresholds exist.
- Collecting coverage in the `cloud` and mobile jobs adds a small amount of
  runtime and one artifact per project.
- Consolidating duplicated spec families is work that adds no coverage and
  must be checked against the per-component report to prove nothing dropped.

Neutral:

- Mutation testing stays out of scope for the browser suite. It may be
  applied later to pure, well-unit-tested modules.
- Existing conventions in `browser_tests/README.md` are unchanged; this ADR
  adds selection rules on top of them.

## Implementation

Landed as a stack, in this order, each independently mergeable:

1. This ADR and the supporting analysis.
2. Coverage collection in every Playwright project.
3. Never-loaded files counted at 0% and the gap report in the package step.
4. Codecov components for the feature areas in the analysis.
5. `browser_tests/JOURNEYS.md`, `@smoke` retagging, and the `smoke` project.
6. New journey specs and gap-closing specs, one area per PR.
7. Consolidation of the duplicated spec families.
