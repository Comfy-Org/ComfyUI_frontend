import { beforeEach, describe, expect, it, vi } from 'vitest'
import { effectScope } from 'vue'

import { reportError } from '@/platform/telemetry/reportError'

import {
  resetFeatureUsageTrackerStateForTest,
  useFeatureUsageTracker
} from './useFeatureUsageTracker'

vi.mock(import('@/platform/telemetry/reportError'))

const STORAGE_KEY = 'Comfy.FeatureUsage'

describe('useFeatureUsageTracker', () => {
  beforeEach(() => {
    resetFeatureUsageTrackerStateForTest()
  })

  it('initializes with zero count for new feature', () => {
    const { useCount } = useFeatureUsageTracker('test-feature-1')

    expect(useCount.value).toBe(0)
  })

  it('reports repeated persistence failures once', () => {
    const { trackUsage } = useFeatureUsageTracker('reported-storage-error')
    vi.spyOn(console, 'error').mockImplementation(() => {})
    vi.spyOn(localStorage, 'setItem').mockImplementation(() => {
      throw new DOMException('Storage quota exceeded', 'QuotaExceededError')
    })

    trackUsage()
    trackUsage()

    expect(reportError).toHaveBeenCalledOnce()
    expect(reportError).toHaveBeenCalledWith(expect.any(DOMException), {
      errorType: 'error_persisting_feature_usage',
      surface: 'platform'
    })
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

  it('preserves post-reset usage while storage remains unavailable', () => {
    const tracker = useFeatureUsageTracker('failed-reset-usage')
    tracker.trackUsage()
    tracker.trackUsage()
    vi.spyOn(console, 'error').mockImplementation(() => {})
    const setItem = vi.spyOn(localStorage, 'setItem').mockImplementation(() => {
      throw new DOMException('Storage quota exceeded', 'QuotaExceededError')
    })
    tracker.reset()
    tracker.trackUsage()
    tracker.trackUsage()
    expect(tracker.useCount.value).toBe(2)
    setItem.mockRestore()

    tracker.trackUsage()

    const stored = JSON.parse(localStorage.getItem(STORAGE_KEY) ?? '{}')
    expect(stored['failed-reset-usage']?.useCount).toBe(3)
  })

  it('does not interrupt reset when storage access is blocked', () => {
    const tracker = useFeatureUsageTracker('blocked-reset')
    vi.spyOn(console, 'error').mockImplementation(() => {})
    vi.spyOn(window, 'localStorage', 'get').mockImplementation(() => {
      throw new DOMException('Storage access denied', 'SecurityError')
    })

    expect(tracker.reset).not.toThrow()
    expect(tracker.useCount.value).toBe(0)
  })

  it('preserves pending usage when reset cannot read storage', () => {
    const pendingFeature = useFeatureUsageTracker('pending-before-reset')
    vi.spyOn(console, 'error').mockImplementation(() => {})
    const setItem = vi.spyOn(localStorage, 'setItem').mockImplementation(() => {
      throw new DOMException('Storage quota exceeded', 'QuotaExceededError')
    })
    pendingFeature.trackUsage()
    setItem.mockRestore()
    const getItem = vi.spyOn(localStorage, 'getItem').mockImplementation(() => {
      throw new DOMException('Storage access denied', 'SecurityError')
    })
    useFeatureUsageTracker('blocked-reset-reader').reset()
    getItem.mockRestore()

    useFeatureUsageTracker('reset-recovery-writer').trackUsage()

    const stored = JSON.parse(localStorage.getItem(STORAGE_KEY) ?? '{}')
    expect(stored['pending-before-reset']?.useCount).toBe(1)
    expect(stored['reset-recovery-writer']?.useCount).toBe(1)
  })

  it('preserves stored features when reset persistence fails', () => {
    const tracker = useFeatureUsageTracker('failed-reset-merge')
    localStorage.setItem(
      STORAGE_KEY,
      JSON.stringify({
        'stored-during-reset': {
          useCount: 7,
          firstUsed: 1_000,
          lastUsed: 2_000
        }
      })
    )
    vi.spyOn(console, 'error').mockImplementation(() => {})
    vi.spyOn(localStorage, 'setItem').mockImplementation(() => {
      throw new DOMException('Storage quota exceeded', 'QuotaExceededError')
    })

    tracker.reset()

    const stored = JSON.parse(localStorage.getItem(STORAGE_KEY) ?? '{}')
    expect(stored['stored-during-reset']?.useCount).toBe(7)
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
    expect(trackUsage).not.toThrow()
    expect(useCount.value).toBe(2)
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

  it('preserves increments when reading storage is blocked', () => {
    const tracker = useFeatureUsageTracker('blocked-storage-read')
    vi.spyOn(console, 'error').mockImplementation(() => {})
    const getItem = vi.spyOn(localStorage, 'getItem').mockImplementation(() => {
      throw new DOMException('Storage access denied', 'SecurityError')
    })
    const setItem = vi.spyOn(localStorage, 'setItem').mockImplementation(() => {
      throw new DOMException('Storage access denied', 'SecurityError')
    })
    tracker.trackUsage()
    tracker.trackUsage()
    getItem.mockRestore()
    setItem.mockRestore()

    tracker.trackUsage()

    const stored = JSON.parse(localStorage.getItem(STORAGE_KEY) ?? '{}')
    expect(stored['blocked-storage-read']?.useCount).toBe(3)
    expect(tracker.useCount.value).toBe(3)
  })

  it('shares pending usage when storage access blocks event dispatch', () => {
    const tracking = useFeatureUsageTracker('reactive-pending-usage')
    const observing = useFeatureUsageTracker('reactive-pending-usage')
    expect(tracking.useCount.value).toBe(0)
    expect(observing.useCount.value).toBe(0)
    vi.spyOn(console, 'error').mockImplementation(() => {})
    vi.spyOn(window, 'localStorage', 'get').mockImplementation(() => {
      throw new DOMException('Storage access denied', 'SecurityError')
    })

    tracking.trackUsage()

    expect(tracking.useCount.value).toBe(1)
    expect(observing.useCount.value).toBe(1)
  })

  it('does not broadcast a fabricated snapshot after a failed read', () => {
    const staleTracker = useFeatureUsageTracker('failed-read-tracker')
    const currentTracker = useFeatureUsageTracker('current-read-tracker')
    currentTracker.trackUsage()
    vi.spyOn(console, 'error').mockImplementation(() => {})
    const getItem = vi.spyOn(localStorage, 'getItem').mockImplementation(() => {
      throw new DOMException('Storage access denied', 'SecurityError')
    })

    staleTracker.trackUsage()
    getItem.mockRestore()

    expect(currentTracker.useCount.value).toBe(1)
    expect(staleTracker.useCount.value).toBe(1)
    const stored = JSON.parse(localStorage.getItem(STORAGE_KEY) ?? '{}')
    expect(stored).toHaveProperty('current-read-tracker')
    expect(stored).not.toHaveProperty('failed-read-tracker')
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

  it('adds pending increments to ordered external usage', () => {
    localStorage.setItem(
      STORAGE_KEY,
      JSON.stringify({
        'ordered-usage': {
          useCount: 5,
          firstUsed: 1_000,
          lastUsed: 2_000
        }
      })
    )
    const tracker = useFeatureUsageTracker('ordered-usage')
    vi.spyOn(console, 'error').mockImplementation(() => {})
    const setItem = vi.spyOn(localStorage, 'setItem').mockImplementation(() => {
      throw new DOMException('Storage quota exceeded', 'QuotaExceededError')
    })
    tracker.trackUsage()
    setItem.mockRestore()
    localStorage.setItem(
      STORAGE_KEY,
      JSON.stringify({
        'ordered-usage': {
          useCount: 6,
          firstUsed: 1_000,
          lastUsed: 3_000
        }
      })
    )

    tracker.trackUsage()

    const stored = JSON.parse(localStorage.getItem(STORAGE_KEY) ?? '{}')
    expect(stored['ordered-usage']?.useCount).toBe(8)
  })

  it('exposes pending usage and resets to newly mounted trackers', () => {
    const trackedFeature = useFeatureUsageTracker('shared-pending-state')
    trackedFeature.trackUsage()
    vi.spyOn(console, 'error').mockImplementation(() => {})
    const setItem = vi.spyOn(localStorage, 'setItem').mockImplementation(() => {
      throw new DOMException('Storage quota exceeded', 'QuotaExceededError')
    })
    trackedFeature.trackUsage()

    expect(useFeatureUsageTracker('shared-pending-state').useCount.value).toBe(
      2
    )

    trackedFeature.reset()

    expect(useFeatureUsageTracker('shared-pending-state').useCount.value).toBe(
      0
    )
    setItem.mockRestore()
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
    vi.setSystemTime(1_500)
    vi.spyOn(console, 'error').mockImplementation(() => {})
    const setItem = vi.spyOn(localStorage, 'setItem').mockImplementation(() => {
      throw new DOMException('Storage quota exceeded', 'QuotaExceededError')
    })
    tracker.trackUsage()
    setItem.mockRestore()
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
      useCount: 7,
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

  it('does not resurrect another feature reset after tracker disposal', () => {
    const scope = effectScope()
    let trackDisposedFeature = () => {}

    scope.run(() => {
      useFeatureUsageTracker('reset-other-feature').trackUsage()
      const tracker = useFeatureUsageTracker('disposed-other-feature')
      tracker.trackUsage()
      trackDisposedFeature = tracker.trackUsage
    })
    scope.stop()

    useFeatureUsageTracker('reset-other-feature').reset()
    trackDisposedFeature()

    const stored = JSON.parse(localStorage.getItem(STORAGE_KEY) ?? '{}')
    expect(stored).not.toHaveProperty('reset-other-feature')
    expect(stored['disposed-other-feature']?.useCount).toBe(2)
  })

  it('does not resurrect another feature while resetting a stale tracker', () => {
    const scope = effectScope()
    let resetDisposedFeature = () => {}

    scope.run(() => {
      useFeatureUsageTracker('reset-before-stale-reset').trackUsage()
      const tracker = useFeatureUsageTracker('disposed-reset-feature')
      tracker.trackUsage()
      resetDisposedFeature = tracker.reset
    })
    scope.stop()

    useFeatureUsageTracker('reset-before-stale-reset').reset()
    resetDisposedFeature()

    const stored = JSON.parse(localStorage.getItem(STORAGE_KEY) ?? '{}')
    expect(stored).not.toHaveProperty('reset-before-stale-reset')
    expect(stored).not.toHaveProperty('disposed-reset-feature')
  })

  it('does not resurrect usage removed by another storage context', () => {
    const scope = effectScope()
    let trackDisposedFeature = () => {}

    scope.run(() => {
      useFeatureUsageTracker('externally-reset-feature').trackUsage()
      const tracker = useFeatureUsageTracker('external-reset-trigger')
      tracker.trackUsage()
      trackDisposedFeature = tracker.trackUsage
    })
    scope.stop()

    const stored = JSON.parse(localStorage.getItem(STORAGE_KEY) ?? '{}')
    delete stored['externally-reset-feature']
    localStorage.setItem(STORAGE_KEY, JSON.stringify(stored))
    trackDisposedFeature()

    const updated = JSON.parse(localStorage.getItem(STORAGE_KEY) ?? '{}')
    expect(updated).not.toHaveProperty('externally-reset-feature')
    expect(updated['external-reset-trigger']?.useCount).toBe(2)
  })

  it('does not make unrelated usage pending after a failed write', () => {
    const externalFeature = useFeatureUsageTracker('external-pending-reset')
    const triggerFeature = useFeatureUsageTracker('pending-trigger')
    externalFeature.trackUsage()
    triggerFeature.trackUsage()
    vi.spyOn(console, 'error').mockImplementation(() => {})
    const setItem = vi.spyOn(localStorage, 'setItem').mockImplementation(() => {
      throw new DOMException('Storage quota exceeded', 'QuotaExceededError')
    })
    triggerFeature.trackUsage()
    setItem.mockRestore()

    const stored = JSON.parse(localStorage.getItem(STORAGE_KEY) ?? '{}')
    delete stored['external-pending-reset']
    localStorage.setItem(STORAGE_KEY, JSON.stringify(stored))
    triggerFeature.trackUsage()

    const updated = JSON.parse(localStorage.getItem(STORAGE_KEY) ?? '{}')
    expect(updated).not.toHaveProperty('external-pending-reset')
    expect(updated['pending-trigger']?.useCount).toBe(3)
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

    const tracker = useFeatureUsageTracker('repaired-feature')
    expect(tracker.useCount.value).toBe(0)
    tracker.trackUsage()

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

  it('tracks feature IDs that match object prototype properties', () => {
    const tracker = useFeatureUsageTracker('toString')
    localStorage.setItem(
      STORAGE_KEY,
      JSON.stringify({
        toString: { useCount: 5, firstUsed: 1_000, lastUsed: 2_000 }
      })
    )

    tracker.trackUsage()

    const stored = JSON.parse(localStorage.getItem(STORAGE_KEY) ?? '{}')
    expect(stored.toString).toEqual({
      useCount: 6,
      firstUsed: 1_000,
      lastUsed: Date.now()
    })
  })

  it.for([
    { useCount: null, firstUsed: 1_000, lastUsed: 2_000 },
    { useCount: '', firstUsed: 1_000, lastUsed: 2_000 },
    { useCount: -1, firstUsed: 1_000, lastUsed: 2_000 },
    { useCount: 1.5, firstUsed: 1_000, lastUsed: 2_000 },
    {
      useCount: Number.MAX_SAFE_INTEGER,
      firstUsed: 1_000,
      lastUsed: 2_000
    },
    {
      useCount: Number.MAX_SAFE_INTEGER + 1,
      firstUsed: 1_000,
      lastUsed: 2_000
    },
    { useCount: 1, firstUsed: null, lastUsed: 2_000 },
    { useCount: 1, firstUsed: 1.5, lastUsed: 2_000 },
    { useCount: 1, firstUsed: -1, lastUsed: 2_000 },
    { useCount: 1, firstUsed: 0, lastUsed: 2_000 },
    { useCount: 1, firstUsed: 1_000, lastUsed: '' },
    { useCount: 1, firstUsed: 1_000, lastUsed: Number.MAX_SAFE_INTEGER + 1 }
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

  it('keeps the usage count within the supported range', () => {
    localStorage.setItem(
      STORAGE_KEY,
      JSON.stringify({
        'maximum-usage': {
          useCount: Number.MAX_SAFE_INTEGER - 1,
          firstUsed: 1_000,
          lastUsed: 2_000
        }
      })
    )

    useFeatureUsageTracker('maximum-usage').trackUsage()

    const stored = JSON.parse(localStorage.getItem(STORAGE_KEY) ?? '{}')
    expect(stored['maximum-usage']?.useCount).toBe(Number.MAX_SAFE_INTEGER - 1)
  })

  it('tolerates future timestamps without discarding usage', () => {
    vi.setSystemTime(1_700_000_000_000)
    localStorage.setItem(
      STORAGE_KEY,
      JSON.stringify({
        'future-timestamp': {
          useCount: 5,
          firstUsed: Number.MAX_SAFE_INTEGER,
          lastUsed: Number.MAX_SAFE_INTEGER
        }
      })
    )

    useFeatureUsageTracker('future-timestamp').trackUsage()

    const stored = JSON.parse(localStorage.getItem(STORAGE_KEY) ?? '{}')
    expect(stored['future-timestamp']).toEqual({
      useCount: 6,
      firstUsed: Number.MAX_SAFE_INTEGER,
      lastUsed: 1_700_000_000_000
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
