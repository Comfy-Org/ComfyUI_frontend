# LiteGraph Tests

This directory contains the test suite for the LiteGraph library.

## Structure

```
litegraph/
├── core/           # Core functionality tests (LGraph, LGraphNode, etc.)
├── canvas/         # Canvas-related tests (rendering, interactions)
├── infrastructure/ # Infrastructure tests (Rectangle, utilities)
├── subgraph/       # Subgraph-specific tests
├── utils/          # Utility function tests
└── fixtures/       # Test helpers, fixtures, and assets
```

## Running Tests

```bash
# Run all litegraph tests
npm run test:unit -- tests-ui/tests/litegraph/

# Run specific subdirectory
npm run test:unit -- tests-ui/tests/litegraph/core/

# Run single test file
npm run test:unit -- tests-ui/tests/litegraph/core/LGraph.test.ts
```

## Migration Status

These tests were migrated from `src/lib/litegraph/test/` to centralize test infrastructure. Currently, some tests are marked with `.skip` due to import/setup issues that need to be resolved.

### TODO: Fix Skipped Tests

The following test files have been temporarily disabled and need fixes:
- Most subgraph tests (circular dependency issues)
- Some core tests (missing test utilities)
- Canvas tests (mock setup issues)

See individual test files marked with `// TODO: Fix these tests after migration` for specific issues.

## Writing New Tests

1. Always import from the barrel export to avoid circular dependencies:
   ```typescript
   import { LGraph, LGraphNode } from '@/lib/litegraph/src/litegraph'
   ```

2. Use the test fixtures from `fixtures/` directory
3. Follow existing patterns for test organization

## Test Fixtures

Test fixtures and helpers are located in the `fixtures/` directory:
- `testExtensions.ts` - Custom vitest extensions
- `subgraphHelpers.ts` - Helpers for creating test subgraphs
- `subgraphFixtures.ts` - Common subgraph test scenarios
- `assets/` - Test data files