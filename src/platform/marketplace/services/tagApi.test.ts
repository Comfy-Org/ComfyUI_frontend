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

const { getCategories, suggestTags } = await import('./tagApi')

describe('tagApi', () => {
  beforeEach(() => {
    mockCollection.clear()
  })

  describe('getCategories', () => {
    it('returns the predefined category list', async () => {
      const result = await getCategories()
      expect(result.categories).toContain('Image Generation')
      expect(result.categories).toContain('Video')
      expect(result.categories.length).toBeGreaterThan(0)
    })
  })

  describe('suggestTags', () => {
    it('returns matching tags filtered by query', async () => {
      mockCollection.create(
        createMockMarketplaceTemplate({
          name: 'wf1',
          tags: ['portrait', 'landscape', 'photo']
        })
      )
      mockCollection.create(
        createMockMarketplaceTemplate({
          name: 'wf2',
          tags: ['portrait', 'anime']
        })
      )

      const result = await suggestTags('port')
      expect(result.tags).toEqual(['portrait'])
    })

    it('returns deduplicated tags when query is empty', async () => {
      mockCollection.create(
        createMockMarketplaceTemplate({
          name: 'wf1',
          tags: ['a', 'b']
        })
      )
      mockCollection.create(
        createMockMarketplaceTemplate({
          name: 'wf2',
          tags: ['b', 'c']
        })
      )

      const result = await suggestTags('')
      expect(result.tags).toEqual(['a', 'b', 'c'])
    })

    it('returns empty array when no tags match', async () => {
      mockCollection.create(
        createMockMarketplaceTemplate({
          name: 'wf1',
          tags: ['portrait']
        })
      )

      const result = await suggestTags('xyz')
      expect(result.tags).toHaveLength(0)
    })
  })
})
