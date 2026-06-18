---
globs:
  - '**/*.test.ts'
  - '**/*.spec.ts'
---

# Vitest Patterns

## Setup

Use `createTestingPinia` from `@pinia/testing`, not `createPinia`:

```typescript
import { createTestingPinia } from '@pinia/testing'
import { setActivePinia } from 'pinia'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

describe('MyStore', () => {
  beforeEach(() => {
    setActivePinia(createTestingPinia({ stubActions: false }))
    vi.useFakeTimers()
    vi.resetAllMocks()
  })

  afterEach(() => {
    vi.useRealTimers()
  })
})
```

**Why `stubActions: false`?** By default, testing pinia stubs all actions. Set to `false` when testing actual store behavior.

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

### Reset all mocks at once

```typescript
beforeEach(() => {
  vi.resetAllMocks() // Not individual mock.mockReset() calls
})
```

### Module mocks with vi.mock()

```typescript
vi.mock('@/scripts/api', () => ({
  api: {
    addEventListener: vi.fn(),
    fetchData: vi.fn()
  }
}))

vi.mock('@/services/myService', () => ({
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
