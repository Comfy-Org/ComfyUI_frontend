---
globs:
  - '**/*.test.ts'
---

# Vitest Patterns

## Setup

`vitest.setup.ts` creates a fresh active testing Pinia before each test with
`stubActions: false` and disposes the active Pinia afterward to stop store
watchers. Use real store composables inside tests or `beforeEach`. Do not mock
their modules, mock Pinia, or create another Pinia instance.

Set scenario state on the store. Actions already have spies, but execute their
implementations unless you stub them:

```typescript
import { beforeEach, vi } from 'vitest'

import { useSettingStore } from '@/platform/settings/settingStore'

beforeEach(() => {
  const settings = useSettingStore()
  settings.settingValues['Comfy.WorkflowActions.SeenItems'] = []
  vi.mocked(settings.set).mockResolvedValue()
})
```

Stub actions only when the test needs to isolate their effects. Keep the action
under test real. Use `vi.mocked(store.action)` to access `.mock` or configure
return values without changing the store's types.

For component tests, configure the same Pinia instance that the component uses.
Pass `getActivePinia()!` from `pinia` to the mount's `global.plugins` when it
needs injection. Set scenario state directly or with `store.$patch()` rather
than creating a Pinia with `initialState`. Stub individual actions to isolate
their effects; keep actions under test real.

`pnpm lint` enforces `comfy/use-global-pinia` in `.test` and `.spec` files and
in `__test__`, `__tests__`, and `__fixtures__` directories, including files
covered by the separate Oxlint audit. It rejects Pinia factory imports,
namespace access to factories, Pinia module mocks, and replacements of store
composables. Non-Pinia modules such as `layoutStore` and spies on real store
actions remain allowed. Only the global setup owns Pinia creation and disposal.

### Avoid hook-assigned aliases of store actions

Read an action from its store where it is used instead of caching it in a
suite-level `let` assigned by `beforeEach`:

```typescript
vi.mocked(useToastStore().addAlert).mockImplementation(() => {})
expect(useToastStore().addAlert).toHaveBeenCalledWith('Upload failed')
```

Use a test-local `const store = useToastStore()` when several accesses become
hard to read. Keep shared variables when they own a per-test resource, a
reactive fixture, or a value that teardown must restore.

### Capture import-time extension registration

Use `createExtensionCapture` for tests that need registered extension hooks
without running registration services. Create one capture per test file and
keep the mock factory in that file:

```typescript
const extensions = await vi.hoisted(async () => {
  const { createExtensionCapture } =
    await import('@/utils/__tests__/extensionTestUtils')
  return createExtensionCapture()
})

vi.mock(import('@/scripts/app'), async (importOriginal) => {
  const original = await importOriginal()
  original.app.registerExtension = extensions.registerExtension
  return original
})

await import('@/extensions/core/customWidgets')
const extension = extensions.getExtension('Comfy.CustomWidgets')
```

For an existing partial app or extension-service mock, replace only its
`registerExtension` member. The capture retains registrations across Vitest's
mock resets; named lookup throws if the module did not register that extension.
Use the authoritative `ComfyExtension` hook signatures rather than casting the
captured object to a custom hook interface. Reset scenario state per test, not
the module cache. Each capture owns its registrations; there is no shared
registry or Pinia setup in the helper.

## Don't Mock `vue-i18n` — Use a Real Plugin

Mount with a real `createI18n` instance instead of mocking `vue-i18n`. The plugin is cheap, owned by a third party (don't mock what you don't own), and a real instance exercises the same translation key resolution and pluralization logic that production uses.

This applies to **all tests** that touch a component or composable calling `useI18n()` — not just component tests.

```typescript
import { createI18n } from 'vue-i18n'

const i18n = createI18n({
  legacy: false,
  locale: 'en',
  messages: { en: {} } // empty — assertions key off the translation key, not the rendered string
})

// Component tests: pass via global plugins
mount(MyComponent, { global: { plugins: [i18n] } })

// Composable tests: provide via a host component (see useMediaAssetActions.test.ts pattern)
const app = createApp(HostComponent)
app.use(i18n)
```

Real example: [`src/components/searchbox/v2/__test__/testUtils.ts`](../../src/components/searchbox/v2/__test__/testUtils.ts) exports a shared `testI18n` instance.

### Asserting on translation keys

With empty messages, `t('foo.bar')` returns `'foo.bar'` (the key). Assert against the key directly — no need to mock `t`:

```typescript
expect(toastSpy).toHaveBeenCalledWith(
  expect.objectContaining({ detail: 'mediaAsset.selection.exportStarted' })
)
```

For pluralization / interpolation arguments, spy on the consumer (e.g. the toast `add` fn) and inspect the captured payload, rather than spying on `t` itself.

## Mock Patterns

### Automatic mock cleanup

All Vitest configurations enable `mockReset`, `restoreMocks`, `unstubEnvs`,
and `unstubGlobals`. Do not call the corresponding cleanup APIs in
`beforeEach` or `afterEach`.

Cleanup calls inside a test remain valid when the test intentionally separates
multiple action and assertion phases.

Because cleanup runs before every test, module-scope `vi.stubGlobal()` and
`vi.spyOn()` calls are removed before the first test executes. Install them in
`beforeEach` or in the test that needs them:

```typescript
beforeEach(() => {
  vi.stubGlobal('fetch', fetchMock)
  vi.spyOn(console, 'error').mockImplementation(() => {})
})
```

Module-scope mock declarations remain appropriate. When a default
implementation must survive automatic reset, pass it directly to `vi.fn()`:

```typescript
const fetchMock = vi.fn(async () => ({ ok: true }))
```

### Module mocks with vi.mock()

```typescript
vi.mock(import('@/scripts/api'), () => ({
  api: {
    addEventListener: vi.fn(),
    fetchData: vi.fn()
  }
}))

vi.mock(import('@/services/myService'), () => ({
  myService: {
    doThing: vi.fn()
  }
}))
```

### Configure mocks in tests

```typescript
import { api } from '@/scripts/api'
import { myService } from '@/services/myService'

it('handles success', () => {
  vi.mocked(myService.doThing).mockResolvedValue({ data: 'test' })
  // ... test code
})
```

## Testing Event Listeners

When a store registers event listeners at module load time:

```typescript
function getEventHandler() {
  const call = vi
    .mocked(api.addEventListener)
    .mock.calls.find(([event]) => event === 'my_event')
  return call?.[1] as (e: CustomEvent<MyEventType>) => void
}

function dispatch(data: MyEventType) {
  const handler = getEventHandler()
  handler(new CustomEvent('my_event', { detail: data }))
}

it('handles events', () => {
  const store = useMyStore()
  dispatch({ field: 'value' })
  expect(store.items).toHaveLength(1)
})
```

## Testing with Fake Timers

For stores with intervals, timeouts, or polling:

```typescript
beforeEach(() => {
  vi.useFakeTimers()
})

afterEach(() => {
  vi.useRealTimers()
})

it('polls after delay', async () => {
  const store = useMyStore()
  store.startPolling()

  await vi.advanceTimersByTimeAsync(30000)

  expect(mockService.fetch).toHaveBeenCalled()
})
```

## Assertion Style

Prefer `.toHaveLength()` over `.length.toBe()`:

```typescript
// Good
expect(store.items).toHaveLength(1)

// Avoid
expect(store.items.length).toBe(1)
```

Use `.toMatchObject()` for partial matching:

```typescript
expect(store.completedItems[0]).toMatchObject({
  id: 'task-123',
  status: 'done'
})
```
