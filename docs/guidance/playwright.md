---
globs:
  - '**/*.spec.ts'
---

# Playwright E2E Test Conventions

See `docs/testing/*.md` for detailed patterns.

## Best Practices

- Follow [Playwright Best Practices](https://playwright.dev/docs/best-practices)
- Do NOT use `waitForTimeout` - use Locator actions and retrying assertions
- Prefer specific selectors (role, label, test-id)
- Test across viewports

## Window Globals

Browser tests access `window.app`, `window.graph`, and `window.LiteGraph` which are
optional in the main app types. In E2E tests, use non-null assertions (`!`):

```typescript
window.app!.graph!.nodes
window.LiteGraph!.registered_node_types
```

This is the **only context** where non-null assertions are acceptable.

**TODO:** Consolidate these references into a central utility (e.g., `getApp()`) that
performs proper runtime type checking, removing the need for scattered `!` assertions.

## Type Assertions in E2E Tests

E2E tests may use **specific** type assertions when needed, but **never** `as any`.

### Acceptable Patterns

```typescript
// ✅ Non-null assertions for window globals
window.app!.extensionManager

// ✅ Specific type assertions with documentation
// Extensions can register arbitrary setting IDs
id: 'TestSetting' as TestSettingId

// ✅ Test-local type helpers
type TestSettingId = keyof Settings
```

### Forbidden Patterns

```typescript
// ❌ Never use `as any`
settings: testData as any

// ❌ Never modify production types to satisfy test errors
// Don't add test settings to src/schemas/apiSchema.ts

// ❌ Don't chain through unknown to bypass types
data as unknown as SomeType // Avoid; prefer `as Partial<SomeType> as SomeType` or explicit typings
```

### Accessing Internal State

When tests need internal store properties (e.g., `.workflow`, `.focusMode`):

```typescript
// ✅ Access stores directly in page.evaluate
await page.evaluate(() => {
  const store = useWorkflowStore()
  return store.activeWorkflow
})

// ❌ Don't change public API types to expose internals
// Keep app.extensionManager typed as ExtensionManager, not WorkspaceStore
```

## Assertion Best Practices

When a test depends on an invariant unrelated to what it's actually testing (e.g. asserting a node has 4 widgets before testing node movement), always assert that invariant explicitly — don't leave it unchecked. Use a custom message or `expect.soft()` rather than a bare `expect`, so failures point to the broken assumption instead of producing a confusing error downstream.

```typescript
// ✅ Custom message on an unrelated precondition — clear signal when the invariant breaks
expect(node.widgets, 'Widget count changed — update test fixture').toHaveLength(
  4
)
await node.move(100, 200)

// ✅ Soft assertion — verifies multiple invariants without stopping the test early
expect.soft(menuItem1).toBeVisible()
expect.soft(menuItem2).toBeVisible()
expect.soft(menuItem3).toBeVisible()

// ❌ Bare expect on a precondition — no context when it fails
expect(node.widgets).toHaveLength(4)
```

- Use custom messages (`expect(x, 'reason')`) for precondition checks unrelated to the test's purpose
- Use `expect.soft()` when you want to verify multiple invariants without aborting on the first failure
- Prefer Playwright's built-in message parameter over custom error classes

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

## Test Tags

Tags are respected by config:

- `@mobile` - Mobile viewport tests
- `@2x` - High DPI tests

## Test Data

- Check `browser_tests/assets/` for test data and fixtures
- Use realistic ComfyUI workflows for E2E tests
- When multiple nodes share the same title (e.g. two "CLIP Text Encode" nodes), use `vueNodes.getNodeByTitle(name).nth(n)` to pick a specific one. Never interact with the bare locator when titles are non-unique — Playwright strict mode will fail.

## Running Tests

```bash
pnpm test:browser:local                 # Run all E2E tests
pnpm test:browser:local -- --ui         # Interactive UI mode
```
