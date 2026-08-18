# Mock Data Fixtures

Deterministic, typed mock data for browser (Playwright) tests. Each fixture
exports objects that conform to generated types (`packages/ingest-types`,
`packages/registry-types`) or Zod schemas in `src/schemas/`.

> **Guidance moved.** Usage with `page.route()`, the route-before-navigation
> caveat, the full source-of-truth table for mock types, and the rules for
> adding new fixtures now live in the canonical guide:
> **[`browser_tests/README.md` → Test Data & Typed API Mocks](../../README.md#test-data--typed-api-mocks)**.
