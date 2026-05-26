---
globs:
  - '**/*.test.ts'
---

# Vitest Unit Test Conventions

See `docs/testing/*.md` for detailed patterns.

## Test Quality

- Do not write change detector tests (tests that just assert defaults)
- Do not write tests dependent on non-behavioral features (styles, classes)
- Do not write tests that just test mocks - ensure real code is exercised
- Be parsimonious; avoid redundant tests

## Mocking

- Use Vitest's mocking utilities (`vi.mock`, `vi.spyOn`)
- Keep module mocks contained - no global mutable state
- Use `vi.hoisted()` for per-test mock manipulation
- Don't mock what you don't own

## Component Testing

- Use `@testing-library/vue` with `@testing-library/user-event` for component tests (an ESLint rule bans `@vue/test-utils` in new tests)
- Follow advice about making components easy to test
- Wait for reactivity with `await nextTick()` after state changes

## Running Tests

```bash
pnpm test:unit                       # Run all unit tests
pnpm test:unit path/to/file          # Filter by substring of test file path
pnpm test:unit foo.test.ts -t "name" # Filter by test name (regex; it()/test() only, not describe())
```

Do not use the `--` separator before vitest args; pnpm forwards extra args automatically, and `--` mangles quoted args (e.g. `-t "two words"`) on Windows PowerShell.
