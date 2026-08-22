---
globs:
  - '**/*.ts'
  - '**/*.tsx'
  - '**/*.vue'
---

# TypeScript Conventions

## Type Safety

- Never use `any` type - use proper TypeScript types
- Never use `as any` type assertions - fix the underlying type issue
- Type assertions are a last resort; they lead to brittle code
- Avoid `@ts-expect-error` - fix the underlying issue instead

### Type Assertion Hierarchy

When you must handle uncertain types, prefer these approaches in order:

1. ✅ **No assertion** — Properly typed from the start
2. ✅ **Type narrowing** — `if ('prop' in obj)` or type guards
3. ⚠️ **Specific assertion** — `as SpecificType` when you truly know the type
4. ⚠️ **`unknown` with narrowing** — For genuinely unknown data
5. ❌ **`as any`** — FORBIDDEN

### Zod Schema Rules

- Never use `z.any()` — it disables validation and propagates `any` into types
- Use `z.unknown()` if the type is genuinely unknown, then narrow it
- Never add test-only settings/types to production schemas

### Server/API Response Types

- Never hand-declare or inline types for server/API responses — import them from the generated shared types package (`@comfyorg/ingest-types` for Comfy Cloud's ingest API, `@comfyorg/registry-types` for the Registry API; both under `packages/`). Hand-declared copies silently drift from the real contract. This caused two real bugs in PR #14771: a status value missing from a hand-declared response type, and a hand-declared pagination type missing fields the generated one had.
- A thin local intersection type on top of the generated export is fine for genuine FE-only extensions; a full local redeclaration is not.
- Never omit a generated field and re-declare it locally. `Omit<Generated, 'k'> & { k?: Narrower }` reads like a derivation but replaces the contract for `k`, so the spec can change `k` underneath you with no compile error. To relax presence only, use `Omit<Generated, 'k'> & Partial<Pick<Generated, 'k'>>` — the field's type still comes from the contract. To model something genuinely different, give it a distinct name.
- `comfy/no-duplicate-ingest-type` (see `tools/oxlint-plugins/`) enforces the two rules above for `@comfyorg/ingest-types`. It triggers on import provenance: a file that imports `X` from the package may not also declare `X`, unless the declaration derives from that same import without re-declaring anything it omitted. A local type that merely shares a name with a generated export is never reported, so regenerating the types cannot redden unrelated files.
- `comfy/no-new-zod-for-remote-api-types` (ESLint, scoped to `src/platform/remote/**`) enforces the same contract for response _schemas_. It deliberately remains remote-only: Zod is also the right tool for local-backend, form, and UI models outside that tree.
- That trigger is deliberately narrow, and it bounds what the rule can do for you: a response type written from scratch, with no import from the package at all, is invisible to it. Catching that is a review responsibility — check that new API response types are imported rather than typed by hand.
- The drift check is narrow in the same way. Among derivations it recognises only omit-then-redeclare; one that reshapes the contract another way — `Pick<Generated, …> & { … }`, or a generic wrapping the import — passes, because judging whether the result still matches the contract needs type information the linter does not have. Both gaps fail open, so the rule under-reports rather than blocking correct code.
- Prefer the generated Zod schemas (`@comfyorg/ingest-types/zod`) over hand-written ones when validating a response. `zThing.pick({ ... })` widens automatically when the spec does; a hand-written `z.enum([...])` silently starts rejecting valid payloads.

### Public API Contracts

- Keep public API types stable (e.g., `ExtensionManager` interface)
- Don't expose internal implementation types (e.g., Pinia store internals)
- Reactive refs (`ComputedRef<T>`) should be unwrapped before exposing

## Avoiding Circular Dependencies

Extract type guards and their associated interfaces into **leaf modules** — files with only `import type` statements. This keeps them safe to import from anywhere without pulling in heavy transitive dependencies.

```typescript
// ✅ myTypes.ts — leaf module (only type imports)
import type { IBaseWidget } from '@/lib/litegraph/src/types/widgets'

export interface MyView extends IBaseWidget {
  /* ... */
}
export function isMyView(w: IBaseWidget): w is MyView {
  return 'myProp' in w
}

// ❌ myView.ts — heavy module (runtime imports from stores, utils, etc.)
//    Importing the type guard from here drags in the entire dependency tree.
```

## Utility Libraries

- Use `es-toolkit` for utility functions (not lodash)

## API Utilities

When making API calls in `src/`:

```typescript
// ✅ Correct - use api helpers
const response = await api.get(api.apiURL('/prompt'))
const template = await fetch(api.fileURL('/templates/default.json'))

// ❌ Wrong - direct URL construction
const response = await fetch('/api/prompt')
```

## Security

- Sanitize HTML with `DOMPurify.sanitize()`
- Never log secrets or sensitive data
