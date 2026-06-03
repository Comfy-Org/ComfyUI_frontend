import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import type { Ref } from 'vue'
import { effectScope, ref } from 'vue'

const hoisted = vi.hoisted(() => ({
  trackSearchQuery: vi.fn()
}))

vi.mock('@/platform/telemetry', () => ({
  useTelemetry: () => ({ trackSearchQuery: hoisted.trackSearchQuery })
}))

import { useSearchQueryTracking } from './useSearchQueryTracking'

const DEBOUNCE_FLUSH_MS = 600
const flush = () => new Promise((r) => setTimeout(r, DEBOUNCE_FLUSH_MS))

function track(query: Ref<string>, resultCount: Ref<number>) {
  const scope = effectScope()
  scope.run(() => {
    useSearchQueryTracking('node_sidebar', query, resultCount)
  })
  return scope
}

describe('useSearchQueryTracking', () => {
  beforeEach(() => {
    hoisted.trackSearchQuery.mockClear()
  })

  afterEach(() => {
    vi.useRealTimers()
  })

  it('fires with surface, trimmed query, length, and result_count', async () => {
    const query = ref('')
    const resultCount = ref(3)
    track(query, resultCount)
    query.value = '  hello  '
    await flush()
    expect(hoisted.trackSearchQuery).toHaveBeenCalledExactlyOnceWith({
      surface: 'node_sidebar',
      query: 'hello',
      query_length: 5,
      result_count: 3,
      has_results: true
    })
  })

  it('sets has_results false when result_count is 0', async () => {
    const query = ref('')
    const resultCount = ref(0)
    track(query, resultCount)
    query.value = 'nothingmatches'
    await flush()
    expect(hoisted.trackSearchQuery).toHaveBeenCalledExactlyOnceWith({
      surface: 'node_sidebar',
      query: 'nothingmatches',
      query_length: 14,
      result_count: 0,
      has_results: false
    })
  })

  it('skips empty queries', async () => {
    const query = ref('seed')
    const resultCount = ref(2)
    track(query, resultCount)
    query.value = '   '
    await flush()
    expect(hoisted.trackSearchQuery).not.toHaveBeenCalled()
  })
})
