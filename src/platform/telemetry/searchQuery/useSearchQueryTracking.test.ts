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

function track(query: Ref<string>, results: Ref<{ length: number }>) {
  const scope = effectScope()
  scope.run(() => {
    useSearchQueryTracking('node_sidebar', query, results)
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
    const results = ref<string[]>(['a', 'b', 'c'])
    track(query, results)
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

  it('sets has_results false when results are empty', async () => {
    const query = ref('')
    const results = ref<string[]>([])
    track(query, results)
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
    const results = ref<string[]>(['a', 'b'])
    track(query, results)
    query.value = '   '
    await flush()
    expect(hoisted.trackSearchQuery).not.toHaveBeenCalled()
  })
})
