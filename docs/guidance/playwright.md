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

## Test Tags

- `@mobile` — Mobile viewport tests
- `@2x` — High DPI tests

## Test Data

- Check `browser_tests/assets/` for fixtures
- Use realistic ComfyUI workflows
- When multiple nodes share the same title, use `vueNodes.getNodeByTitle(name).nth(n)` — Playwright strict mode will fail on ambiguous locators

## Running Tests

```bash
pnpm test:browser:local                 # Run all E2E tests
pnpm test:browser:local -- --ui         # Interactive UI mode
```
