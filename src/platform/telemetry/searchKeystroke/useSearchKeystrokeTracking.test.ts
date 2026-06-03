import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import type { Ref } from 'vue'
import { effectScope, ref } from 'vue'

const hoisted = vi.hoisted(() => ({
  trackSearchKeystroke: vi.fn()
}))

vi.mock('@/platform/telemetry', () => ({
  useTelemetry: () => ({ trackSearchKeystroke: hoisted.trackSearchKeystroke })
}))

import { useSearchKeystrokeTracking } from './useSearchKeystrokeTracking'

const DEBOUNCE_FLUSH_MS = 600
const flush = () => new Promise((r) => setTimeout(r, DEBOUNCE_FLUSH_MS))

function track(query: Ref<string>) {
  const scope = effectScope()
  scope.run(() => {
    useSearchKeystrokeTracking('node_sidebar', query)
  })
  return scope
}

describe('useSearchKeystrokeTracking', () => {
  beforeEach(() => {
    hoisted.trackSearchKeystroke.mockClear()
  })

  afterEach(() => {
    vi.useRealTimers()
  })

  it('fires with the surface, trimmed query, and length', async () => {
    const query = ref('')
    track(query)
    query.value = '  hello  '
    await flush()
    expect(hoisted.trackSearchKeystroke).toHaveBeenCalledExactlyOnceWith({
      surface: 'node_sidebar',
      query: 'hello',
      query_length: 5
    })
  })

  it('skips empty queries', async () => {
    const query = ref('seed')
    track(query)
    query.value = '   '
    await flush()
    expect(hoisted.trackSearchKeystroke).not.toHaveBeenCalled()
  })

  it('debounces rapid changes to a single event', async () => {
    const query = ref('')
    track(query)
    query.value = 'h'
    query.value = 'he'
    query.value = 'hel'
    query.value = 'hello'
    await flush()
    expect(hoisted.trackSearchKeystroke).toHaveBeenCalledExactlyOnceWith({
      surface: 'node_sidebar',
      query: 'hello',
      query_length: 5
    })
  })
})
