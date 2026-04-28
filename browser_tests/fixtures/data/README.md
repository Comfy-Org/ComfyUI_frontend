# Mock Data Fixtures

Deterministic mock data for browser (Playwright) tests. Each fixture
exports typed objects that conform to generated types from
`packages/ingest-types` or Zod schemas in `src/schemas/`.

## Usage with `page.route()`

> **Note:** `comfyPageFixture` navigates to the app during `setup()`,
> before the test body runs. Routes must be registered before navigation
> to intercept initial page-load requests. Set up routes in a custom
> fixture or `test.beforeEach` that runs before `comfyPage.setup()`.

```ts
import { createMockNodeDefinitions } from '../fixtures/data/nodeDefinitions'
import { mockSystemStats } from '../fixtures/data/systemStats'

// Extend the base set with test-specific nodes
const nodeDefs = createMockNodeDefinitions({
  MyCustomNode: {
    /* ... */
  }
})

await page.route('**/api/object_info', (route) =>
  route.fulfill({ json: nodeDefs })
)

await page.route('**/api/system_stats', (route) =>
  route.fulfill({ json: mockSystemStats })
)
```

## Adding new fixtures

1. Locate the generated type in `packages/ingest-types` or Zod schema
   in `src/schemas/` for the endpoint you need.
2. Create a new `.ts` file here that imports and satisfies the
   corresponding TypeScript type.
3. Keep values realistic but stable — avoid dates, random IDs, or
   values that would cause test flakiness.
