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

### Public API Contracts

- Keep public API types stable (e.g., `ExtensionManager` interface)
- Don't expose internal implementation types (e.g., Pinia store internals)
- Reactive refs (`ComputedRef<T>`) should be unwrapped before exposing

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
