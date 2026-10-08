---
globs:
  - '**/*.test.ts'
  - '**/__mocks__/**/*.ts'
---

# Vitest Unit Test Conventions

See `docs/testing/*.md` for detailed patterns.

## Test Quality

The rules that apply at every test level (behavioral assertions, tables over
copied bodies, mock only what you own, no sleeps, typed fixtures) live in
`docs/guidance/testing-principles.md`, which loads alongside this file. An
ESLint rule enforces the Testing Library query rule. Do not disable it.

## Mocking

- Use Vitest's mocking utilities (`vi.mock`, `vi.spyOn`)
- `vi.mock<unknown>(import('…'), …)` is only for legacy partial factories that
  cannot satisfy the module type. For new mocks, type the factory instead.
- Keep module mocks contained - no global mutable state
- Use `vi.hoisted()` only for bindings needed by a hoisted mock factory.
  Keep mutable scenario state inside the test that uses it.
- Vitest automatically resets mocks, restores spies, and unstubs globals and
  environment variables before each test, and shared mocks restore their own
  reactive state with `onTestFinished`. Do not repeat that cleanup in test
  lifecycle hooks.
- Install `vi.stubGlobal()` and `vi.spyOn()` calls in `beforeEach` or in the
  test that needs them. Module-scope stubs and spies are removed before the
  first test runs.
- `console.debug`, `error`, `info`, `log`, and `warn` are already spied before
  every test, and output from passing tests is hidden. Assert with
  `expect(console.error)` and configure with `vi.mocked(console.error)` instead
  of calling `vi.spyOn(console, 'error')`.
- Module-scope `vi.fn()` declarations may provide reset-persistent defaults by
  passing the implementation directly to `vi.fn(implementation)`.

### Shared manual mocks

- Put reusable module mocks in a same-named file under `__mocks__`. Activate
  them with `vi.mock(import('…'))`. Tests import the real module path and
  configure its functions with `vi.mocked`. Do not export mock-only setters,
  state, or duplicate spies.
- Type each complete default from the real function's return type. Preserve
  async and cancellation behavior. Pass the default implementation to
  `vi.fn<typeof realFn>` instead of setting it in `beforeEach`; `mockReset`
  restores that implementation before every test.
- A composable mock returns one stable object, so a test can configure it
  and then create the consumer that reads it. Configure replacement fields
  before creating consumers. Once a consumer captures a ref or object, keep
  that identity and update its backing state for the rest of the test. Because
  the result object is shared, tests that configure it must not run with
  `test.concurrent`.
- Until an older mock that builds a fresh object per call (`useBillingContext`)
  is converted, pin it in the test with
  `vi.mocked(useX).mockReturnValue(useX())` before configuring the result.
- Do not use `mock.results` or other call history as a cache. Keep shared
  result identity explicit in the test that needs it.
- Override only the field the test needs. Do not rebuild a full result with
  nested spreads or add hooks that repeat the shared defaults.

#### Mock state that `mockReset` does not touch

`mockReset` restores `vi.fn` implementations and call history, not plain
fields, `reactive()` objects, or `ref` values. A test that writes
`useFeatureFlags().flags.assetsEnabled = true` leaks it into every later test
unless the mock restores it. Register the restore with `onTestFinished` inside
the mock function, so every test that touches the mock cleans up after itself:

```ts
import { onTestFinished, vi } from 'vitest'

type FeatureFlags = ReturnType<typeof realUseFeatureFlags>['flags']

const defaultFlags: FeatureFlags = {
  assetsEnabled: false,
  hostedBillingDestination: 'stripe'
}

const featureFlags: ReturnType<typeof realUseFeatureFlags> = {
  flags: reactive({ ...defaultFlags }),
  featureFlag: vi.fn((_, defaultValue) => computed(() => defaultValue))
}

export const useFeatureFlags = vi.fn(() => {
  onTestFinished(() => {
    Object.assign(featureFlags.flags, defaultFlags)
  })
  return featureFlags
})
```

