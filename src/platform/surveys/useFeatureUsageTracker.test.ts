import { describe, expect, it, vi } from 'vitest'

import { useFeatureUsageTracker } from './useFeatureUsageTracker'

const STORAGE_KEY = 'Comfy.FeatureUsage'

describe('useFeatureUsageTracker', () => {
  it('initializes with zero count for new feature', () => {
    const { useCount } = useFeatureUsageTracker('test-feature-1')

    expect(useCount.value).toBe(0)
  })

  it('increments count on trackUsage', () => {
    const { useCount, trackUsage } = useFeatureUsageTracker('test-feature-2')

    expect(useCount.value).toBe(0)

    trackUsage()
    expect(useCount.value).toBe(1)

    trackUsage()
    expect(useCount.value).toBe(2)
  })

  it('sets firstUsed only on first use', () => {
    const firstTs = Date.now()
    const { usage, trackUsage } = useFeatureUsageTracker('test-feature-3')

    trackUsage()
    expect(usage.value?.firstUsed).toBe(firstTs)

    vi.advanceTimersByTime(5_000)
    trackUsage()
    expect(usage.value?.firstUsed).toBe(firstTs)
  })

  it('updates lastUsed on each use', () => {
    const { usage, trackUsage } = useFeatureUsageTracker('test-feature-4')

    trackUsage()
    const firstLastUsed = usage.value?.lastUsed ?? 0

    vi.advanceTimersByTime(10)
    trackUsage()

    expect(usage.value?.lastUsed).toBeGreaterThan(firstLastUsed)
  })

  it('reset clears feature data', () => {
    const { useCount, trackUsage, reset } =
      useFeatureUsageTracker('test-feature-5')

    trackUsage()
    trackUsage()
    expect(useCount.value).toBe(2)

    reset()
    expect(useCount.value).toBe(0)
  })

  it('tracks multiple features independently', () => {
    const featureA = useFeatureUsageTracker('feature-a')
    const featureB = useFeatureUsageTracker('feature-b')

    featureA.trackUsage()
    featureA.trackUsage()
    featureB.trackUsage()

    expect(featureA.useCount.value).toBe(2)
    expect(featureB.useCount.value).toBe(1)
  })

  it('persists to localStorage', async () => {
    const { trackUsage } = useFeatureUsageTracker('persisted-feature')

    trackUsage()
    await vi.runAllTimersAsync()

    const stored = JSON.parse(localStorage.getItem(STORAGE_KEY) ?? '{}')
    expect(stored['persisted-feature']?.useCount).toBe(1)
  })

  it('loads existing data from localStorage', () => {
    localStorage.setItem(
      STORAGE_KEY,
      JSON.stringify({
        'existing-feature': { useCount: 5, firstUsed: 1000, lastUsed: 2000 }
      })
    )

    const { useCount } = useFeatureUsageTracker('existing-feature')

    expect(useCount.value).toBe(5)
  })
})
