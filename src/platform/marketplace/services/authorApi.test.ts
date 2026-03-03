import { beforeEach, describe, expect, it, vi } from 'vitest'

import type { MarketplaceTemplate } from '../types/marketplace'

import {
  createMemoryCollection,
  createMockMarketplaceTemplate
} from './__tests__/testUtils'

const mockCollection = createMemoryCollection<MarketplaceTemplate>()

vi.mock('@/utils/mockKVStore', () => ({
  useMockKVStore: () => ({
    collection: () => mockCollection
  })
}))

const { getAuthorTemplates, getAuthorStats } = await import('./authorApi')

describe('authorApi', () => {
  beforeEach(() => {
    mockCollection.clear()
  })

  describe('getAuthorTemplates', () => {
    it('returns only templates belonging to the author', async () => {
      mockCollection.create(
        createMockMarketplaceTemplate({
          author: { id: 'a1', name: 'A1', isVerified: false, profileUrl: '' }
        })
      )
      mockCollection.create(
        createMockMarketplaceTemplate({
          author: { id: 'a2', name: 'A2', isVerified: false, profileUrl: '' }
        })
      )
      mockCollection.create(
        createMockMarketplaceTemplate({
          author: { id: 'a1', name: 'A1', isVerified: false, profileUrl: '' }
        })
      )

      const result = await getAuthorTemplates('a1')
      expect(result.templates).toHaveLength(2)
    })

    it('returns empty array for unknown author', async () => {
      const result = await getAuthorTemplates('nobody')
      expect(result.templates).toHaveLength(0)
    })
  })

  describe('getAuthorStats', () => {
    it('aggregates stats across author templates', async () => {
      mockCollection.create(
        createMockMarketplaceTemplate({
          author: { id: 'a1', name: 'A1', isVerified: false, profileUrl: '' },
          stats: {
            downloads: 100,
            favorites: 10,
            rating: 4,
            reviewCount: 5,
            weeklyTrend: 0
          }
        })
      )
      mockCollection.create(
        createMockMarketplaceTemplate({
          author: { id: 'a1', name: 'A1', isVerified: false, profileUrl: '' },
          stats: {
            downloads: 200,
            favorites: 20,
            rating: 2,
            reviewCount: 3,
            weeklyTrend: 0
          }
        })
      )

      const stats = await getAuthorStats('a1')
      expect(stats.totalDownloads).toBe(300)
      expect(stats.totalFavorites).toBe(30)
      expect(stats.averageRating).toBe(3)
      expect(stats.templateCount).toBe(2)
    })

    it('returns zeroes for unknown author', async () => {
      const stats = await getAuthorStats('nobody')
      expect(stats.totalDownloads).toBe(0)
      expect(stats.templateCount).toBe(0)
      expect(stats.averageRating).toBe(0)
    })
  })
})