Restore writable values in place (`Object.assign(reactiveObject, defaults)`,
`someRef.value = default`). For replaceable fields containing readonly refs,
the mock can use `Object.assign(state, defaults())` in `onTestFinished` to
install fresh refs without changing the result object's identity. Finish async
work and dispose consumers before this cleanup. No consumer may retain these
fields across tests.
The next test configures the result before creating its consumers. Build fresh
mutable defaults on each reset, and keep action spies outside that factory.

Do not call `beforeEach` inside a mock module: it binds to the file being
collected, so a cached module (`isolate: false`) registers no hook for later
files, and a re-import after `vi.resetModules()` registers a duplicate.

`onTestFinished` throws `Hook onTestFinished() can only be called inside a
test` when the mock is called at `describe` scope or in `beforeAll`. That is
intended: configure mock state in `beforeEach` or in the test, where the
cleanup can be attached to the test that dirtied it.

#### Reactive fields: match the real contract

- Writable (`flags.x`, `enableAppBuilder`): back it with `reactive()` or
  `ref` and assign it in the test. When the contract types it `readonly`,
  write through `vi.mocked(useFeatureFlags().flags).x = true`.
- Derived with a real mutator (`mode` set by `setMode`): derive every
  `computed` from one private source and implement the mutator against it, so
  related fields cannot disagree. Tests call the mutator; the mock restores
  the source:

  ```ts
  const mode = ref<AppMode>('graph')
  const appMode: ReturnType<typeof realUseAppMode> = {
    mode: computed(() => mode.value),
    isArrangeMode: computed(() => mode.value === 'builder:arrange'),
    setMode: vi.fn((next) => {
      mode.value = next
    })
  }
  export const useAppMode = vi.fn(() => {
    onTestFinished(() => {
      mode.value = 'graph'
    })
    return appMode
  })
  ```

- Derived with no mutator (`isLoggedIn`, `canTopUp`): configure a computed
  field before creating the consumer. Keep the writable scenario ref local
  to the test and update it to drive changes through the captured computed:

  ```ts
  const loggedIn = ref(false)
  useCurrentUser().isLoggedIn = computed(() => loggedIn.value)
  ```

  The mock owns restoring the field after the test. Do not add getter spies
  or mock-only setters when this setup suffices. If the field itself is
  non-replaceable, use a getter spy that reads the local ref; `restoreMocks`
  restores the getter. A fixed getter return does not provide a reactive
  dependency for consumer computeds.

## No Real Network

`vitest.network.setup.ts` blocks every `http(s)` `fetch`, and happy-dom is configured not
to load iframes, stylesheets or scripts from remote hosts. A blocked request
rejects with `Blocked a real network request to <url>`.

This is deliberate, not an inconvenience to route around. happy-dom serves the
page from `http://localhost:3000`, so an un-mocked relative `fetch('/api/...')`
becomes a real connection whose failure arrives _after_ the test that started it
has finished. Vitest then reports the late `console.error` as an unhandled
error - `Closing rpc while "onUserConsoleLog" was pending` - against whichever
file happened to be running, and fails the run with every test passing.

If you hit the guard, mock the module that issues the request, or configure
the global `fetch`. The guard is a `vi.fn`, so `mockReset` puts it back before
every test. Configure it with `vi.mocked(fetch)` in a `beforeEach` or the test,
and return real `Response` objects:

```ts
vi.mocked(fetch).mockResolvedValue(Response.json({ ok: true }))
vi.mocked(fetch).mockImplementation(async (input) =>
  String(input).endsWith('/missing')
    ? new Response(null, { status: 404 })
    : Response.json({})
)
```

A `Response` body can be read once. When several requests share a response,
use `mockImplementation` to build a fresh one per call. Do not replace `fetch`
with `vi.stubGlobal`, `vi.spyOn(globalThis, 'fetch')`, or assignment;
`comfy/no-redundant-fetch-stub` reports it. To wrap the current fake, capture
`vi.mocked(fetch).getMockImplementation()` instead of `fetch` itself, which is
the same mock and would call itself.

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

