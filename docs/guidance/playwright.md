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
data as unknown as SomeType // Avoid; prefer explicit typings or helpers
```

### Accessing Internal State

When tests need internal store properties (e.g., `.workflow`, `.focusMode`):

```typescript
// ✅ Use the wss() helper to access workspace store with full typing
await page.evaluate(() => {
  return wss().workflow.activeWorkflow?.filename
})

// ✅ wss() provides typed access to:
// - workflow (activeWorkflow, syncWorkflows, isBusy)
// - focusMode
// - queueSettings
// - colorPalette

// ❌ Don't use `as WorkspaceStore` casts
;(window.app!.extensionManager as WorkspaceStore).workflow // Bad

// ❌ Don't change public API types to expose internals
// Keep app.extensionManager typed as ExtensionManager, not WorkspaceStore
```

## Test Tags

Tags are respected by config:

- `@mobile` - Mobile viewport tests
- `@2x` - High DPI tests

## Test Data

- Check `browser_tests/assets/` for test data and fixtures
- Use realistic ComfyUI workflows for E2E tests

## Running Tests

```bash
pnpm test:browser:local                 # Run all E2E tests
pnpm test:browser:local -- --ui         # Interactive UI mode
```
