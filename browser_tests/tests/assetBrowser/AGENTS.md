# Asset Browser E2E Tests

Tests for the Asset Browser modal right panel (`ModelInfoPanel.vue`).

## Structure

| File                     | Coverage                                                                       |
| ------------------------ | ------------------------------------------------------------------------------ |
| `modelInfoPanel.spec.ts` | Rendering, mutable/immutable behavior, editing flows, watcher resets, debounce |

## Shared Test Utilities

- `@e2e/fixtures/components/AssetBrowserModal` — Page object for modal/root grid
  and all ModelInfoPanel locators.
- `@e2e/fixtures/helpers/AssetBrowserHelper` — Route mocks for endpoints not
  covered by `AssetHelper` (`GET /experiment/models`, `POST/DELETE /assets/:id/tags`).
- `@e2e/fixtures/data/assetBrowserFixtures` — Typed fixtures for editable,
  immutable, and bare model states.

## Conventions

- Set all route mocks **before** `await comfyPage.setup()` so startup fetches hit
  the mocked endpoints.
- Use `expect.poll()` for debounced behavior assertions (metadata and tags updates).
- Do not use `waitForTimeout()`.
