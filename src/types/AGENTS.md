# Type Guidelines

## Branded IDs

- Branded ID types live in `packages/graph-model/src/*Id.ts`. Only those
  modules may cast, brand, or mint an ID.
- Production code, tests, fixtures, and mocks use the exported helper, such as
  `toNodeId(...)` or `widgetId(...)`, never a local cast such as `'1' as NodeId`.
- A new ID brand gets its own `packages/graph-model/src/*Id.ts` module with its
  constructor and parser helpers.
