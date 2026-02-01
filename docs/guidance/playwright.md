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
