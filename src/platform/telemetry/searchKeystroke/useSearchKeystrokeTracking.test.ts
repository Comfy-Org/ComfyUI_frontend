import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import type { Ref } from 'vue'
import { effectScope, ref } from 'vue'

const hoisted = vi.hoisted(() => ({
  subscriptionTier: { value: 'FREE' as string | null },
  trackSearchKeystroke: vi.fn(),
  shouldThrow: { value: false }
}))

vi.mock('@/platform/cloud/subscription/composables/useSubscription', () => ({
  useSubscription: () => {
    if (hoisted.shouldThrow.value) throw new Error('store unavailable')
    return { subscriptionTier: hoisted.subscriptionTier }
  }
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
    hoisted.subscriptionTier.value = 'FREE'
    hoisted.shouldThrow.value = false
  })

  afterEach(() => {
    vi.useRealTimers()
  })

  it('does not fire for FREE users', async () => {
    const query = ref('')
    track(query)
    query.value = 'hello'
    await flush()
    expect(hoisted.trackSearchKeystroke).not.toHaveBeenCalled()
  })

  it('does not fire when subscriptionTier is null', async () => {
    hoisted.subscriptionTier.value = null
    const query = ref('')
    track(query)
    query.value = 'hello'
    await flush()
    expect(hoisted.trackSearchKeystroke).not.toHaveBeenCalled()
  })

  it('fires for paid users with the surface, trimmed query, and length', async () => {
    hoisted.subscriptionTier.value = 'PRO'
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

  it('skips empty queries even for paid users', async () => {
    hoisted.subscriptionTier.value = 'PRO'
    const query = ref('seed')
    track(query)
    query.value = '   '
    await flush()
    expect(hoisted.trackSearchKeystroke).not.toHaveBeenCalled()
  })

  it('treats a throwing subscription store as not paid', async () => {
    hoisted.shouldThrow.value = true
    const query = ref('')
    track(query)
    query.value = 'hello'
    await flush()
    expect(hoisted.trackSearchKeystroke).not.toHaveBeenCalled()
  })
})
