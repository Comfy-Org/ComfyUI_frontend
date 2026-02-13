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

## i18n in Component Tests

Use real `createI18n` with empty messages instead of mocking `vue-i18n`. See `SearchBox.test.ts` for example.

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

### Partial object mocks with `satisfies`

When mocking a class instance with only the properties your test needs, use
`satisfies Partial<Omit<T, 'constructor'>> as unknown as T`. This validates
the mock's shape against the real type while allowing the incomplete cast.

The `Omit<..., 'constructor'>` is needed because class types expose a
`constructor` property whose type (`LGraphNodeConstructor`, etc.) conflicts
with the plain object's `Function` constructor.

```typescript
// ✅ Shape-checked partial mock
function mockSubgraphNode(proxyWidgets?: NodeProperty) {
  return {
    properties: { proxyWidgets }
  } satisfies Partial<
    Omit<SubgraphNode, 'constructor'>
  > as unknown as SubgraphNode
}

// ❌ Unchecked — typos and shape mismatches slip through
function mockSubgraphNode(proxyWidgets?: unknown): SubgraphNode {
  return { properties: { proxyWidgets } } as unknown as SubgraphNode
}
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
