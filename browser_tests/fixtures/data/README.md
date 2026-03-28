# Mock Data Fixtures

Deterministic mock data for browser (Playwright) tests. Each fixture
exports typed objects that conform to the Zod schemas defined in
`src/schemas/`.

## Usage with `page.route()`

```ts
import { mockNodeDefinitions } from '../fixtures/data/nodeDefinitions'
import { mockSystemStats } from '../fixtures/data/systemStats'

// Intercept the object_info API call
await page.route('**/api/object_info', (route) =>
  route.fulfill({ json: mockNodeDefinitions })
)

// Intercept the system_stats API call
await page.route('**/api/system_stats', (route) =>
  route.fulfill({ json: mockSystemStats })
)
```

## Adding new fixtures

1. Locate the Zod schema in `src/schemas/` for the endpoint you need.
2. Create a new `.ts` file here that imports and satisfies the
   corresponding TypeScript type.
3. Keep values realistic but stable — avoid dates, random IDs, or
   values that would cause test flakiness.
