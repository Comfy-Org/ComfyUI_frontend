---
globs:
  - '**/*.test.ts'
---

# Vitest Unit Test Conventions

See `docs/testing/*.md` for detailed patterns.

## Test Quality

The general test rules (no change-detector tests, no non-behavioral assertions,
be parsimonious, don't mock what you don't own) live in the root `AGENTS.md`,
which is always loaded. In addition:

- Do not write tests that just test mocks - ensure real code is exercised (tests must fail when the code misbehaves)
- Aim for behavioral coverage of critical and new features

## Mocking

- Use Vitest's mocking utilities (`vi.mock`, `vi.spyOn`)
- Keep module mocks contained - no global mutable state
- Use `vi.hoisted()` for per-test mock manipulation

## No Real Network

`vitest.setup.ts` blocks every `http(s)` `fetch`, and happy-dom is configured not
to load iframes, stylesheets or scripts from remote hosts. A blocked request
rejects with `Blocked a real network request to <url>`.

This is deliberate, not an inconvenience to route around. happy-dom serves the
page from `http://localhost:3000`, so an un-mocked relative `fetch('/api/...')`
becomes a real connection whose failure arrives _after_ the test that started it
has finished. Vitest then reports the late `console.error` as an unhandled
error - `Closing rpc while "onUserConsoleLog" was pending` - against whichever
file happened to be running, and fails the run with every test passing.

If you hit the guard, mock the module that issues the request. Stubbing `fetch`
in your own test (`vi.stubGlobal('fetch', ...)`) also works and replaces the
guard for that test.

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
