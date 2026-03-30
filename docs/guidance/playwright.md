---
globs:
  - '**/*.spec.ts'
---

# Playwright E2E Test Conventions

See `docs/testing/*.md` for detailed patterns.

## Best Practices

- Follow [Playwright Best Practices](https://playwright.dev/docs/best-practices)
- Do NOT use `waitForTimeout` — use Locator actions and retrying assertions
- Prefer specific selectors (role, label, test-id)
- Test across viewports

## Window Globals

Browser tests access `window.app`, `window.graph`, and `window.LiteGraph` which are
optional in the main app types. Use non-null assertions (`!`) in E2E tests only:

```typescript
window.app!.graph!.nodes
window.LiteGraph!.registered_node_types
```

TODO: Consolidate into a central utility (e.g., `getApp()`) with runtime type checking.

## Type Assertions

Use specific type assertions when needed, never `as any`.

Acceptable:

```typescript
window.app!.extensionManager
id: 'TestSetting' as TestSettingId
type TestSettingId = keyof Settings
```

Forbidden:

```typescript
settings: testData as any
data as unknown as SomeType
```

Access internal state via `page.evaluate` and stores directly — don't change public API types to expose internals.

## Assertion Best Practices

Assert preconditions explicitly with a custom message so failures point to the broken assumption:

```typescript
expect(node.widgets, 'Widget count changed — update test fixture').toHaveLength(
  4
)
await node.move(100, 200)

expect.soft(menuItem1).toBeVisible()
expect.soft(menuItem2).toBeVisible()

// Bad — bare expect on a precondition gives no context when it fails
expect(node.widgets).toHaveLength(4)
```

- `expect(x, 'reason')` for precondition checks unrelated to the test's purpose
- `expect.soft()` to verify multiple invariants without aborting on the first failure

## Test Structure: Arrange/Act/Assert

1. All mock setup, state resets, and fixture arrangement belongs in `test.beforeEach()` or Playwright fixtures
2. Inside `test()`, only act (user actions) and assert
3. Never call `clearAllMocks` or reset mock state mid-test

```typescript
test.beforeEach(async ({ comfyPage }) => {
  await comfyPage.workflow.loadWorkflow('test.json')
})
test('should do something', async ({ comfyPage }) => {
  await comfyPage.menu.topbar.click()
  await expect(comfyPage.menu.nodeLibraryTab.root).toBeVisible()
})
```

## Creating New Test Helpers

New domain-specific test helpers (e.g., `AssetHelper`, `JobHelper`) should be
registered as Playwright fixtures via `base.extend()` rather than attached as
properties on `ComfyPage`. This enables automatic setup/teardown.

### Extend `base` from Playwright

Keep each fixture self-contained by extending `@playwright/test` directly.
Compose fixtures together with `mergeTests` when a test needs multiple helpers.

```typescript
// browser_tests/fixtures/assetFixture.ts
import { test as base } from '@playwright/test'

export const test = base.extend<{
  assetHelper: AssetHelper
}>({
  assetHelper: async ({ page }, use) => {
    const helper = new AssetHelper(page)
    await helper.setup()
    await use(helper)
    await helper.cleanup() // automatic teardown
  }
})
```

### Rules

- **Do NOT** add new helpers as properties on `ComfyPage`
- Each fixture gets automatic cleanup via the callback after `use()`
- Keep fixtures modular — extend `@playwright/test` base, not
  `comfyPageFixture`, so they can be composed via `mergeTests`

## Custom Assertions

Add assertion methods directly on the page object or helper class instead of extending `comfyExpect`. Page object methods are discoverable via IntelliSense without special imports.

```typescript
// ✅ Page object assertions
await node.expectPinned()
await node.expectBypassed()

// ❌ Do not add custom matchers to comfyExpect
```

## Test Tags

- `@mobile` — Mobile viewport tests
- `@2x` — High DPI tests

## Test Data

- Check `browser_tests/assets/` for fixtures
- Use realistic ComfyUI workflows
- When multiple nodes share the same title, use `vueNodes.getNodeByTitle(name).nth(n)` — Playwright strict mode will fail on ambiguous locators

## Fixture Data & Schemas

When creating test fixture data, import or reference existing Zod schemas and TypeScript
types from `src/` instead of inventing ad-hoc shapes. This keeps test data in sync with
production types.

Key schema locations:

- `src/schemas/apiSchema.ts` — API response types (`PromptResponse`, `SystemStats`, `User`, `UserDataFullInfo`, WebSocket messages)
- `src/schemas/nodeDefSchema.ts` — Node definition schema (`ComfyNodeDef`, `InputSpec`, `ComboInputSpec`)
- `src/schemas/nodeDef/nodeDefSchemaV2.ts` — V2 node definition schema
- `src/platform/remote/comfyui/jobs/jobTypes.ts` — Jobs API Zod schemas (`zJobDetail`, `zJobsListResponse`, `zRawJobListItem`)
- `src/platform/workflow/validation/schemas/workflowSchema.ts` — Workflow validation (`ComfyWorkflowJSON`, `ComfyApiWorkflow`)
- `src/types/metadataTypes.ts` — Asset metadata types

## Typed API Mocks

When mocking API responses with `route.fulfill()`, **always** type the response body
using existing schemas or generated types — never use untyped inline JSON objects.
This catches shape mismatches at compile time instead of through flaky runtime failures.

All three generated-type packages (`ingest-types`, `registry-types`, `generatedManagerTypes`)
are auto-generated from their respective OpenAPI specs. Prefer these as the single
source of truth for any mock that targets their endpoints.

### Sources of truth

| Endpoint category                                   | Type source                                                                                         |
| --------------------------------------------------- | --------------------------------------------------------------------------------------------------- |
| Cloud-only (hub, billing, workflows)                | `@comfyorg/ingest-types` (`packages/ingest-types`, auto-generated from OpenAPI)                     |
| Registry (releases, nodes, publishers)              | `@comfyorg/registry-types` (`packages/registry-types`, auto-generated from OpenAPI)                 |
| Manager (queue tasks, packages)                     | `generatedManagerTypes.ts` (`src/workbench/extensions/manager/types/`, auto-generated from OpenAPI) |
| Python backend (queue, history, settings, features) | Manual Zod schemas in `src/schemas/apiSchema.ts`                                                    |
| Node definitions                                    | `src/schemas/nodeDefSchema.ts`                                                                      |
| Templates                                           | `src/platform/workflow/templates/types/template.ts`                                                 |

### Patterns

```typescript
// ✅ Import the type and annotate mock data
import type { ReleaseNote } from '@/platform/updates/common/releaseService'

const mockRelease: ReleaseNote = {
  id: 1,
  project: 'comfyui',
  version: 'v0.3.44',
  attention: 'medium',
  content: '## New Features',
  published_at: new Date().toISOString()
}
body: JSON.stringify([mockRelease])

// ❌ Untyped inline JSON — schema drift goes unnoticed
body: JSON.stringify([{ id: 1, project: 'comfyui', version: 'v0.3.44', ... }])
```

## Running Tests

```bash
pnpm test:browser:local                 # Run all E2E tests
pnpm test:browser:local -- --ui         # Interactive UI mode
```