## Selective Concurrency

Tests within a file run sequentially by default. `vite.config.mts` defines two
mutually exclusive tags for suites and individual tests:

- `{ tags: ['concurrent-safe'] }` enables concurrent execution. Use it for async
  tests whose state and cleanup belong to each test, including inherited hooks.
- `{ tags: ['shared-state'] }` keeps tests sequential. Use it for known conflicts
  involving active Pinia, shared mocks, fake timers, the DOM, or singleton state.

`shared-state` is a scheduling boundary among siblings, not a global lock.
Keep conflicting groups under a sequential ancestor. Do not put them beneath
separate concurrent branches or use explicit `.concurrent` modifiers to override
the tag. Separate files still run in parallel.

The `tooling` project loads only the network guard. Script tests that need
frontend setup belong in `FRONTEND_SCRIPT_TESTS` in `vite.config.mts`.
The `frontend` project still installs global Pinia, timer, and DOM cleanup hooks;
its tests are not safe to mark concurrent until those dependencies are isolated.
Frontend setup rejects concurrent tests and concurrent ancestor suites before
the test body runs. A `shared-state` tag on a child cannot protect it from a
separate concurrent ancestor branch.
Automatic mock resets and global unstubbing also affect concurrent tests in the
same worker, so concurrent tests must not mutate shared mocks or globals.

Use the test context's `expect` for concurrent assertions. Allocate and dispose
resources inside each test, as in `scripts/cicd/check-binary-size.test.ts`.
Verify both filtered and mixed runs without retries:

```bash
pnpm test:unit --tags-filter=concurrent-safe --retry=0
pnpm test:unit --tags-filter=shared-state --retry=0
pnpm test:unit --retry=0
```

### Own setup resources and test teardown

Capture each resource in the setup that creates it. Return a cleanup callback
from `beforeEach`, or use a test-scoped `test.extend` fixture with `try/finally`.
Dispose that exact resource rather than looking up a mutable global during
teardown. Global Pinia setup follows this rule, but implicit `useStore()` calls
still depend on shared active Pinia and are not concurrency-local.

For a concurrent store fixture, pass its Pinia explicitly through the full
dependency path. Audit nested store lookups and asynchronous callbacks too.
Do not use `createTestingPinia()` as a concurrency workaround: it also changes
active Pinia. Keep shared DOM, timers, module mocks, and registries in the
sequential project until their consumers no longer depend on shared state.

Audited store suites can use `test` from `@/testing/pinia` and join
`ISOLATED_STORE_TESTS` in `vite.config.mts`. That list selects the
`isolated-stores` Node project and excludes the suites from frontend setup.
The fixture creates a real Pinia per test, with real actions and no automatic
spies. Pass the context's `pinia` to every store lookup, and use the context's
`expect` for concurrent assertions. `entityIdStore.test.ts` is a migrated example.

The fixture holds a disposable owner across `await use(pinia)`. Its `using`
scope disposes that exact Pinia after the test, including on failure. Putting
`using` inside a `beforeEach` callback would dispose the resource before the
test starts. Do not add suites that need global mocks, DOM, fake timers, or
implicit store lookups to this project.

Await or cancel work before disposing its dependencies. Use readiness promises
or explicit timer advancement instead of sleeps. Pin inputs such as time,
locale, random seeds, and IDs when assertions depend on them.

Assert teardown effects from the test context's `onTestFinished` callback,
after `afterEach` and returned setup cleanup. Do not split setup and verification
between two tests: the second test must work when run alone or first.

Run changed suites alone and together, with retries disabled and multiple
recorded shuffle seeds. To test cross-file reuse with `isolate: false`, use one
worker so files actually share a worker. Shuffled passes are evidence, not proof
that every interleaving is safe. Use controlled overlapping lifetimes to verify
that one test's cleanup leaves another test's resources usable.

Vitest 4.1.11 does not propagate CLI `--maxConcurrency` into projects. Set
`test.maxConcurrency` in configuration when comparing limits, and verify actual
overlap rather than relying on the command-line value.

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
