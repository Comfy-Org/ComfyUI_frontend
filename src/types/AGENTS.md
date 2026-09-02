# Type Guidelines

## Branded IDs

- The only acceptable place to cast, brand, or mint an ID type is the relevant
  `src/types/*Id.ts` module.
- Production code, tests, fixtures, and mocks must use the exported helper from
  that module, such as `nodeId(...)` or `widgetId(...)`.
- Do not use local casts such as `'1' as NodeId` outside the defining ID module.
- If a new ID brand is needed, add its constructor/parser helpers in its own
  `src/types/*Id.ts` file and use those helpers everywhere else.
