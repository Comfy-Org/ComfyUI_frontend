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
