---
globs:
  - '**/*.ts'
  - '**/*.tsx'
  - '**/*.vue'
---

# Code Style

## Formatting (via oxfmt)

- 2-space indent
- Single quotes
- No trailing semicolons
- 80 character width

Run `pnpm format` before committing.

## Imports

Use separate `import type` statements:

```typescript
// ✅ Correct
import type { Foo } from './foo'
import { bar } from './foo'

// ❌ Wrong
import { bar, type Foo } from './foo'
```

## Naming

- Vue components: `PascalCase.vue` (e.g., `MenuHamburger.vue`)
- Composables: `useXyz.ts`
- Pinia stores: `*Store.ts`

## Code Organization

- Minimize exported surface area per module
- No barrel files (`index.ts` re-exports) within `src/`
- Prefer function declarations over function expressions
- Keep functions short and focused
- Minimize nesting (avoid arrow anti-pattern)
- Favor immutability and pure functions

## Comments

Code should be self-documenting. Avoid comments unless absolutely necessary. If you must comment, explain *why*, not *what*.

## Libraries

- Use `es-toolkit` for utilities (not lodash)
- Use `VueUse` for reactive utilities
- Avoid new PrimeVue component usage
- Use vue-i18n for all user-facing strings
