---
globs:
  - '**/*.spec.ts'
---

# Playwright E2E Test Conventions

> **Moved.** The canonical browser-test guide is **`browser_tests/README.md`**.
> It absorbs everything that used to live here — test structure, window globals,
> type assertions, assertion best practices, creating helpers/fixtures, custom
> assertions, test tags, typed API mocks (with the source-of-truth table), and
> the `page.evaluate` decision guide. It is imported below so it auto-loads when
> editing `*.spec.ts` files.

@browser_tests/README.md

Jump to the most-referenced sections:

- [Writing Tests](../../browser_tests/README.md#writing-tests) — structure,
  helpers, locator style, type safety, `page.evaluate`
- [Test Tags](../../browser_tests/README.md#test-tags)
- [Test Data & Typed API Mocks](../../browser_tests/README.md#test-data--typed-api-mocks)
- [Flake Prevention](../../browser_tests/README.md#flake-prevention)
