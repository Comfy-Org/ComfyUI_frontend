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

  it('persists repeated failed increments when storage recovers', () => {
    const tracker = useFeatureUsageTracker('repeated-failed-increments')
    const setItem = vi.spyOn(localStorage, 'setItem').mockImplementation(() => {
      throw new DOMException('Storage quota exceeded', 'QuotaExceededError')
    })
    tracker.trackUsage()
    tracker.trackUsage()
    tracker.trackUsage()
    setItem.mockRestore()

    tracker.trackUsage()

    expect(tracker.useCount.value).toBe(4)
  })

  it('preserves usage after bounding prolonged persistence failures', () => {
    const tracker = useFeatureUsageTracker('bounded-failed-increments')
    const setItem = vi.spyOn(localStorage, 'setItem').mockImplementation(() => {
      throw new DOMException('Storage quota exceeded', 'QuotaExceededError')
    })
    Array.from({ length: 101 }, () => tracker.trackUsage())
    setItem.mockRestore()

    tracker.trackUsage()

    expect(tracker.useCount.value).toBe(102)
  })

  it('discards compacted pending usage from a deleted generation', () => {
    const featureId = 'bounded-deleted-increments'
    const tracker = useFeatureUsageTracker(featureId)
    const setItem = vi.spyOn(localStorage, 'setItem').mockImplementation(() => {
      throw new DOMException('Storage quota exceeded', 'QuotaExceededError')
    })
    Array.from({ length: 101 }, (_, index) => {
      vi.setSystemTime(index + 1)
      tracker.trackUsage()
    })
    setItem.mockRestore()
    const deletedValue = JSON.stringify({
      [featureId]: { useCount: 51, firstUsed: 1, lastUsed: 51 }
    })
    localStorage.removeItem(STORAGE_KEY)
    window.dispatchEvent(
      new StorageEvent('storage', {
        key: STORAGE_KEY,
        oldValue: deletedValue,
        newValue: null,
        storageArea: localStorage
      })
    )
    vi.setSystemTime(102)

    tracker.trackUsage()

    expect(tracker.useCount.value).toBe(52)
  })

  it('keeps only usage recorded after a deleted generation', () => {
    vi.setSystemTime(1_000)
    const featureId = 'coalesced-after-deletion'
    const tracker = useFeatureUsageTracker(featureId)
    const setItem = vi.spyOn(localStorage, 'setItem').mockImplementation(() => {
      throw new DOMException('Storage quota exceeded', 'QuotaExceededError')
    })
    tracker.trackUsage()
    const deletedValue = JSON.stringify({
      [featureId]: { useCount: 1, firstUsed: 2_000, lastUsed: 3_000 }
    })
    localStorage.removeItem(STORAGE_KEY)
    vi.setSystemTime(4_000)
    tracker.trackUsage()
    setItem.mockRestore()

    window.dispatchEvent(
      new StorageEvent('storage', {
        key: STORAGE_KEY,
        oldValue: deletedValue,
        newValue: null,
        storageArea: localStorage
      })
    )
    useFeatureUsageTracker('coalesced-deletion-trigger').trackUsage()

    const stored = JSON.parse(localStorage.getItem(STORAGE_KEY) ?? '{}')
    expect(stored[featureId]?.useCount).toBe(1)
  })

  it('writes storage once for each successful use', () => {
    const setItem = vi.spyOn(localStorage, 'setItem')

    useFeatureUsageTracker('single-write').trackUsage()

    expect(setItem).toHaveBeenCalledOnce()
  })

  it('retains usage when another writer replaces an unverified write', () => {
    const featureId = 'replaced-before-verification'
    const originalSetItem = localStorage.setItem.bind(localStorage)
    const externalValue = JSON.stringify({
      external: { useCount: 1, firstUsed: 1_000, lastUsed: 1_000 }
    })
    const setItem = vi
      .spyOn(localStorage, 'setItem')
      .mockImplementation((key, value) => {
        originalSetItem(key, value)
        originalSetItem(key, externalValue)
      })
    const tracker = useFeatureUsageTracker(featureId)

    tracker.trackUsage()
    setItem.mockRestore()
    tracker.trackUsage()

    const stored = JSON.parse(localStorage.getItem(STORAGE_KEY) ?? '{}')
    expect(stored[featureId]?.useCount).toBe(2)
    expect(stored.external?.useCount).toBe(1)
  })

  it('rejects an older generation restored before verification', () => {
    vi.setSystemTime(2_000)
    const originalSetItem = localStorage.setItem.bind(localStorage)
    const staleGeneration = JSON.stringify({
      'restored-before-verification': {
        useCount: 5,
        firstUsed: 1_000,
        lastUsed: 3_000
      }
    })
    vi.spyOn(localStorage, 'setItem').mockImplementation((key, value) => {
      originalSetItem(key, value)
      originalSetItem(key, staleGeneration)
    })

    useFeatureUsageTracker('restored-before-verification').trackUsage()

    expect(reportError).toHaveBeenCalledWith(expect.any(DOMException), {
      errorType: 'error_verifying_feature_usage',
      surface: 'platform'
    })
  })

  it('accepts a concurrent write that preserves the tracked increment', () => {
    const featureId = 'preserved-before-verification'
    const originalSetItem = localStorage.setItem.bind(localStorage)
    const setItem = vi
      .spyOn(localStorage, 'setItem')
      .mockImplementation((key, value) => {
        const written = JSON.parse(value)
        originalSetItem(
          key,
          JSON.stringify({
            ...written,
            external: { useCount: 1, firstUsed: 1_000, lastUsed: 1_000 }
          })
        )
      })
    const tracker = useFeatureUsageTracker(featureId)
    tracker.trackUsage()
    setItem.mockRestore()

    tracker.trackUsage()

    const stored = JSON.parse(localStorage.getItem(STORAGE_KEY) ?? '{}')
    expect(stored[featureId]?.useCount).toBe(2)
    expect(stored.external?.useCount).toBe(1)
  })

  it('retains every pending feature dropped before verification', () => {
    const pendingTracker = useFeatureUsageTracker('pending-before-clobber')
    const setItem = vi.spyOn(localStorage, 'setItem').mockImplementation(() => {
      throw new DOMException('Storage quota exceeded', 'QuotaExceededError')
    })
    pendingTracker.trackUsage()
    setItem.mockRestore()
    const originalSetItem = localStorage.setItem.bind(localStorage)
    const clobber = vi
      .spyOn(localStorage, 'setItem')
      .mockImplementation((key, value) => {
        const written = JSON.parse(value)
        delete written['pending-before-clobber']
        originalSetItem(key, JSON.stringify(written))
      })

    useFeatureUsageTracker('clobber-trigger').trackUsage()
    clobber.mockRestore()
    useFeatureUsageTracker('unrelated-after-clobber').trackUsage()
    pendingTracker.trackUsage()

    const stored = JSON.parse(localStorage.getItem(STORAGE_KEY) ?? '{}')
    expect(stored['pending-before-clobber']?.useCount).toBe(2)
    expect(stored['clobber-trigger']?.useCount).toBe(1)
  })

  it('drains each pending feature confirmed before partial verification', () => {
    const retainedTracker = useFeatureUsageTracker('retained-pending-write')
    const droppedTracker = useFeatureUsageTracker('dropped-pending-write')
    const failedSetItem = vi
      .spyOn(localStorage, 'setItem')
      .mockImplementation(() => {
        throw new DOMException('Storage quota exceeded', 'QuotaExceededError')
      })
    retainedTracker.trackUsage()
    droppedTracker.trackUsage()
    failedSetItem.mockRestore()
    const originalSetItem = localStorage.setItem.bind(localStorage)
    const clobber = vi
      .spyOn(localStorage, 'setItem')
      .mockImplementation((key, value) => {
        const written = JSON.parse(value)
        delete written['dropped-pending-write']
        originalSetItem(key, JSON.stringify(written))
      })

    useFeatureUsageTracker('partial-verification-trigger').trackUsage()
    clobber.mockRestore()
    useFeatureUsageTracker('partial-verification-recovery').trackUsage()

    const stored = JSON.parse(localStorage.getItem(STORAGE_KEY) ?? '{}')
    expect(stored['retained-pending-write']?.useCount).toBe(1)
    expect(stored['dropped-pending-write']?.useCount).toBe(1)
  })

  it('assumes a successful write when verification cannot read storage', () => {
    const featureId = 'unreadable-verification'
    const tracker = useFeatureUsageTracker(featureId)
    const getItem = vi
      .spyOn(localStorage, 'getItem')
      .mockReturnValueOnce(null)
      .mockImplementation(() => {
        throw new DOMException('Storage access denied', 'SecurityError')
      })

    tracker.trackUsage()
    getItem.mockRestore()
    tracker.trackUsage()

    const stored = JSON.parse(localStorage.getItem(STORAGE_KEY) ?? '{}')
    expect(stored[featureId]?.useCount).toBe(2)
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

  it('keeps lastUsed monotonic across backward clock changes', () => {
    vi.setSystemTime(2_000)
    const tracker = useFeatureUsageTracker('monotonic-last-used')
    tracker.trackUsage()
    vi.setSystemTime(1_000)

    tracker.trackUsage()

    expect(tracker.usage.value?.lastUsed).toBe(2_000)
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

  it('retires a failed reset after external usage', () => {
    const tracker = useFeatureUsageTracker('external-usage-after-reset')
    tracker.trackUsage()
    vi.spyOn(console, 'error').mockImplementation(() => {})
    const setItem = vi.spyOn(localStorage, 'setItem').mockImplementation(() => {
      throw new DOMException('Storage quota exceeded', 'QuotaExceededError')
    })
    tracker.reset()
    setItem.mockRestore()
    const externalValue = JSON.stringify({
      'external-usage-after-reset': {
        useCount: 2,
        firstUsed: 1_000,
        lastUsed: 2_000
      }
    })
    localStorage.setItem(STORAGE_KEY, externalValue)
    window.dispatchEvent(
      new StorageEvent('storage', {
        key: STORAGE_KEY,
        newValue: externalValue,
        storageArea: localStorage
      })
    )

    useFeatureUsageTracker('external-reset-trigger').trackUsage()

    const stored = JSON.parse(localStorage.getItem(STORAGE_KEY) ?? '{}')
    expect(stored['external-usage-after-reset']?.useCount).toBe(2)
  })

  it('keeps a failed reset through unrelated external usage', () => {
    const tracker = useFeatureUsageTracker('reset-before-unrelated-usage')
    tracker.trackUsage()
    const oldValue = localStorage.getItem(STORAGE_KEY)
    vi.spyOn(console, 'error').mockImplementation(() => {})
    const setItem = vi.spyOn(localStorage, 'setItem').mockImplementation(() => {
      throw new DOMException('Storage quota exceeded', 'QuotaExceededError')
    })
    tracker.reset()
    setItem.mockRestore()
    const externalValue = JSON.stringify({
      ...JSON.parse(oldValue ?? '{}'),
      'unrelated-external-usage': {
        useCount: 1,
        firstUsed: 1_000,
        lastUsed: 2_000
      }
    })
    localStorage.setItem(STORAGE_KEY, externalValue)
    window.dispatchEvent(
      new StorageEvent('storage', {
        key: STORAGE_KEY,
        oldValue,
        newValue: externalValue,
        storageArea: localStorage
      })
    )

    useFeatureUsageTracker('unrelated-reset-trigger').trackUsage()

    const stored = JSON.parse(localStorage.getItem(STORAGE_KEY) ?? '{}')
    expect(stored).not.toHaveProperty('reset-before-unrelated-usage')
  })

  it('keeps a failed reset through a delayed pre-reset event', () => {
    const featureId = 'reset-before-delayed-event'
    localStorage.setItem(
      STORAGE_KEY,
      JSON.stringify({
        [featureId]: { useCount: 5, firstUsed: 1_000, lastUsed: 2_000 }
      })
    )
    const tracker = useFeatureUsageTracker(featureId)
    const oldValue = localStorage.getItem(STORAGE_KEY)
    const externalValue = JSON.stringify({
      [featureId]: { useCount: 6, firstUsed: 1_000, lastUsed: 3_000 }
    })
    localStorage.setItem(STORAGE_KEY, externalValue)
    vi.spyOn(console, 'error').mockImplementation(() => {})
    const setItem = vi.spyOn(localStorage, 'setItem').mockImplementation(() => {
      throw new DOMException('Storage quota exceeded', 'QuotaExceededError')
    })
    tracker.reset()
    setItem.mockRestore()
    window.dispatchEvent(
      new StorageEvent('storage', {
        key: STORAGE_KEY,
        oldValue,
        newValue: externalValue,
        storageArea: localStorage
      })
    )

    useFeatureUsageTracker('delayed-reset-trigger').trackUsage()

    const stored = JSON.parse(localStorage.getItem(STORAGE_KEY) ?? '{}')
    expect(stored).not.toHaveProperty(featureId)
  })

  it('keeps a reset with an unreadable baseline through unrelated writes', () => {
    const featureId = 'reset-with-unreadable-baseline'
    const tracker = useFeatureUsageTracker(featureId)
    tracker.trackUsage()
    vi.spyOn(console, 'error').mockImplementation(() => {})
    const getItem = vi.spyOn(localStorage, 'getItem').mockImplementation(() => {
      throw new DOMException('Storage access denied', 'SecurityError')
    })
    tracker.reset()
    getItem.mockRestore()

    useFeatureUsageTracker('unreadable-reset-trigger').trackUsage()

    const stored = JSON.parse(localStorage.getItem(STORAGE_KEY) ?? '{}')
    expect(stored).not.toHaveProperty(featureId)
  })

  it('retires an unreadable reset after later external usage', () => {
    vi.setSystemTime(1_000)
    const featureId = 'unreadable-reset-with-later-usage'
    const tracker = useFeatureUsageTracker(featureId)
    const getItem = vi.spyOn(localStorage, 'getItem').mockImplementation(() => {
      throw new DOMException('Storage access denied', 'SecurityError')
    })
    tracker.reset()
    getItem.mockRestore()
    vi.setSystemTime(400_000)
    localStorage.setItem(
      STORAGE_KEY,
      JSON.stringify({
        [featureId]: { useCount: 1, firstUsed: 302_000, lastUsed: 302_000 }
      })
    )

    useFeatureUsageTracker('unreadable-reset-later-trigger').trackUsage()

    const stored = JSON.parse(localStorage.getItem(STORAGE_KEY) ?? '{}')
    expect(stored[featureId]?.useCount).toBe(1)
  })

  it('keeps an unreadable reset through a plausible pre-reset clock skew', () => {
    vi.setSystemTime(10_000)
    const featureId = 'unreadable-reset-with-fast-clock'
    const tracker = useFeatureUsageTracker(featureId)
    const getItem = vi.spyOn(localStorage, 'getItem').mockImplementation(() => {
      throw new DOMException('Storage access denied', 'SecurityError')
    })
    tracker.reset()
    getItem.mockRestore()
    localStorage.setItem(
      STORAGE_KEY,
      JSON.stringify({
        [featureId]: { useCount: 1, firstUsed: 200_000, lastUsed: 200_000 }
      })
    )

    useFeatureUsageTracker('fast-clock-reset-trigger').trackUsage()

    const stored = JSON.parse(localStorage.getItem(STORAGE_KEY) ?? '{}')
    expect(stored).not.toHaveProperty(featureId)
  })

  it('preserves an earlier reset baseline when a repeated reset cannot read', () => {
    const featureId = 'repeated-reset-baseline'
    const tracker = useFeatureUsageTracker(featureId)
    tracker.trackUsage()
    vi.spyOn(console, 'error').mockImplementation(() => {})
    const setItem = vi.spyOn(localStorage, 'setItem').mockImplementation(() => {
      throw new DOMException('Storage quota exceeded', 'QuotaExceededError')
    })
    tracker.reset()
    const getItem = vi.spyOn(localStorage, 'getItem').mockImplementation(() => {
      throw new DOMException('Storage access denied', 'SecurityError')
    })
    tracker.reset()
    getItem.mockRestore()
    setItem.mockRestore()
    localStorage.setItem(
      STORAGE_KEY,
      JSON.stringify({
        [featureId]: { useCount: 2, firstUsed: 1_000, lastUsed: 2_000 }
      })
    )

    useFeatureUsageTracker('repeated-reset-trigger').trackUsage()

    const stored = JSON.parse(localStorage.getItem(STORAGE_KEY) ?? '{}')
    expect(stored[featureId]?.useCount).toBe(2)
  })

  it('refreshes the cutoff when a repeated reset cannot read storage', () => {
    vi.setSystemTime(1_000)
    const featureId = 'repeated-unreadable-reset-cutoff'
    const tracker = useFeatureUsageTracker(featureId)
    const getItem = vi.spyOn(localStorage, 'getItem').mockImplementation(() => {
      throw new DOMException('Storage access denied', 'SecurityError')
    })
    tracker.reset()
    getItem.mockRestore()
    localStorage.setItem(
      STORAGE_KEY,
      JSON.stringify({
        [featureId]: { useCount: 1, firstUsed: 400_000, lastUsed: 400_000 }
      })
    )
    vi.setSystemTime(500_000)
    const repeatedGetItem = vi
      .spyOn(localStorage, 'getItem')
      .mockImplementation(() => {
        throw new DOMException('Storage access denied', 'SecurityError')
      })
    tracker.reset()
    repeatedGetItem.mockRestore()
    vi.setSystemTime(600_000)

    useFeatureUsageTracker('repeated-reset-cutoff-trigger').trackUsage()

    const stored = JSON.parse(localStorage.getItem(STORAGE_KEY) ?? '{}')
    expect(stored).not.toHaveProperty(featureId)
  })

  it('does not lower a repeated reset cutoff after a backward clock step', () => {
    vi.setSystemTime(500_000)
    const featureId = 'backward-clock-reset-cutoff'
    const tracker = useFeatureUsageTracker(featureId)
    const getItem = vi.spyOn(localStorage, 'getItem').mockImplementation(() => {
      throw new DOMException('Storage access denied', 'SecurityError')
    })
    tracker.reset()
    vi.setSystemTime(100_000)
    tracker.reset()
    getItem.mockRestore()
    localStorage.setItem(
      STORAGE_KEY,
      JSON.stringify({
        [featureId]: { useCount: 1, firstUsed: 600_000, lastUsed: 600_000 }
      })
    )
    vi.setSystemTime(1_000_000)

    useFeatureUsageTracker('backward-reset-cutoff-trigger').trackUsage()

    const stored = JSON.parse(localStorage.getItem(STORAGE_KEY) ?? '{}')
    expect(stored).not.toHaveProperty(featureId)
  })

  it('reconciles external post-reset usage before its storage event', () => {
    const featureId = 'usage-before-reset-event'
    const tracker = useFeatureUsageTracker(featureId)
    tracker.trackUsage()
    const setItem = vi.spyOn(localStorage, 'setItem').mockImplementation(() => {
      throw new DOMException('Storage quota exceeded', 'QuotaExceededError')
    })
    tracker.reset()
    setItem.mockRestore()
    localStorage.setItem(
      STORAGE_KEY,
      JSON.stringify({
        [featureId]: { useCount: 2, firstUsed: 1_000, lastUsed: 2_000 }
      })
    )

    useFeatureUsageTracker('pre-event-trigger').trackUsage()

    const stored = JSON.parse(localStorage.getItem(STORAGE_KEY) ?? '{}')
    expect(stored[featureId]?.useCount).toBe(2)
  })

  it('ignores a delayed deletion when current storage has been recreated', () => {
    const featureId = 'reset-after-recreation'
    localStorage.setItem(
      STORAGE_KEY,
      JSON.stringify({
        [featureId]: { useCount: 1, firstUsed: 1_000, lastUsed: 2_000 }
      })
    )
    const tracker = useFeatureUsageTracker(featureId)
    const deletedValue = localStorage.getItem(STORAGE_KEY)
    localStorage.setItem(
      STORAGE_KEY,
      JSON.stringify({
        [featureId]: { useCount: 2, firstUsed: 1_000, lastUsed: 3_000 }
      })
    )
    const setItem = vi.spyOn(localStorage, 'setItem').mockImplementation(() => {
      throw new DOMException('Storage quota exceeded', 'QuotaExceededError')
    })
    tracker.reset()
    setItem.mockRestore()
    window.dispatchEvent(
      new StorageEvent('storage', {
        key: STORAGE_KEY,
        oldValue: deletedValue,
        newValue: '{}',
        storageArea: localStorage
      })
    )

    useFeatureUsageTracker('recreated-reset-trigger').trackUsage()

    const stored = JSON.parse(localStorage.getItem(STORAGE_KEY) ?? '{}')
    expect(stored).not.toHaveProperty(featureId)
  })

  it('keeps absent-baseline pending usage through storage clear', () => {
    const tracker = useFeatureUsageTracker('cleared-pending-usage')
    vi.spyOn(console, 'error').mockImplementation(() => {})
    const setItem = vi.spyOn(localStorage, 'setItem').mockImplementation(() => {
      throw new DOMException('Storage quota exceeded', 'QuotaExceededError')
    })
    tracker.trackUsage()
    setItem.mockRestore()
    localStorage.clear()
    window.dispatchEvent(
      new StorageEvent('storage', {
        key: null,
        storageArea: localStorage
      })
    )

    useFeatureUsageTracker('clear-trigger').trackUsage()

    const stored = JSON.parse(localStorage.getItem(STORAGE_KEY) ?? '{}')
    expect(stored['cleared-pending-usage']?.useCount).toBe(1)
  })

  it('keeps usage recorded after a storage clear event was queued', () => {
    const featureId = 'usage-after-storage-clear'
    useFeatureUsageTracker(featureId).trackUsage()
    localStorage.clear()
    vi.spyOn(console, 'error').mockImplementation(() => {})
    const tracker = useFeatureUsageTracker(featureId)
    const setItem = vi.spyOn(localStorage, 'setItem').mockImplementation(() => {
      throw new DOMException('Storage quota exceeded', 'QuotaExceededError')
    })
    tracker.trackUsage()
    setItem.mockRestore()
    window.dispatchEvent(
      new StorageEvent('storage', {
        key: null,
        storageArea: localStorage
      })
    )

    useFeatureUsageTracker('storage-clear-trigger').trackUsage()

    const stored = JSON.parse(localStorage.getItem(STORAGE_KEY) ?? '{}')
    expect(stored[featureId]?.useCount).toBe(1)
  })

  it('keeps a failed reset through a delayed clear after recreation', () => {
    const featureId = 'reset-after-delayed-clear'
    localStorage.setItem(
      STORAGE_KEY,
      JSON.stringify({
        [featureId]: { useCount: 1, firstUsed: 1_000, lastUsed: 1_000 }
      })
    )
    const tracker = useFeatureUsageTracker(featureId)
    localStorage.clear()
    localStorage.setItem(
      STORAGE_KEY,
      JSON.stringify({
        [featureId]: { useCount: 2, firstUsed: 2_000, lastUsed: 2_000 }
      })
    )
    const setItem = vi.spyOn(localStorage, 'setItem').mockImplementation(() => {
      throw new DOMException('Storage quota exceeded', 'QuotaExceededError')
    })
    tracker.reset()
    setItem.mockRestore()

    window.dispatchEvent(
      new StorageEvent('storage', {
        key: null,
        storageArea: localStorage
      })
    )
    useFeatureUsageTracker('delayed-clear-trigger').trackUsage()

    const stored = JSON.parse(localStorage.getItem(STORAGE_KEY) ?? '{}')
    expect(stored).not.toHaveProperty(featureId)
  })

  it('drops pending usage recorded before an external storage clear', () => {
    const featureId = 'pending-before-storage-clear'
    const tracker = useFeatureUsageTracker(featureId)
    tracker.trackUsage()
    const setItem = vi.spyOn(localStorage, 'setItem').mockImplementation(() => {
      throw new DOMException('Storage quota exceeded', 'QuotaExceededError')
    })
    tracker.trackUsage()
    setItem.mockRestore()
    localStorage.clear()

    window.dispatchEvent(
      new StorageEvent('storage', {
        key: null,
        storageArea: localStorage
      })
    )
    useFeatureUsageTracker('pre-clear-trigger').trackUsage()

    const stored = JSON.parse(localStorage.getItem(STORAGE_KEY) ?? '{}')
    expect(stored).not.toHaveProperty(featureId)
  })

  it('keeps pending state after an unrelated key is removed', () => {
    const tracker = useFeatureUsageTracker('pending-unrelated-removal')
    vi.spyOn(console, 'error').mockImplementation(() => {})
    const setItem = vi.spyOn(localStorage, 'setItem').mockImplementation(() => {
      throw new DOMException('Storage quota exceeded', 'QuotaExceededError')
    })
    tracker.trackUsage()
    setItem.mockRestore()
    window.dispatchEvent(
      new StorageEvent('storage', {
        key: 'unrelated-key',
        newValue: null,
        storageArea: localStorage
      })
    )

    useFeatureUsageTracker('unrelated-removal-trigger').trackUsage()

    const stored = JSON.parse(localStorage.getItem(STORAGE_KEY) ?? '{}')
    expect(stored['pending-unrelated-removal']?.useCount).toBe(1)
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

  it('does not duplicate usage after a pending reset write recovers', () => {
    const tracker = useFeatureUsageTracker('recovered-reset-usage')
    tracker.trackUsage()
    const setItem = vi.spyOn(localStorage, 'setItem').mockImplementation(() => {
      throw new DOMException('Storage quota exceeded', 'QuotaExceededError')
    })
    tracker.reset()
    setItem.mockRestore()

    tracker.trackUsage()
    tracker.trackUsage()

    const stored = JSON.parse(localStorage.getItem(STORAGE_KEY) ?? '{}')
    expect(stored['recovered-reset-usage']?.useCount).toBe(2)
  })

  it('keeps post-reset usage through deletion of the pre-reset record', () => {
    vi.setSystemTime(1_000)
    const featureId = 'post-reset-usage-after-deletion'
    const tracker = useFeatureUsageTracker(featureId)
    tracker.trackUsage()
    const oldValue = localStorage.getItem(STORAGE_KEY)
    const setItem = vi.spyOn(localStorage, 'setItem').mockImplementation(() => {
      throw new DOMException('Storage quota exceeded', 'QuotaExceededError')
    })
    tracker.reset()
    vi.setSystemTime(2_000)
    tracker.trackUsage()
    setItem.mockRestore()
    localStorage.setItem(STORAGE_KEY, '{}')
    window.dispatchEvent(
      new StorageEvent('storage', {
        key: STORAGE_KEY,
        oldValue,
        newValue: '{}',
        storageArea: localStorage
      })
    )

    useFeatureUsageTracker('post-reset-deletion-trigger').trackUsage()

    const stored = JSON.parse(localStorage.getItem(STORAGE_KEY) ?? '{}')
    expect(stored[featureId]?.useCount).toBe(1)
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

  it('retains pending usage dropped before reset verification', () => {
    const pendingTracker = useFeatureUsageTracker(
      'pending-before-reset-clobber'
    )
    const failedSetItem = vi
      .spyOn(localStorage, 'setItem')
      .mockImplementation(() => {
        throw new DOMException('Storage quota exceeded', 'QuotaExceededError')
      })
    pendingTracker.trackUsage()
    failedSetItem.mockRestore()
    const originalSetItem = localStorage.setItem.bind(localStorage)
    const clobber = vi
      .spyOn(localStorage, 'setItem')
      .mockImplementation((key, value) => {
        const written = JSON.parse(value)
        delete written['pending-before-reset-clobber']
        originalSetItem(key, JSON.stringify(written))
      })

    useFeatureUsageTracker('reset-clobber-trigger').reset()
    clobber.mockRestore()
    pendingTracker.trackUsage()

    const stored = JSON.parse(localStorage.getItem(STORAGE_KEY) ?? '{}')
    expect(stored['pending-before-reset-clobber']?.useCount).toBe(2)
  })

  it('drains post-reset usage through an unrelated reset', () => {
    const featureId = 'post-reset-usage-before-other-reset'
    const tracker = useFeatureUsageTracker(featureId)
    tracker.trackUsage()
    const setItem = vi.spyOn(localStorage, 'setItem').mockImplementation(() => {
      throw new DOMException('Storage quota exceeded', 'QuotaExceededError')
    })
    tracker.reset()
    tracker.trackUsage()
    tracker.trackUsage()
    setItem.mockRestore()

    useFeatureUsageTracker('unrelated-reset-after-usage').reset()

    const stored = JSON.parse(localStorage.getItem(STORAGE_KEY) ?? '{}')
    expect(stored[featureId]?.useCount).toBe(2)
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
    const setItem = vi.spyOn(localStorage, 'setItem').mockImplementation(() => {
      throw new DOMException('Storage quota exceeded', 'QuotaExceededError')
    })

    tracker.reset()
    setItem.mockRestore()
    useFeatureUsageTracker('stored-reset-recovery').trackUsage()

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

  it('refreshes the shared snapshot before recording a failed write', () => {
    const featureId = 'snapshot-before-failed-write'
    localStorage.setItem(
      STORAGE_KEY,
      JSON.stringify({
        [featureId]: { useCount: 1, firstUsed: 1_000, lastUsed: 1_000 }
      })
    )
    const tracker = useFeatureUsageTracker(featureId)
    localStorage.setItem(
      STORAGE_KEY,
      JSON.stringify({
        [featureId]: { useCount: 5, firstUsed: 1_000, lastUsed: 2_000 }
      })
    )
    const setItem = vi.spyOn(localStorage, 'setItem').mockImplementation(() => {
      throw new DOMException('Storage quota exceeded', 'QuotaExceededError')
    })

    tracker.trackUsage()

    expect(tracker.useCount.value).toBe(6)
    setItem.mockRestore()
  })

  it('reconciles pending usage when another tracker mounts', () => {
    const featureId = 'snapshot-on-tracker-mount'
    localStorage.setItem(
      STORAGE_KEY,
      JSON.stringify({
        [featureId]: { useCount: 1, firstUsed: 1_000, lastUsed: 1_000 }
      })
    )
    const tracker = useFeatureUsageTracker(featureId)
    const setItem = vi.spyOn(localStorage, 'setItem').mockImplementation(() => {
      throw new DOMException('Storage quota exceeded', 'QuotaExceededError')
    })
    tracker.trackUsage()
    setItem.mockRestore()
    localStorage.setItem(
      STORAGE_KEY,
      JSON.stringify({
        [featureId]: { useCount: 1, firstUsed: 3_000, lastUsed: 3_000 }
      })
    )

    useFeatureUsageTracker('mount-reconciliation-trigger')

    expect(tracker.useCount.value).toBe(1)
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

  it('drops pending increments after an explicit external deletion', () => {
    const tracker = useFeatureUsageTracker('externally-deleted-pending')
    tracker.trackUsage()
    const oldValue = localStorage.getItem(STORAGE_KEY)
    vi.spyOn(console, 'error').mockImplementation(() => {})
    const setItem = vi.spyOn(localStorage, 'setItem').mockImplementation(() => {
      throw new DOMException('Storage quota exceeded', 'QuotaExceededError')
    })
    tracker.trackUsage()
    setItem.mockRestore()
    localStorage.setItem(STORAGE_KEY, '{}')
    window.dispatchEvent(
      new StorageEvent('storage', {
        key: STORAGE_KEY,
        oldValue,
        newValue: '{}',
        storageArea: localStorage
      })
    )

    useFeatureUsageTracker('external-delete-trigger').trackUsage()

    const stored = JSON.parse(localStorage.getItem(STORAGE_KEY) ?? '{}')
    expect(stored).not.toHaveProperty('externally-deleted-pending')
  })

  it('keeps increments recorded after an external deletion', () => {
    const featureId = 'usage-after-external-deletion'
    localStorage.setItem(
      STORAGE_KEY,
      JSON.stringify({
        [featureId]: { useCount: 1, firstUsed: 1_000, lastUsed: 2_000 }
      })
    )
    const tracker = useFeatureUsageTracker(featureId)
    const oldValue = localStorage.getItem(STORAGE_KEY)
    localStorage.setItem(STORAGE_KEY, '{}')
    vi.spyOn(console, 'error').mockImplementation(() => {})
    const setItem = vi.spyOn(localStorage, 'setItem').mockImplementation(() => {
      throw new DOMException('Storage quota exceeded', 'QuotaExceededError')
    })
    tracker.trackUsage()
    setItem.mockRestore()
    window.dispatchEvent(
      new StorageEvent('storage', {
        key: STORAGE_KEY,
        oldValue,
        newValue: '{}',
        storageArea: localStorage
      })
    )

    useFeatureUsageTracker('post-delete-trigger').trackUsage()

    const stored = JSON.parse(localStorage.getItem(STORAGE_KEY) ?? '{}')
    expect(stored[featureId]?.useCount).toBe(1)
  })

  it('keeps a failed increment from a generation recreated before deletion delivery', () => {
    const featureId = 'usage-after-recreation-before-event'
    const oldValue = JSON.stringify({
      [featureId]: { useCount: 1, firstUsed: 1_000, lastUsed: 1_000 }
    })
    localStorage.setItem(STORAGE_KEY, oldValue)
    localStorage.setItem(
      STORAGE_KEY,
      JSON.stringify({
        [featureId]: { useCount: 1, firstUsed: 3_000, lastUsed: 3_000 }
      })
    )
    const tracker = useFeatureUsageTracker(featureId)
    const setItem = vi.spyOn(localStorage, 'setItem').mockImplementation(() => {
      throw new DOMException('Storage quota exceeded', 'QuotaExceededError')
    })
    tracker.trackUsage()
    setItem.mockRestore()

    window.dispatchEvent(
      new StorageEvent('storage', {
        key: STORAGE_KEY,
        oldValue,
        newValue: '{}',
        storageArea: localStorage
      })
    )
    useFeatureUsageTracker('recreation-before-event-trigger').trackUsage()

    const stored = JSON.parse(localStorage.getItem(STORAGE_KEY) ?? '{}')
    expect(stored[featureId]?.useCount).toBe(2)
  })

  it('drops absent-baseline increments deleted by a newer generation', () => {
    vi.setSystemTime(3_000)
    const featureId = 'deleted-new-generation'
    const tracker = useFeatureUsageTracker(featureId)
    const setItem = vi.spyOn(localStorage, 'setItem').mockImplementation(() => {
      throw new DOMException('Storage quota exceeded', 'QuotaExceededError')
    })
    tracker.trackUsage()
    setItem.mockRestore()
    const externalValue = JSON.stringify({
      [featureId]: { useCount: 1, firstUsed: 4_000, lastUsed: 4_000 }
    })
    localStorage.setItem(STORAGE_KEY, '{}')
    window.dispatchEvent(
      new StorageEvent('storage', {
        key: STORAGE_KEY,
        oldValue: externalValue,
        newValue: '{}',
        storageArea: localStorage
      })
    )

    useFeatureUsageTracker('new-generation-trigger').trackUsage()

    const stored = JSON.parse(localStorage.getItem(STORAGE_KEY) ?? '{}')
    expect(stored).not.toHaveProperty(featureId)
  })

  it('keeps only increments recorded after an external deletion', () => {
    vi.setSystemTime(1_000)
    const featureId = 'usage-straddling-deletion'
    localStorage.setItem(
      STORAGE_KEY,
      JSON.stringify({
        [featureId]: { useCount: 1, firstUsed: 1_000, lastUsed: 1_000 }
      })
    )
    const oldValue = localStorage.getItem(STORAGE_KEY)
    const tracker = useFeatureUsageTracker(featureId)
    vi.spyOn(console, 'error').mockImplementation(() => {})
    const setItem = vi.spyOn(localStorage, 'setItem').mockImplementation(() => {
      throw new DOMException('Storage quota exceeded', 'QuotaExceededError')
    })
    tracker.trackUsage()
    localStorage.removeItem(STORAGE_KEY)
    const getItem = vi.spyOn(localStorage, 'getItem').mockImplementation(() => {
      throw new DOMException('Storage access denied', 'SecurityError')
    })
    vi.setSystemTime(2_000)
    tracker.trackUsage()
    getItem.mockRestore()
    setItem.mockRestore()
    window.dispatchEvent(
      new StorageEvent('storage', {
        key: STORAGE_KEY,
        oldValue,
        newValue: null,
        storageArea: localStorage
      })
    )

    useFeatureUsageTracker('straddling-deletion-trigger').trackUsage()

    const stored = JSON.parse(localStorage.getItem(STORAGE_KEY) ?? '{}')
    expect(stored[featureId]?.useCount).toBe(1)
  })

  it('keeps post-removal increments when the storage key deletion arrives', () => {
    vi.setSystemTime(2_000)
    const featureId = 'usage-after-key-removal'
    localStorage.setItem(
      STORAGE_KEY,
      JSON.stringify({
        [featureId]: { useCount: 1, firstUsed: 1_000, lastUsed: 1_000 }
      })
    )
    const oldValue = localStorage.getItem(STORAGE_KEY)
    localStorage.removeItem(STORAGE_KEY)
    vi.setSystemTime(3_000)
    const tracker = useFeatureUsageTracker(featureId)
    const setItem = vi.spyOn(localStorage, 'setItem').mockImplementation(() => {
      throw new DOMException('Storage quota exceeded', 'QuotaExceededError')
    })
    tracker.trackUsage()
    setItem.mockRestore()
    window.dispatchEvent(
      new StorageEvent('storage', {
        key: STORAGE_KEY,
        oldValue,
        newValue: null,
        storageArea: localStorage
      })
    )

    useFeatureUsageTracker('key-removal-trigger').trackUsage()

    const stored = JSON.parse(localStorage.getItem(STORAGE_KEY) ?? '{}')
    expect(stored[featureId]?.useCount).toBe(1)
  })

  it('ignores malformed external storage events', () => {
    const featureId = 'pending-through-malformed-event'
    const tracker = useFeatureUsageTracker(featureId)
    tracker.trackUsage()
    const currentValue = localStorage.getItem(STORAGE_KEY)
    const setItem = vi.spyOn(localStorage, 'setItem').mockImplementation(() => {
      throw new DOMException('Storage quota exceeded', 'QuotaExceededError')
    })
    tracker.trackUsage()
    setItem.mockRestore()
    window.dispatchEvent(
      new StorageEvent('storage', {
        key: STORAGE_KEY,
        oldValue: currentValue,
        newValue: '{',
        storageArea: localStorage
      })
    )
    window.dispatchEvent(
      new StorageEvent('storage', {
        key: STORAGE_KEY,
        oldValue: currentValue,
        newValue: JSON.stringify({ [featureId]: { useCount: 'invalid' } }),
        storageArea: localStorage
      })
    )

    useFeatureUsageTracker('malformed-event-trigger').trackUsage()

    const stored = JSON.parse(localStorage.getItem(STORAGE_KEY) ?? '{}')
    expect(stored[featureId]?.useCount).toBe(2)
  })

  it('uses valid features from a partial old storage payload', () => {
    vi.setSystemTime(1_000)
    const featureId = 'deleted-from-partial-old-payload'
    const tracker = useFeatureUsageTracker(featureId)
    const setItem = vi.spyOn(localStorage, 'setItem').mockImplementation(() => {
      throw new DOMException('Storage quota exceeded', 'QuotaExceededError')
    })
    tracker.trackUsage()
    setItem.mockRestore()
    const oldValue = JSON.stringify({
      [featureId]: { useCount: 1, firstUsed: 2_000, lastUsed: 2_000 },
      invalid: { useCount: 'invalid' }
    })
    localStorage.setItem(STORAGE_KEY, '{}')

    window.dispatchEvent(
      new StorageEvent('storage', {
        key: STORAGE_KEY,
        oldValue,
        newValue: '{}',
        storageArea: localStorage
      })
    )
    useFeatureUsageTracker('partial-old-trigger').trackUsage()

    const stored = JSON.parse(localStorage.getItem(STORAGE_KEY) ?? '{}')
    expect(stored).not.toHaveProperty(featureId)
  })

  it('reports storage access failures while handling events', () => {
    useFeatureUsageTracker('event-access-error')
    vi.spyOn(window, 'localStorage', 'get').mockImplementation(() => {
      throw new DOMException('Storage access denied', 'SecurityError')
    })

    window.dispatchEvent(new StorageEvent('storage', { key: STORAGE_KEY }))

    expect(reportError).toHaveBeenCalledWith(expect.any(DOMException), {
      errorType: 'error_accessing_feature_usage_event_storage',
      surface: 'platform'
    })
  })

  it('reports storage read failures while reconciling events', () => {
    useFeatureUsageTracker('event-read-error')
    vi.spyOn(localStorage, 'getItem').mockImplementation(() => {
      throw new DOMException('Storage access denied', 'SecurityError')
    })

    window.dispatchEvent(
      new StorageEvent('storage', {
        key: STORAGE_KEY,
        storageArea: localStorage
      })
    )

    expect(reportError).toHaveBeenCalledWith(expect.any(DOMException), {
      errorType: 'error_reconciling_feature_usage_event',
      surface: 'platform'
    })
  })

  it('does not restore deleted pending usage during an unrelated reset', () => {
    const featureId = 'deleted-before-unrelated-reset'
    const tracker = useFeatureUsageTracker(featureId)
    tracker.trackUsage()
    const setItem = vi.spyOn(localStorage, 'setItem').mockImplementation(() => {
      throw new DOMException('Storage quota exceeded', 'QuotaExceededError')
    })
    tracker.trackUsage()
    setItem.mockRestore()
    localStorage.setItem(STORAGE_KEY, '{}')

    useFeatureUsageTracker('unrelated-reset').reset()

    const stored = JSON.parse(localStorage.getItem(STORAGE_KEY) ?? '{}')
    expect(stored).not.toHaveProperty(featureId)
  })

  it('reconciles pending usage against the valid part of partial storage', () => {
    const featureId = 'deleted-beside-invalid-entry'
    const tracker = useFeatureUsageTracker(featureId)
    tracker.trackUsage()
    const setItem = vi.spyOn(localStorage, 'setItem').mockImplementation(() => {
      throw new DOMException('Storage quota exceeded', 'QuotaExceededError')
    })
    tracker.trackUsage()
    setItem.mockRestore()
    localStorage.setItem(
      STORAGE_KEY,
      JSON.stringify({ invalid: { useCount: 'invalid' } })
    )

    useFeatureUsageTracker('partial-storage-reset').reset()

    const stored = JSON.parse(localStorage.getItem(STORAGE_KEY) ?? '{}')
    expect(stored).not.toHaveProperty(featureId)
  })

  it('retains pending usage for an invalid entry in partial storage', () => {
    const featureId = 'pending-invalid-entry'
    localStorage.setItem(
      STORAGE_KEY,
      JSON.stringify({
        [featureId]: { useCount: 1, firstUsed: 1_000, lastUsed: 1_000 }
      })
    )
    const tracker = useFeatureUsageTracker(featureId)
    const setItem = vi.spyOn(localStorage, 'setItem').mockImplementation(() => {
      throw new DOMException('Storage quota exceeded', 'QuotaExceededError')
    })
    tracker.trackUsage()
    setItem.mockRestore()
    localStorage.setItem(
      STORAGE_KEY,
      JSON.stringify({ [featureId]: { useCount: 'invalid' } })
    )

    tracker.trackUsage()

    const stored = JSON.parse(localStorage.getItem(STORAGE_KEY) ?? '{}')
    expect(stored[featureId]?.useCount).toBe(2)
  })

  it('retains a pending reset for an invalid entry in partial storage', () => {
    const featureId = 'reset-invalid-entry'
    localStorage.setItem(
      STORAGE_KEY,
      JSON.stringify({
        [featureId]: { useCount: 1, firstUsed: 1_000, lastUsed: 1_000 }
      })
    )
    const tracker = useFeatureUsageTracker(featureId)
    const setItem = vi.spyOn(localStorage, 'setItem').mockImplementation(() => {
      throw new DOMException('Storage quota exceeded', 'QuotaExceededError')
    })
    tracker.reset()
    setItem.mockRestore()
    localStorage.setItem(
      STORAGE_KEY,
      JSON.stringify({ [featureId]: { useCount: 'invalid' } })
    )

    useFeatureUsageTracker('invalid-reset-trigger').trackUsage()

    const stored = JSON.parse(localStorage.getItem(STORAGE_KEY) ?? '{}')
    expect(stored).not.toHaveProperty(featureId)
  })

  it.for([
    {
      operation: 'tracking',
      update: () => useFeatureUsageTracker('valid-track-trigger').trackUsage()
    },
    {
      operation: 'resetting',
      update: () => useFeatureUsageTracker('valid-reset-trigger').reset()
    }
  ])(
    'preserves invalid entries while $operation another feature',
    ({ update }) => {
      localStorage.setItem(
        STORAGE_KEY,
        JSON.stringify({ invalid: { useCount: 'invalid' } })
      )

      update()

      const stored = JSON.parse(localStorage.getItem(STORAGE_KEY) ?? '{}')
      expect(stored.invalid).toEqual({ useCount: 'invalid' })
    }
  )

  it('reconciles a reset from current storage despite a partial event', () => {
    const featureId = 'reset-through-partial-event'
    localStorage.setItem(
      STORAGE_KEY,
      JSON.stringify({
        [featureId]: { useCount: 1, firstUsed: 1_000, lastUsed: 1_000 }
      })
    )
    const tracker = useFeatureUsageTracker(featureId)
    const setItem = vi.spyOn(localStorage, 'setItem').mockImplementation(() => {
      throw new DOMException('Storage quota exceeded', 'QuotaExceededError')
    })
    tracker.reset()
    setItem.mockRestore()
    const partialValue = JSON.stringify({
      [featureId]: { useCount: 2, firstUsed: 1_000, lastUsed: 2_000 },
      invalid: { useCount: 'invalid' }
    })
    localStorage.setItem(STORAGE_KEY, partialValue)

    window.dispatchEvent(
      new StorageEvent('storage', {
        key: STORAGE_KEY,
        oldValue: partialValue,
        newValue: partialValue,
        storageArea: localStorage
      })
    )
    useFeatureUsageTracker('partial-event-trigger').trackUsage()

    const stored = JSON.parse(localStorage.getItem(STORAGE_KEY) ?? '{}')
    expect(stored[featureId]?.useCount).toBe(2)
  })

  it('ignores an empty-string external storage event', () => {
    const featureId = 'pending-through-empty-event'
    const tracker = useFeatureUsageTracker(featureId)
    tracker.trackUsage()
    const currentValue = localStorage.getItem(STORAGE_KEY)
    const setItem = vi.spyOn(localStorage, 'setItem').mockImplementation(() => {
      throw new DOMException('Storage quota exceeded', 'QuotaExceededError')
    })
    tracker.trackUsage()
    setItem.mockRestore()
    vi.spyOn(console, 'error').mockImplementation(() => {})
    window.dispatchEvent(
      new StorageEvent('storage', {
        key: STORAGE_KEY,
        oldValue: currentValue,
        newValue: '',
        storageArea: localStorage
      })
    )

    useFeatureUsageTracker('empty-event-trigger').trackUsage()

    const stored = JSON.parse(localStorage.getItem(STORAGE_KEY) ?? '{}')
    expect(stored[featureId]?.useCount).toBe(2)
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

  it('does not merge pending usage into a recreated generation', () => {
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
      useCount: 6,
      firstUsed: 2_000,
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

  it('restarts a disposed tracker after reset when storage cannot be read', () => {
    const scope = effectScope()
    let trackDisposedFeature = () => {}
    scope.run(() => {
      const tracker = useFeatureUsageTracker('reset-before-blocked-read')
      tracker.trackUsage()
      trackDisposedFeature = tracker.trackUsage
    })
    scope.stop()
    useFeatureUsageTracker('reset-before-blocked-read').reset()
    vi.spyOn(console, 'error').mockImplementation(() => {})
    const getItem = vi.spyOn(localStorage, 'getItem').mockImplementation(() => {
      throw new DOMException('Storage access denied', 'SecurityError')
    })
    trackDisposedFeature()
    getItem.mockRestore()

    useFeatureUsageTracker('blocked-read-recovery').trackUsage()

    const stored = JSON.parse(localStorage.getItem(STORAGE_KEY) ?? '{}')
    expect(stored['reset-before-blocked-read']?.useCount).toBe(1)
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
      useCount: '2.9999999999999999',
      firstUsed: 1_000,
      lastUsed: 2_000
    },
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
    { useCount: 1, firstUsed: 2_000, lastUsed: 1_000 },
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

  it('clamps implausible future timestamps without discarding usage', () => {
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
      firstUsed: 1_700_000_000_000,
      lastUsed: 1_700_000_000_000
    })
  })

  it('repairs plausible future timestamps before ordering usage', () => {
    vi.setSystemTime(1_700_000_000_000)
    const future = Date.now() + 60 * 60 * 1_000
    localStorage.setItem(
      STORAGE_KEY,
      JSON.stringify({
        'drifted-timestamp': {
          useCount: 5,
          firstUsed: future,
          lastUsed: future
        }
      })
    )

    useFeatureUsageTracker('drifted-timestamp').trackUsage()

    const stored = JSON.parse(localStorage.getItem(STORAGE_KEY) ?? '{}')
    expect(stored['drifted-timestamp']).toEqual({
      useCount: 6,
      firstUsed: Date.now(),
      lastUsed: Date.now()
    })
  })

  it('retains an unchanged pending baseline with an unreliable clock', () => {
    vi.setSystemTime(1_000)
    const featureId = 'unchanged-unreliable-baseline'
    localStorage.setItem(
      STORAGE_KEY,
      JSON.stringify({
        [featureId]: { useCount: 1, firstUsed: 500_000, lastUsed: 500_000 }
      })
    )
    const tracker = useFeatureUsageTracker(featureId)
    const setItem = vi.spyOn(localStorage, 'setItem').mockImplementation(() => {
      throw new DOMException('Storage quota exceeded', 'QuotaExceededError')
    })
    tracker.trackUsage()
    setItem.mockRestore()

    tracker.trackUsage()

    const stored = JSON.parse(localStorage.getItem(STORAGE_KEY) ?? '{}')
    expect(stored[featureId]?.useCount).toBe(3)
  })

  it('repairs only the drifted timestamp field', () => {
    vi.setSystemTime(10_000)
    localStorage.setItem(
      STORAGE_KEY,
      JSON.stringify({
        'partially-drifted-timestamp': {
          useCount: 5,
          firstUsed: 1_000,
          lastUsed: 500_000
        }
      })
    )

    useFeatureUsageTracker('partially-drifted-timestamp').trackUsage()

    const stored = JSON.parse(localStorage.getItem(STORAGE_KEY) ?? '{}')
    expect(stored['partially-drifted-timestamp']).toEqual({
      useCount: 6,
      firstUsed: 1_000,
      lastUsed: 10_000
    })
  })

  it('keeps independently repaired timestamps ordered', () => {
    vi.setSystemTime(10_000)
    localStorage.setItem(
      STORAGE_KEY,
      JSON.stringify({
        'inverted-after-repair': {
          useCount: 5,
          firstUsed: 200_000,
          lastUsed: 500_000
        }
      })
    )

    useFeatureUsageTracker('inverted-after-repair').trackUsage()

    const stored = JSON.parse(localStorage.getItem(STORAGE_KEY) ?? '{}')
    expect(stored['inverted-after-repair']).toEqual({
      useCount: 6,
      firstUsed: 10_000,
      lastUsed: 10_000
    })
  })

  it('keeps pending usage self-consistent with a future baseline', () => {
    vi.setSystemTime(1_000)
    const featureId = 'future-pending-baseline'
    localStorage.setItem(
      STORAGE_KEY,
      JSON.stringify({
        [featureId]: { useCount: 1, firstUsed: 2_000, lastUsed: 2_000 }
      })
    )
    const tracker = useFeatureUsageTracker(featureId)
    const setItem = vi.spyOn(localStorage, 'setItem').mockImplementation(() => {
      throw new DOMException('Storage quota exceeded', 'QuotaExceededError')
    })
    tracker.trackUsage()
    setItem.mockRestore()
    localStorage.setItem(
      STORAGE_KEY,
      JSON.stringify({ [featureId]: { useCount: 'invalid' } })
    )

    tracker.trackUsage()

    const stored = JSON.parse(localStorage.getItem(STORAGE_KEY) ?? '{}')
    expect(stored[featureId]).toEqual({
      useCount: 2,
      firstUsed: 1_000,
      lastUsed: 1_000
    })
  })

  it('keeps future timestamp normalization stable across later reads', () => {
    vi.setSystemTime(1_700_000_000_000)
    const featureId = 'stable-future-timestamp'
    localStorage.setItem(
      STORAGE_KEY,
      JSON.stringify({
        [featureId]: {
          useCount: 5,
          firstUsed: Number.MAX_SAFE_INTEGER,
          lastUsed: Number.MAX_SAFE_INTEGER
        }
      })
    )
    const tracker = useFeatureUsageTracker(featureId)
    const setItem = vi.spyOn(localStorage, 'setItem').mockImplementation(() => {
      throw new DOMException('Storage quota exceeded', 'QuotaExceededError')
    })
    tracker.reset()
    setItem.mockRestore()
    vi.setSystemTime(1_800_000_000_000)

    useFeatureUsageTracker('stable-future-trigger').trackUsage()

    const stored = JSON.parse(localStorage.getItem(STORAGE_KEY) ?? '{}')
    expect(stored).not.toHaveProperty(featureId)
  })

  it('keeps writes stable when the clock exceeds the timestamp limit', () => {
    vi.setSystemTime(Date.UTC(2101, 0, 1))
    const tracker = useFeatureUsageTracker('post-limit-clock')

    tracker.trackUsage()
    tracker.trackUsage()

    const stored = JSON.parse(localStorage.getItem(STORAGE_KEY) ?? '{}')
    expect(stored['post-limit-clock']).toEqual({
      useCount: 2,
      firstUsed: Date.UTC(2100, 0, 1),
      lastUsed: Date.UTC(2100, 0, 1)
    })
    expect(reportError).not.toHaveBeenCalled()
  })

  it('repairs malformed JSON storage data', () => {
    localStorage.setItem(STORAGE_KEY, '{')

    useFeatureUsageTracker('malformed-json').trackUsage()

    const stored = JSON.parse(localStorage.getItem(STORAGE_KEY) ?? '{}')
    expect(stored['malformed-json']?.useCount).toBe(1)
    expect(reportError).toHaveBeenCalledWith(
      expect.objectContaining({
        message: 'Invalid feature usage JSON',
        name: 'SyntaxError'
      }),
      {
        errorType: 'error_parsing_feature_usage',
        surface: 'platform'
      }
    )
  })
})
