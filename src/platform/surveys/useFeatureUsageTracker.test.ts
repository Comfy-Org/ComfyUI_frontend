import { describe, expect, it, vi } from 'vitest'
import { effectScope } from 'vue'

import { reportError } from '@/platform/telemetry/reportError'

import { useFeatureUsageTracker } from './useFeatureUsageTracker'

vi.mock(import('@/platform/telemetry/reportError'))

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
    expect(
      JSON.parse(localStorage.getItem(STORAGE_KEY) ?? '{}')
    ).not.toHaveProperty('test-feature-5')
  })

  it('persists reset immediately after tracking', () => {
    const { trackUsage, reset } = useFeatureUsageTracker('immediate-reset')

    trackUsage()
    reset()

    expect(
      JSON.parse(localStorage.getItem(STORAGE_KEY) ?? '{}')
    ).not.toHaveProperty('immediate-reset')
  })

  it('preserves a reset when storage recovers', () => {
    const tracker = useFeatureUsageTracker('failed-reset')
    tracker.trackUsage()
    tracker.trackUsage()
    vi.spyOn(console, 'error').mockImplementation(() => {})
    const setItem = vi.spyOn(localStorage, 'setItem').mockImplementation(() => {
      throw new DOMException('Storage quota exceeded', 'QuotaExceededError')
    })
    tracker.reset()
    setItem.mockRestore()

    tracker.trackUsage()

    const stored = JSON.parse(localStorage.getItem(STORAGE_KEY) ?? '{}')
    expect(stored['failed-reset']?.useCount).toBe(1)
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
    vi.spyOn(console, 'error').mockImplementation(() => {})
    vi.spyOn(localStorage, 'setItem').mockImplementation(() => {
      throw new DOMException('Storage quota exceeded', 'QuotaExceededError')
    })

    expect(trackUsage).not.toThrow()
    expect(useCount.value).toBe(1)
    expect(reportError).toHaveBeenCalledWith(expect.any(DOMException), {
      errorType: 'error_persisting_feature_usage',
      surface: 'platform'
    })
  })

  it('preserves in-memory increments when storage recovers', () => {
    const { trackUsage, useCount } =
      useFeatureUsageTracker('recovering-storage')

    trackUsage()
    vi.spyOn(console, 'error').mockImplementation(() => {})
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

  it('preserves other in-memory features when storage recovers', () => {
    const recoveringFeature = useFeatureUsageTracker('recovering-feature')
    const triggerFeature = useFeatureUsageTracker('trigger-feature')

    recoveringFeature.trackUsage()
    vi.spyOn(console, 'error').mockImplementation(() => {})
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

  it('does not replace newer stored usage with stale in-memory usage', () => {
    const scope = effectScope()
    let trackStaleFeature = () => {}

    scope.run(() => {
      useFeatureUsageTracker('trigger-feature').trackUsage()
      const staleFeature = useFeatureUsageTracker('stale-feature')
      staleFeature.trackUsage()
      trackStaleFeature = staleFeature.trackUsage
    })
    scope.stop()

    useFeatureUsageTracker('trigger-feature').trackUsage()
    trackStaleFeature()

    const stored = JSON.parse(localStorage.getItem(STORAGE_KEY) ?? '{}')
    expect(stored['stale-feature']?.useCount).toBe(2)
    expect(stored['trigger-feature']?.useCount).toBe(2)
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

  it('preserves the earliest first use when reconciling usage', () => {
    vi.setSystemTime(1_000)
    const tracker = useFeatureUsageTracker('reconciled-feature')
    tracker.trackUsage()
    localStorage.setItem(
      STORAGE_KEY,
      JSON.stringify({
        'reconciled-feature': {
          useCount: 5,
          firstUsed: 2_000,
          lastUsed: 3_000
        }
      })
    )
    vi.setSystemTime(4_000)

    tracker.trackUsage()

    const stored = JSON.parse(localStorage.getItem(STORAGE_KEY) ?? '{}')
    expect(stored['reconciled-feature']).toEqual({
      useCount: 6,
      firstUsed: 1_000,
      lastUsed: 4_000
    })
  })

  it('restarts from one when a disposed tracker runs after reset', () => {
    const scope = effectScope()
    let trackDisposedFeature = () => {}

    scope.run(() => {
      const tracker = useFeatureUsageTracker('reset-feature')
      tracker.trackUsage()
      tracker.trackUsage()
      trackDisposedFeature = tracker.trackUsage
    })
    scope.stop()

    useFeatureUsageTracker('reset-feature').reset()
    trackDisposedFeature()

    const stored = JSON.parse(localStorage.getItem(STORAGE_KEY) ?? '{}')
    expect(stored['reset-feature']?.useCount).toBe(1)
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

  it.for([
    { storedValue: null },
    { storedValue: 'invalid' },
    { storedValue: [1, 2] }
  ])('replaces non-record storage data $storedValue', ({ storedValue }) => {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(storedValue))

    useFeatureUsageTracker('repaired-feature').trackUsage()

    const stored = JSON.parse(localStorage.getItem(STORAGE_KEY) ?? '{}')
    expect(stored).toEqual({
      'repaired-feature': {
        useCount: 1,
        firstUsed: Date.now(),
        lastUsed: Date.now()
      }
    })
  })

  it('normalizes numeric storage fields before incrementing', () => {
    localStorage.setItem(
      STORAGE_KEY,
      JSON.stringify({
        'numeric-strings': {
          useCount: '5',
          firstUsed: '1000',
          lastUsed: '2000'
        }
      })
    )

    useFeatureUsageTracker('numeric-strings').trackUsage()

    const stored = JSON.parse(localStorage.getItem(STORAGE_KEY) ?? '{}')
    expect(stored['numeric-strings']).toEqual({
      useCount: 6,
      firstUsed: 1000,
      lastUsed: Date.now()
    })
  })

  it.for([
    { useCount: null, firstUsed: 1_000, lastUsed: 2_000 },
    { useCount: '', firstUsed: 1_000, lastUsed: 2_000 },
    { useCount: -1, firstUsed: 1_000, lastUsed: 2_000 },
    { useCount: 1.5, firstUsed: 1_000, lastUsed: 2_000 },
    { useCount: 1, firstUsed: null, lastUsed: 2_000 },
    { useCount: 1, firstUsed: 1_000, lastUsed: '' }
  ])('rejects invalid stored usage $useCount', (storedUsage) => {
    localStorage.setItem(
      STORAGE_KEY,
      JSON.stringify({ 'invalid-usage': storedUsage })
    )

    useFeatureUsageTracker('invalid-usage').trackUsage()

    const stored = JSON.parse(localStorage.getItem(STORAGE_KEY) ?? '{}')
    expect(stored['invalid-usage']).toEqual({
      useCount: 1,
      firstUsed: Date.now(),
      lastUsed: Date.now()
    })
  })

  it('repairs malformed JSON storage data', () => {
    localStorage.setItem(STORAGE_KEY, '{')

    useFeatureUsageTracker('malformed-json').trackUsage()

    const stored = JSON.parse(localStorage.getItem(STORAGE_KEY) ?? '{}')
    expect(stored['malformed-json']?.useCount).toBe(1)
    expect(reportError).toHaveBeenCalledWith(expect.any(SyntaxError), {
      errorType: 'error_parsing_feature_usage',
      surface: 'platform'
    })
  })
})
