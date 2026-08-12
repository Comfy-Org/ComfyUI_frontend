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
- Vitest automatically resets mocks, restores spies, and unstubs globals and
  environment variables before each test. Do not repeat that cleanup in test
  lifecycle hooks.
- Install `vi.stubGlobal()` and `vi.spyOn()` calls in `beforeEach` or in the
  test that needs them. Module-scope stubs and spies are removed before the
  first test runs.
- Module-scope `vi.fn()` declarations may provide reset-persistent defaults by
  passing the implementation directly to `vi.fn(implementation)`.

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
also works and replaces the guard for that test, but do it in a `beforeEach` or
inside the test body. A `vi.stubGlobal` at module scope does stay in place by
default, but nothing owns restoring it: any `vi.unstubAllGlobals()` - a cleanup
hook, another test tidying up after itself, or enabling the `unstubGlobals`
config option - drops it and puts the real `fetch` back without failing
anything.

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

## Expensive Imports Belong at Module Scope

Never `await import()` a view, a page-level component, an extension module or a
lazy route loader from inside `it()` - or from inside `beforeEach`, `beforeAll`
or any other lifecycle hook. Transforming and evaluating one of those module
graphs takes seconds, and wherever you put it that time is charged against a
budget: the 5s `testTimeout` in a test body, the 10s `hookTimeout` in a hook. A
test that asserts nothing more than a wiring detail then fails on module-loading
speed rather than on behaviour.

Re-importing per test behind `vi.resetModules()` is the worst case - it pays the
cost again for every test in the file. If a module registers something as an
import side effect, import it once at module scope and reset the observable
state instead.

The failure is scheduling-dependent, so it looks like flake. Vitest caches each
file's duration in `node_modules/.vite/vitest/*/results.json` and runs the
slowest files first, so an import-heavy file promotes itself into the opening
wave - where Vite's transform cache is still cold, every worker is booting its
own environment, and they are all queued against a single main process. The same
import that is affordable mid-run blows the budget there. A fresh checkout has
no duration cache and orders by file size instead, so the ranking (and often
whether it fails at all) changes between the first run and every run after.

CI does not persist the cache, so it always orders by file size - which is why
this class of failure can reproduce locally and pass in CI.

Do the import at module scope instead. File collection is untimed, so the same
work costs nothing against a test or hook budget:

```ts
// Not inside it(): a static import is hoisted above the consts that vi.mock
// factories close over, so keep it a top-level dynamic import.
const { default: SomeView } = await import('./SomeView.vue')
```
