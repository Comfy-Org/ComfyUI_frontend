import { createTestingPinia } from '@pinia/testing'
import { setActivePinia } from 'pinia'
import { beforeEach, describe, expect, it, vi } from 'vitest'

import { useTemplateRankingStore } from '@/stores/templateRankingStore'

// Mock axios
vi.mock('axios', () => ({
  default: {
    get: vi.fn()
  }
}))

describe('templateRankingStore', () => {
  beforeEach(() => {
    setActivePinia(createTestingPinia({ stubActions: false }))
    vi.clearAllMocks()
  })

  describe('computeFreshness', () => {
    it('returns 1.0 for brand new template (today)', () => {
      const store = useTemplateRankingStore()
      const today = new Date().toISOString().split('T')[0]
      const freshness = store.computeFreshness(today)
      expect(freshness).toBeCloseTo(1.0, 1)
    })

    it('returns ~0.5 for 90-day old template', () => {
      const store = useTemplateRankingStore()
      const ninetyDaysAgo = new Date(Date.now() - 90 * 24 * 60 * 60 * 1000)
        .toISOString()
        .split('T')[0]
      const freshness = store.computeFreshness(ninetyDaysAgo)
      expect(freshness).toBeCloseTo(0.5, 1)
    })

    it('returns 0.1 minimum for very old template', () => {
      const store = useTemplateRankingStore()
      const freshness = store.computeFreshness('2020-01-01')
      expect(freshness).toBe(0.1)
    })

    it('returns 0.5 for undefined date', () => {
      const store = useTemplateRankingStore()
      expect(store.computeFreshness(undefined)).toBe(0.5)
    })

    it('returns 0.5 for invalid date', () => {
      const store = useTemplateRankingStore()
      expect(store.computeFreshness('not-a-date')).toBe(0.5)
    })
  })

  describe('computeDefaultScore', () => {
    it('scores an uncurated template from usage and freshness alone', () => {
      const store = useTemplateRankingStore()
      store.largestUsageScore = 100
      // curation = neutral 0.5, freshness = 0.1 (old date), usage = 0
      // score = 0 * 0.5 + 0.5 * 0.3 + 0.1 * 0.2 = 0.17
      expect(store.computeDefaultScore('2024-01-01', undefined, 0)).toBeCloseTo(
        0.17,
        2
      )
    })

    it('ranks promoted above neutral above demoted', () => {
      const store = useTemplateRankingStore()
      store.largestUsageScore = 100
      const promoted = store.computeDefaultScore('2024-01-01', 1000, 0)
      const neutral = store.computeDefaultScore('2024-01-01', 0, 0)
      const demoted = store.computeDefaultScore('2024-01-01', -1000, 0)

      expect(promoted).toBeGreaterThan(neutral)
      expect(neutral).toBeGreaterThan(demoted)
    })

    it('scores an explicit zero the same as an absent searchRank', () => {
      const store = useTemplateRankingStore()
      store.largestUsageScore = 100

      expect(store.computeDefaultScore('2024-01-01', 0, 0)).toBe(
        store.computeDefaultScore('2024-01-01', undefined, 0)
      )
    })

    it('saturates out-of-range ranks instead of returning runaway scores', () => {
      const store = useTemplateRankingStore()
      store.largestUsageScore = 100
      const capped = store.computeDefaultScore('2024-01-01', 1000, 0)

      expect(store.computeDefaultScore('2024-01-01', 1_000_000, 0)).toBe(capped)
      expect(capped).toBeLessThanOrEqual(1)
    })

    it('stays finite when nothing in the filtered set has usage', () => {
      const store = useTemplateRankingStore()
      store.largestUsageScore = 0

      expect(store.computeDefaultScore('2024-01-01', 8, 0)).toBeGreaterThan(0)
    })
  })
})
