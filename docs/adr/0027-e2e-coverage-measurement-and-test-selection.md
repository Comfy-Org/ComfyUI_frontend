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
   triggers never enter the report, so 457 `src/` files (about 65k raw lines)
   are absent rather than at 0%. The layer editor, agent panel, workspace and
   subscription UI, video edit panel, and compositor are all in that set. Raw
   source lines are not comparable to lcov's executable-line count. Applying
   the loaded files' executable-to-raw ratio (0.27) to the absent files gives
   about 17.5k executable lines and a corrected figure near 54%. The exact
   number arrives when those files enter the report.
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
finds that about 17.5% of expected behaviours are entirely untested, with most
of those gaps in methods that already have high line coverage. Coverage cannot
see a missing assertion. Kent Beck's composable-tests argument applies to the
suite's largest cost driver: where dimensions such as widget type, renderer,
and node state are orthogonal, testing each dimension once gives the same
confidence as the cross product at a fraction of the runtime.

The supporting analysis, per-area tables, and reproduction steps are in
[docs/testing/e2e-coverage-strategy.md](../testing/e2e-coverage-strategy.md).

## Decision

### Measurement

1. Every Chromium-based project run by `ci-tests-e2e.yaml` collects coverage:
   `chromium`, `cloud`, `mobile-chrome`, `chromium-2x`, and `chromium-0.5x`.
   The cloud bundle is built with `COLLECT_COVERAGE` so it retains source-map
   comments. Each job uploads a uniquely named `e2e-coverage-shard-*` artifact. The
   package job depends on every uploading job and rejects an incomplete
   artifact set instead of merging a partial one. `mobile-safari` is excluded because
   Playwright's coverage API does not support WebKit. `performance` is excluded
   because coverage instrumentation would perturb its measurements, as
   described in ADR 0022. No regular CI job runs `audit`.
2. Source files that never load in any project are reported at 0% instead of
   being left out of the report. The headline number will fall when this
   lands, and the lower number is the accurate one.
3. Combined coverage is reported per feature area through Codecov components.
   The existing flags continue to report overall `unit` and `e2e` coverage.
   Component statuses are informational. No global project threshold is
   introduced; thresholds may later be set per component, at current value
   minus a small margin, for areas that are already well covered.
4. The package step emits a gap report: files below 30% in both layers,
   grouped by directory, so execution gaps are visible on every run.

### Behavior coverage

1. `browser_tests/JOURNEYS.md` lists the user journeys the suite protects,
   each with its spec and the observable it asserts. Exactly one spec per
   journey carries `@smoke`. A `smoke` project greps that tag. The sharded jobs
   start after it passes, avoiding a full run when a critical journey fails.
2. A journey without a spec is the highest-priority new test. A feature that
   ships to users, including by flag flip, gets its journey added.

### Test selection

1. E2E tests exist for user journeys and for execution gaps the coverage
   report shows. Logic that has a unit test does not get an E2E copy, and
   unit-shaped gaps are closed in Vitest.
2. Where two dimensions are orthogonal, each is tested once rather than as a
   cross product. Widget behavior is proven on the Vue-nodes renderer,
   renderer parity is proven by the toggle specs, and node states are proven
   once; no second-renderer copy of an existing widget spec is added. The
   same applies to feature × view mode.
3. Tests assert effects a user can observe. Screenshots are used when visual
   appearance is the behavior under test; otherwise tests use accessible UI
   state or another user-visible outcome.
4. `legacyDoNotReplicate` grows only when a custom-node breakage proves a
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

- The reported E2E percentage will drop when never-loaded files are counted,
  by roughly 14 points on the estimate above. The exact size is known once
  executable lines are measured. The Slack target
  of 80% becomes a trend line only until per-component thresholds exist.
- Collecting coverage in the `cloud` and mobile jobs adds a small amount of
  runtime and one artifact per project.
- Gating the sharded jobs on the smoke project adds its runtime to a green
  run's critical path.
- Consolidating duplicated spec families is work that adds no coverage and
  must be checked against the per-component report to prove nothing dropped.

Neutral:

- Mutation testing stays out of scope for the browser suite. It may be
  applied later to pure, well-unit-tested modules.
- Existing conventions in `browser_tests/README.md` are unchanged; this ADR
  adds selection rules on top of them.

## Implementation

Planned as a stack, in this order, each independently mergeable:

1. This ADR and the supporting analysis.
2. Coverage collection in the supported CI Playwright projects.
3. Never-loaded files counted at 0% and the gap report in the package step.
4. Codecov components for the feature areas in the analysis.
5. `browser_tests/JOURNEYS.md`, `@smoke` retagging, and the `smoke` project.
6. New journey specs and gap-closing specs, one area per PR.
7. Consolidation of the duplicated spec families.
