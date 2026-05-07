# Subgraph promoted-widget ratchet status — 2026-05-06

## Slice 8 status

- Browser coverage is implemented in `browser_tests/tests/subgraph/subgraphSerialization.spec.ts` for the plan section 11.3 cases:
  - legacy primitive proxy migration without `proxyWidgets` round-trip;
  - multi-host isolation for two `SubgraphNode` hosts sharing one subgraph definition;
  - nested preview exposure serialization and host UI exposure;
  - unresolvable legacy proxy quarantine.
- Browser fixtures/helpers were updated to inspect live promoted widget views and serialized `previewExposures` instead of relying on serialized `properties.proxyWidgets`.
- Direct Playwright verification for the four new slice-8 cases passed locally against `PLAYWRIGHT_TEST_URL=http://localhost:5173`.

## Fixed bug

- The multi-host browser test exposed a real promoted-widget state isolation bug: two host nodes wrapping the same subgraph definition can read the second host's migrated value from the first host.
- Root cause evidence points to `PromotedWidgetView.value` using `useWidgetValueStore()` keyed by interior `(graphId, source node id, widget name)`, which is shared by all hosts for the same subgraph definition.
- Fix: `PromotedWidgetView.value` now prefers host-scoped widget state keyed by `(root graph id, host SubgraphNode id, promoted widget host-state name)` while still propagating writes to linked/interior widgets for existing behavior.
- `SubgraphNode.serialize()` now writes host-scoped promoted values to `widgets_values` without reading through linked interior widgets, and `SubgraphNode.configure()` applies those values back to host promoted widgets after slots are bound.

## Completed steps

1. Added a Vitest regression test in `src/core/graph/subgraph/promotedWidgetView.test.ts` proving two hosts sharing one subgraph keep independent promoted values.
2. Added a `SubgraphNode.serialize()` regression test proving host promoted values serialize independently per host.
3. Relaxed the primitive-output assertion in the browser test to accept the repaired empty-link representation.
4. Reran targeted unit tests, browser typecheck/lint/oxlint/format, and direct targeted Playwright verification.

## Verification state

- Passed:
  - `pnpm test:unit -- src/core/graph/subgraph/promotedWidgetView.test.ts`
  - `pnpm test:unit -- src/lib/litegraph/src/subgraph/SubgraphNode.serialize.test.ts`
  - `PLAYWRIGHT_LOCAL=1 PLAYWRIGHT_TEST_URL=http://localhost:5173 pnpm exec playwright test browser_tests/tests/subgraph/subgraphSerialization.spec.ts -g "Legacy primitive|Multiple SubgraphNode|Nested preview|Legacy unresolvable"`
  - `pnpm typecheck:browser`
  - `pnpm exec eslint browser_tests/tests/subgraph/subgraphSerialization.spec.ts browser_tests/fixtures/utils/promotedWidgets.ts browser_tests/fixtures/helpers/SubgraphHelper.ts src/core/graph/subgraph/promotedWidgetView.ts src/core/graph/subgraph/promotedWidgetView.test.ts src/lib/litegraph/src/subgraph/SubgraphNode.ts src/lib/litegraph/src/subgraph/SubgraphNode.serialize.test.ts src/stores/appModeStore.ts src/stores/appModeStore.test.ts src/composables/node/usePromotedPreviews.ts`
  - `pnpm exec oxlint browser_tests/tests/subgraph/subgraphSerialization.spec.ts browser_tests/fixtures/utils/promotedWidgets.ts browser_tests/fixtures/helpers/SubgraphHelper.ts src/core/graph/subgraph/promotedWidgetView.ts src/core/graph/subgraph/promotedWidgetView.test.ts src/lib/litegraph/src/subgraph/SubgraphNode.ts src/lib/litegraph/src/subgraph/SubgraphNode.serialize.test.ts src/stores/appModeStore.ts src/stores/appModeStore.test.ts src/composables/node/usePromotedPreviews.ts --type-aware`
  - `pnpm format:check -- browser_tests/tests/subgraph/subgraphSerialization.spec.ts browser_tests/fixtures/utils/promotedWidgets.ts browser_tests/fixtures/helpers/SubgraphHelper.ts src/core/graph/subgraph/promotedWidgetView.ts src/core/graph/subgraph/promotedWidgetView.test.ts src/lib/litegraph/src/subgraph/SubgraphNode.ts src/lib/litegraph/src/subgraph/SubgraphNode.serialize.test.ts src/stores/appModeStore.ts src/stores/appModeStore.test.ts src/composables/node/usePromotedPreviews.ts`

## Notes

- Direct Playwright still reports environment noise: `Path not found: F:\ComfyUsers\BrowserTests\models`, `NO_COLOR`/`FORCE_COLOR` warnings, and an `EPERM` cleanup warning restoring `F:\ComfyUsers\BrowserTests\user`. These did not block the targeted tests.

## Status audit — 2026-05-07

- Branch `drjkl/subgraph-promoted-widget-ratchet` has no open PR associated with it yet.
- Compared with `origin/main`, the branch contains the full ratchet implementation slice across migration helpers, preview exposure store/chain, `SubgraphNode` serialization/configure behavior, `PromotionStore` demotion, app-mode selected-input migration, and browser/unit coverage.
- The branch was four commits ahead of `origin/drjkl/subgraph-promoted-widget-ratchet` before this cleanup commit.
- Cleaned stale preview PR-A scaffolding:
  - deleted unused `src/core/graph/subgraph/preview/previewExposureIdentity.ts`;
  - removed the unused `PreviewExposureIdentity` type;
  - updated `src/core/graph/subgraph/preview/README.md` to describe the current active modules.
- Reduced accidental public API surface in new ratchet modules by making unused exported helper/result types private where no call site imports them.

### Remaining plan gaps / follow-up decisions

- `temp/plans/2026-05-05-subgraph-promoted-widget-ratchet.md` is stale: it still says implementation has not started and its checklist is unchecked.
- The planned `subgraphPromotedWidgetRatchet` feature flag is not implemented; migration currently runs from the configure hook when legacy `properties.proxyWidgets` are present.
- `litegraphService.ts` pseudo-widget preview targets still use the promotion-store/subgraph-pseudo-widget-cache path; the plan called for switching this to `PreviewExposureStore` identity.
- `subgraphPseudoWidgetCache` has not obviously been migrated to preview-exposure identity keys.
- Favorites/builder selection identity migration beyond `appModeStore` was not confirmed in this audit.
- Aggregate migration `Sentry.addBreadcrumb` logging from the plan was not observed in the migration modules.

### Verification after cleanup

- Passed: `rg -n "previewExposureIdentity|PreviewExposureIdentity|makePreviewExposureIdentity|previewExposureIdentity"`
- Passed: `pnpm format:check -- src/core/graph/subgraph/preview/README.md src/core/graph/subgraph/preview/previewExposureTypes.ts`
