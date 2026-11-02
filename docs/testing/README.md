# ComfyUI Frontend Testing Guide

Unit and component tests sit next to their source as `sourceFile.test.ts`.
Playwright specs live in `browser_tests/` and use `.spec.ts`.

- [Testing principles](../guidance/testing-principles.md): design rules for every test level, with [worked examples](./testing-principles-examples.md)
- [Vitest conventions](../guidance/vitest.md): setup defaults, mocking, Pinia, i18n, timers, and concurrency for unit tests
- [Component testing](./component-testing.md): Vue component tests with Testing Library
- [Playwright conventions](../guidance/playwright.md) and [`browser_tests/README.md`](../../browser_tests/README.md): E2E tests
- [E2E coverage strategy](./e2e-coverage-strategy.md): how Playwright coverage is measured
- [Cloud billing E2E](./cloud-billing-e2e.md): live Cloud billing specs
