# Mock Data Fixtures

Deterministic, typed mock data for browser (Playwright) tests. Each fixture
exports objects that conform to generated types (`packages/ingest-types`,
`packages/registry-types`) or Zod schemas in `src/schemas/`.

> **Guidance moved.** Usage with `page.route()`, the route-before-navigation
> caveat, the full source-of-truth table for mock types, and the rules for
> adding new fixtures now live in the canonical guide:
> **[`browser_tests/README.md` → Test Data & Typed API Mocks](../../README.md#test-data--typed-api-mocks)**.

## `cloud/`

Not mock data: vendored inputs for `scripts/gen-cloud-manifest.ts`, which
generates `customNodeManifest.cloud.json`. `cloud/supported_nodes.yaml` is
a byte-exact copy of a Cloud-owned file. Never edit it locally; provenance
and the refresh procedure live in the generator's header.
