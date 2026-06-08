import { createTestingPinia } from '@pinia/testing'
import { setActivePinia } from 'pinia'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import { useDeprecationWarningsStore } from '@/platform/dev/deprecationWarningsStore'

describe('useDeprecationWarningsStore', () => {
  beforeEach(() => {
    setActivePinia(createTestingPinia({ stubActions: false }))
    vi.useFakeTimers()
    vi.setSystemTime(new Date('2026-01-01T00:00:00Z'))
  })

  afterEach(() => {
    vi.useRealTimers()
  })

  it('appends a new warning when key is novel', () => {
    const store = useDeprecationWarningsStore()
    store.report({ message: 'thing is deprecated', source: 'frontend' })

    expect(store.warnings).toHaveLength(1)
    expect(store.warnings[0]).toMatchObject({
      message: 'thing is deprecated',
      source: 'frontend',
      count: 1
    })
  })

  it('increments count and updates lastSeenAt on duplicate report', () => {
    const store = useDeprecationWarningsStore()
    store.report({ message: 'thing is deprecated', source: 'frontend' })
    const initialLastSeenAt = store.warnings[0].lastSeenAt

    vi.advanceTimersByTime(5_000)
    store.report({ message: 'thing is deprecated', source: 'frontend' })

    expect(store.warnings).toHaveLength(1)
    expect(store.warnings[0].count).toBe(2)
    expect(store.warnings[0].lastSeenAt).toBe(initialLastSeenAt + 5_000)
  })

  it('treats different sources as distinct entries with the same message', () => {
    const store = useDeprecationWarningsStore()
    store.report({ message: 'foo', source: 'a' })
    store.report({ message: 'foo', source: 'b' })

    expect(store.warnings).toHaveLength(2)
  })

  it('orders warnings with the most recently seen first', () => {
    const store = useDeprecationWarningsStore()
    store.report({ message: 'first' })
    store.report({ message: 'second' })
    store.report({ message: 'third' })

    vi.advanceTimersByTime(1_000)
    store.report({ message: 'first' })

    expect(store.warnings.map((w) => w.message)).toEqual([
      'first',
      'third',
      'second'
    ])
  })

  it('stops tracking new keys once the cap is reached but keeps counting known ones', () => {
    const store = useDeprecationWarningsStore()
    for (let i = 0; i < 10_001; i++) {
      store.report({ message: `dep-${i}` })
    }

    expect(store.warnings).toHaveLength(10_000)

    const beforeRepeat = store.warnings.length
    store.report({ message: 'dep-0' })
    expect(store.warnings).toHaveLength(beforeRepeat)
    expect(store.warnings.find((w) => w.message === 'dep-0')?.count).toBe(2)
  })

  it('exposes unseenCount that resets after markAllSeen', () => {
    const store = useDeprecationWarningsStore()
    expect(store.unseenCount).toBe(0)

    store.report({ message: 'a' })
    store.report({ message: 'b' })
    expect(store.unseenCount).toBe(2)

    store.markAllSeen()
    expect(store.unseenCount).toBe(0)

    store.report({ message: 'c' })
    expect(store.unseenCount).toBe(1)
  })

  it('does not increase unseenCount when a duplicate is reported', () => {
    const store = useDeprecationWarningsStore()
    store.report({ message: 'a' })
    store.markAllSeen()
    store.report({ message: 'a' })

    expect(store.unseenCount).toBe(0)
    expect(store.warnings[0].count).toBe(2)
  })

  it('clear empties warnings and resets seen state', () => {
    const store = useDeprecationWarningsStore()
    store.report({ message: 'a' })
    store.report({ message: 'b' })
    store.markAllSeen()

    store.clear()

    expect(store.warnings).toEqual([])
    expect(store.unseenCount).toBe(0)

    store.report({ message: 'a' })
    expect(store.warnings).toHaveLength(1)
    expect(store.unseenCount).toBe(1)
  })
})
