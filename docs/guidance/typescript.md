---
globs:
  - '**/*.ts'
  - '**/*.tsx'
  - '**/*.vue'
---

# TypeScript Conventions

## Type Safety

Type assertions are a last resort; they lead to brittle code.

### Prove the type before overriding it

Do not treat an assertion, suppression, or its comment as evidence that a value
has the claimed type. Before overriding the compiler:

1. Remove the override and read the complete diagnostic.
2. Trace the value to its runtime owner and authoritative type or schema.
3. Search the repository for an existing type, guard, parser, builder, or test
   fixture that owns the same boundary.
4. Fix the source type, narrow the value, or parse external data at the boundary.
5. Run the owning typecheck without the override.

Confirm that the typecheck project includes the changed file. `pnpm typecheck`
does not cover `browser_tests/`, `scripts/`, `tools/`, or `apps/billing-web/`. Use
`pnpm typecheck:browser`, `pnpm typecheck:scripts`, `pnpm typecheck:tools`, or
`pnpm typecheck:billing-web` for those paths.

Use real platform objects and generated types when they own the contract. For
example, construct a `Response` instead of casting an object to `Response`.
Model malformed runtime input as `unknown` and pass it through the boundary
parser. Do not use a double assertion to make invalid test data compile.

State any external constraint in the PR description. External constraints may
justify a specific assertion at an integration boundary, never a TypeScript
suppression. If an upstream declaration is wrong, verify its runtime shape and
do not spread assertions through consumers.

### Type Assertion Hierarchy

When you must handle uncertain types, prefer these approaches in order:

1. ✅ **No assertion** — Properly typed from the start
2. ✅ **Type narrowing** — `if ('prop' in obj)` or type guards
3. ✅ **`unknown` with narrowing**: For genuinely unknown data
4. ⚠️ **Specific assertion**: Only at a verified external boundary

### Zod Schema Rules

- Never use `z.any()` — it disables validation and propagates `any` into types
- Use `z.unknown()` if the type is genuinely unknown, then narrow it
- Never add test-only settings/types to production schemas

### Server/API Response Types

- Never hand-declare or inline types for server/API responses — import them from the generated shared types package (`@comfyorg/ingest-types` for Comfy Cloud's ingest API, `@comfyorg/registry-types` for the Registry API; both under `packages/`). Hand-declared copies silently drift from the real contract.
- A thin local intersection type on top of the generated export is fine for genuine FE-only extensions; a full local redeclaration is not.
- Never omit a generated field and re-declare it locally. `Omit<Generated, 'k'> & { k?: Narrower }` replaces the contract for `k`. To relax presence only, use `Omit<Generated, 'k'> & Partial<Pick<Generated, 'k'>>`. To model something genuinely different, give it a distinct name.
- `comfy/no-duplicate-ingest-type` catches these only for files that import the name from `@comfyorg/ingest-types`. A response type written from scratch with no import, or a `Pick<…> & { … }` reshaping, passes lint; check for those in review.
- Prefer the generated Zod schemas (`@comfyorg/ingest-types/zod`) over hand-written ones when validating a response. `zThing.pick({ ... })` widens automatically when the spec does; a hand-written `z.enum([...])` silently starts rejecting valid payloads.

### Public API Contracts

- Keep public API types stable (e.g., `ExtensionManager` interface)
- Don't expose internal implementation types (e.g., Pinia store internals)
- Reactive refs (`ComputedRef<T>`) should be unwrapped before exposing

## Avoiding Circular Dependencies

Extract type guards and their associated interfaces into **leaf modules** — files with only `import type` statements. This keeps them safe to import from anywhere without pulling in heavy transitive dependencies.

✅ `myTypes.ts` is a leaf module with only type imports:

```typescript
import type { IBaseWidget } from '@/lib/litegraph/src/types/widgets'

export interface MyView extends IBaseWidget {
  myProp: string
}
export function isMyView(w: IBaseWidget): w is MyView {
  return 'myProp' in w
}
```

❌ Putting the guard in `myView.ts`, a module with runtime imports from stores
and utils, makes every importer drag in its whole dependency tree.

## API Utilities

When making API calls in `src/`, never build the URL by hand
(`fetch('/api/prompt')`). `api.fetchApi(route)` applies `apiURL()` itself; use
`api.fileURL(route)` for non-`/api` assets:

```typescript
const response = await api.fetchApi('/prompt', { method: 'POST' })
const template = await fetch(api.fileURL('/templates/default.json'))
```

`apiURL(route)` prefixes `/api` (unless the route already starts with `/api`);
`fileURL(route)` does not. Use `apiURL()` directly only when you need the string
rather than the request.

## Security

- Sanitize HTML with `DOMPurify.sanitize()`
- Never log secrets or sensitive data
