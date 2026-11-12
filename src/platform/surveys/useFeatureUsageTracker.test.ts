import { describe, expect, it, vi } from 'vitest'
import { effectScope, nextTick } from 'vue'

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

  it('persists before its owning scope is disposed', () => {
    const scope = effectScope()

    scope.run(() => {
      useFeatureUsageTracker('disposed-feature').trackUsage()
    })
    scope.stop()

    const stored = JSON.parse(localStorage.getItem(STORAGE_KEY) ?? '{}')
    expect(stored['disposed-feature']?.useCount).toBe(1)
  })

  it('persists when tracked after its owning scope is disposed', () => {
    const scope = effectScope()
    let trackUsage = () => {}

    scope.run(() => {
      trackUsage = useFeatureUsageTracker('late-feature').trackUsage
    })
    scope.stop()
    trackUsage()

    const stored = JSON.parse(localStorage.getItem(STORAGE_KEY) ?? '{}')
    expect(stored['late-feature']?.useCount).toBe(1)
  })

  it('does not interrupt callers when storage is unavailable', () => {
    const { trackUsage, useCount } = useFeatureUsageTracker(
      'unavailable-storage'
    )
    vi.spyOn(localStorage, 'setItem').mockImplementation(() => {
      throw new DOMException('Storage quota exceeded', 'QuotaExceededError')
    })

    expect(trackUsage).not.toThrow()
    expect(useCount.value).toBe(1)
  })

  it('preserves in-memory increments when storage recovers', () => {
    const { trackUsage, useCount } =
      useFeatureUsageTracker('recovering-storage')

    trackUsage()
    const setItem = vi.spyOn(localStorage, 'setItem').mockImplementation(() => {
      throw new DOMException('Storage quota exceeded', 'QuotaExceededError')
    })
    trackUsage()
    setItem.mockRestore()
    trackUsage()

    const stored = JSON.parse(localStorage.getItem(STORAGE_KEY) ?? '{}')
    expect(stored['recovering-storage']?.useCount).toBe(3)
    expect(useCount.value).toBe(3)
  })

  it('preserves failed increments from separate trackers', () => {
    const firstTracker = useFeatureUsageTracker('shared-recovery-feature')
    const secondTracker = useFeatureUsageTracker('shared-recovery-feature')
    const setItem = vi.spyOn(localStorage, 'setItem').mockImplementation(() => {
      throw new DOMException('Storage quota exceeded', 'QuotaExceededError')
    })

    firstTracker.trackUsage()
    secondTracker.trackUsage()
    setItem.mockRestore()
    firstTracker.trackUsage()

    const stored = JSON.parse(localStorage.getItem(STORAGE_KEY) ?? '{}')
    expect(stored['shared-recovery-feature']?.useCount).toBe(3)
  })

  it('does not double count a fallback persisted by the storage watcher', async () => {
    const tracker = useFeatureUsageTracker('watcher-recovery-feature')
    vi.spyOn(localStorage, 'setItem').mockImplementationOnce(() => {
      throw new DOMException('Storage quota exceeded', 'QuotaExceededError')
    })

    tracker.trackUsage()
    await nextTick()
    tracker.trackUsage()

    const stored = JSON.parse(localStorage.getItem(STORAGE_KEY) ?? '{}')
    expect(stored['watcher-recovery-feature']?.useCount).toBe(2)
  })

  it('does not double count after recovering from invalid stored data', async () => {
    localStorage.setItem(STORAGE_KEY, '{')
    const tracker = useFeatureUsageTracker('invalid-data-recovery-feature')

    tracker.trackUsage()
    await nextTick()
    tracker.trackUsage()

    const stored = JSON.parse(localStorage.getItem(STORAGE_KEY) ?? '{}')
    expect(stored['invalid-data-recovery-feature']?.useCount).toBe(2)
  })

  it('preserves other in-memory features when storage recovers', () => {
    const recoveringFeature = useFeatureUsageTracker('recovering-feature')
    const triggerFeature = useFeatureUsageTracker('trigger-feature')

    recoveringFeature.trackUsage()
    const setItem = vi.spyOn(localStorage, 'setItem').mockImplementation(() => {
      throw new DOMException('Storage quota exceeded', 'QuotaExceededError')
    })
    recoveringFeature.trackUsage()
    setItem.mockRestore()
    triggerFeature.trackUsage()

    const stored = JSON.parse(localStorage.getItem(STORAGE_KEY) ?? '{}')
    expect(stored['recovering-feature']?.useCount).toBe(2)
    expect(stored['trigger-feature']?.useCount).toBe(1)
    expect(recoveringFeature.useCount.value).toBe(2)
  })

  it('preserves intervening usage when tracked after scope disposal', () => {
    const scope = effectScope()
    let trackDisposedFeature = () => {}

    scope.run(() => {
      trackDisposedFeature =
        useFeatureUsageTracker('disposed-feature').trackUsage
    })
    scope.stop()

    const liveFeature = useFeatureUsageTracker('live-feature')
    liveFeature.trackUsage()
    trackDisposedFeature()

    const stored = JSON.parse(localStorage.getItem(STORAGE_KEY) ?? '{}')
    expect(stored['disposed-feature']?.useCount).toBe(1)
    expect(stored['live-feature']?.useCount).toBe(1)
    expect(liveFeature.useCount.value).toBe(1)
  })

  it('increments the latest count when the same feature changed after disposal', () => {
    const scope = effectScope()
    let trackDisposedFeature = () => {}

    scope.run(() => {
      trackDisposedFeature = useFeatureUsageTracker('shared-feature').trackUsage
    })
    scope.stop()

    const liveFeature = useFeatureUsageTracker('shared-feature')
    liveFeature.trackUsage()
    liveFeature.trackUsage()
    trackDisposedFeature()

    const stored = JSON.parse(localStorage.getItem(STORAGE_KEY) ?? '{}')
    expect(stored['shared-feature']?.useCount).toBe(3)
    expect(liveFeature.useCount.value).toBe(3)
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
