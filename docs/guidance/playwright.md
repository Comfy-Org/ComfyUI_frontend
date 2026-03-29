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

## Test Tags

Tags are respected by config:

- `@mobile` - Mobile viewport tests
- `@2x` - High DPI tests

## Test Data

- Check `browser_tests/assets/` for test data and fixtures
- Use realistic ComfyUI workflows for E2E tests

## When to Use `page.evaluate`

### Acceptable (use sparingly)

Reading internal state that has no UI representation (prefer locator
assertions whenever possible):

```typescript
// Reading graph/store values
const nodeCount = await page.evaluate(() => window.app!.graph!.nodes.length)
const linkSlot = await page.evaluate(() => window.app!.graph!.links.get(1)?.target_slot)

// Reading computed properties or store state
await page.evaluate(() => useWorkflowStore().activeWorkflow)

// Setting up test fixtures (registering extensions, mock error handlers)
await page.evaluate(() => {
  window.app!.registerExtension({ name: 'TestExt', settings: [...] })
})
```

### Avoid

Performing actions that have a UI equivalent — use Playwright locators and user
interactions instead:

```typescript
// Bad: setting a widget value programmatically
await page.evaluate(() => { node.widgets![0].value = 512 })
// Good: click the widget and type the value
await widgetLocator.click()
await widgetLocator.fill('512')

// Bad: dispatching synthetic DOM events
await page.evaluate(() => { btn.dispatchEvent(new MouseEvent('click', ...)) })
// Good: use Playwright's click
await page.getByTestId('more-options-button').click()

// Bad: calling store actions that correspond to user interactions
await page.evaluate(() => { app.queuePrompt(0) })
// Good: click the Queue button
await page.getByRole('button', { name: 'Queue' }).click()
```

### Preferred

Use helper methods from `browser_tests/fixtures/helpers/` that wrap real user
interactions (e.g., `comfyPage.settings.setSetting`, `comfyPage.nodeOps`,
`comfyPage.workflow.loadWorkflow`).

### Migration Candidates

Action-oriented `page.evaluate` calls to replace with user interactions or
fixture helpers:

1. `actionbar.spec.ts` — sets widget value and calls `changeTracker.checkState()` via evaluate instead of interacting with the widget UI
2. `changeTracker.spec.ts` — calls `emitBeforeChange`/`emitAfterChange` via evaluate instead of performing actual canvas edits
3. `selectionToolboxSubmenus.spec.ts` — dispatches synthetic `MouseEvent` click instead of using Playwright's `locator.click()`
4. `dialog.spec.ts:443` — calls `showSignInDialog()` via evaluate instead of triggering it through the UI
5. `colorPalette.spec.ts:181` — calls `addCustomColorPalette()` via evaluate instead of using the settings UI to import a palette
6. `menu.spec.ts:156` — registers an extension command via evaluate; could use a test fixture that pre-registers extensions
7. `groupSelectChildren.spec.ts:115` — deselects all nodes via evaluate instead of clicking an empty canvas area
8. `widget.spec.ts:128,149,173` — mutates widget values directly via evaluate instead of interacting with widget controls

## Running Tests

```bash
pnpm test:browser:local                 # Run all E2E tests
pnpm test:browser:local -- --ui         # Interactive UI mode
```
