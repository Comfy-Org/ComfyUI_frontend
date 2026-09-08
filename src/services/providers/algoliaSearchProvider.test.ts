import type { Mock } from 'vitest'
import { liteClient as algoliasearch } from 'algoliasearch/dist/lite/builds/browser'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import { useAlgoliaSearchProvider } from '@/services/providers/algoliaSearchProvider'

type GlobalWithAlgolia = typeof globalThis & {
  __ALGOLIA_APP_ID__: string
  __ALGOLIA_API_KEY__: string
}

// Mock global Algolia constants
const globalWithAlgolia = globalThis as GlobalWithAlgolia
globalWithAlgolia.__ALGOLIA_APP_ID__ = 'test-app-id'
globalWithAlgolia.__ALGOLIA_API_KEY__ = 'test-api-key'

// Mock algoliasearch
vi.mock('algoliasearch/dist/lite/builds/browser', () => ({
  liteClient: vi.fn()
}))

interface MockSearchClient {
  search: Mock
}

describe('useAlgoliaSearchProvider', () => {
  let mockSearchClient: MockSearchClient

  beforeEach(() => {
    // Create mock search client
    mockSearchClient = {
      search: vi.fn()
    }

    vi.mocked(algoliasearch).mockReturnValue(
      mockSearchClient as Partial<
        ReturnType<typeof algoliasearch>
      > as ReturnType<typeof algoliasearch>
    )
  })

  afterEach(() => {
    // Clear the module-level cache between tests
    const provider = useAlgoliaSearchProvider()
    provider.clearSearchCache()
  })

  describe('searchPacks', () => {
    it('should search for packs and convert results', async () => {
      const mockAlgoliaResults = {
        results: [
          {
            hits: [
              {
                objectID: 'algolia-1',
                id: 'pack-1',
                name: 'Test Pack',
                description: 'A test pack',
                publisher_id: 'publisher-1',
                total_install: 500,
                create_time: '2024-01-01T00:00:00Z',
                update_time: '2024-01-15T00:00:00Z',
                repository_url: 'https://github.com/test/pack',
                license: 'MIT',
                status: 'active',
                latest_version: '1.0.0',
                latest_version_status: 'published',
                icon_url: 'https://example.com/icon.png',
                comfy_nodes: ['LoadImage', 'SaveImage']
              }
            ]
          },
          { hits: [] } // Query suggestions
        ]
      }

      mockSearchClient.search.mockResolvedValue(mockAlgoliaResults)

      const provider = useAlgoliaSearchProvider()
      const result = await provider.searchPacks('test', {
        pageSize: 10,
        pageNumber: 0
      })

      expect(mockSearchClient.search).toHaveBeenCalledWith({
        requests: [
          {
            query: 'test',
            indexName: 'nodes_index',
            attributesToRetrieve: expect.any(Array),
            hitsPerPage: 10,
            page: 0
          },
          {
            query: 'test',
            indexName: 'nodes_index_query_suggestions'
          }
        ],
        strategy: 'none'
      })

      expect(result.nodePacks).toHaveLength(1)
      expect(result.nodePacks[0]).toEqual({
        id: 'pack-1',
        name: 'Test Pack',
        description: 'A test pack',
        repository: 'https://github.com/test/pack',
        license: 'MIT',
        downloads: 500,
        status: 'active',
        icon: 'https://example.com/icon.png',
        latest_version: {
          version: '1.0.0',
          createdAt: '2024-01-15T00:00:00Z',
          status: 'published',
          comfy_node_extract_status: undefined
        },
        publisher: {
          id: 'publisher-1',
          name: 'publisher-1'
        },
        created_at: '2024-01-01T00:00:00Z',
        comfy_nodes: ['LoadImage', 'SaveImage'],
        category: undefined,
        author: undefined,
        tags: undefined,
        github_stars: undefined,
        supported_os: undefined,
        supported_comfyui_version: undefined,
        supported_comfyui_frontend_version: undefined,
        supported_accelerators: undefined,
        banner_url: undefined
      })
    })

    it('should include query suggestions when query is long enough', async () => {
      const mockAlgoliaResults = {
        results: [
          { hits: [] }, // Main results
          {
            hits: [
              { query: 'test query', popularity: 10 },
              { query: 'test pack', popularity: 5 }
            ]
          }
        ]
      }

      mockSearchClient.search.mockResolvedValue(mockAlgoliaResults)

      const provider = useAlgoliaSearchProvider()
      const result = await provider.searchPacks('test', {
        pageSize: 10,
        pageNumber: 0
      })

      // Should make 2 requests (main + suggestions)
      expect(mockSearchClient.search).toHaveBeenCalledWith({
        requests: [
          expect.objectContaining({ indexName: 'nodes_index' }),
          expect.objectContaining({
            indexName: 'nodes_index_query_suggestions'
          })
        ],
        strategy: 'none'
      })

      expect(result.querySuggestions).toEqual([
        { query: 'test query', popularity: 10 },
        { query: 'test pack', popularity: 5 }
      ])
    })

    it('should not query suggestions for short queries', async () => {
      mockSearchClient.search.mockResolvedValue({
        results: [{ hits: [] }]
      })

      const provider = useAlgoliaSearchProvider()
      await provider.searchPacks('a', {
        pageSize: 10,
        pageNumber: 0
      })

      // Should only make 1 request (no suggestions)
      expect(mockSearchClient.search).toHaveBeenCalledWith({
        requests: [expect.objectContaining({ indexName: 'nodes_index' })],
        strategy: 'none'
      })
    })

    it('should cache search results', async () => {
      mockSearchClient.search.mockResolvedValue({
        results: [{ hits: [] }, { hits: [] }]
      })

      const provider = useAlgoliaSearchProvider()
      const params = { pageSize: 10, pageNumber: 0 }

      // First call
      await provider.searchPacks('test', params)
      expect(mockSearchClient.search).toHaveBeenCalledTimes(1)

      // Second call with same params should use cache
      await provider.searchPacks('test', params)
      expect(mockSearchClient.search).toHaveBeenCalledTimes(1)

      // Different params should make new request
      await provider.searchPacks('test', { ...params, pageNumber: 1 })
      expect(mockSearchClient.search).toHaveBeenCalledTimes(2)
    })

    it('should handle missing objectID by using id field', async () => {
      const mockAlgoliaResults = {
        results: [
          {
            hits: [
              {
                id: 'pack-id-only',
                name: 'Pack without objectID',
                // ... other required fields
                publisher_id: 'pub',
                total_install: 0,
                comfy_nodes: []
              }
            ]
          },
          { hits: [] }
        ]
      }

      mockSearchClient.search.mockResolvedValue(mockAlgoliaResults)

      const provider = useAlgoliaSearchProvider()
      const result = await provider.searchPacks('test', {
        pageSize: 10,
        pageNumber: 0
      })

      expect(result.nodePacks[0].id).toBe('pack-id-only')
    })
  })

  describe('clearSearchCache', () => {
    it('should clear the cache', async () => {
      mockSearchClient.search.mockResolvedValue({
        results: [{ hits: [] }, { hits: [] }]
      })

      const provider = useAlgoliaSearchProvider()
      const params = { pageSize: 10, pageNumber: 0 }

      // Populate cache
      await provider.searchPacks('test', params)
      expect(mockSearchClient.search).toHaveBeenCalledTimes(1)

      // Clear cache
      provider.clearSearchCache()

      // Same search should hit API again
      await provider.searchPacks('test', params)
      expect(mockSearchClient.search).toHaveBeenCalledTimes(2)
    })
  })

  describe('memoization', () => {
    it('should memoize toRegistryPack conversions', async () => {
      const mockHit = {
        objectID: 'algolia-1',
        id: 'pack-1',
        name: 'Test Pack',
        publisher_id: 'pub1',
        total_install: 100,
        comfy_nodes: []
      }

      mockSearchClient.search.mockResolvedValue({
        results: [
          { hits: [mockHit, mockHit, mockHit] }, // Same object 3 times
          { hits: [] }
        ]
      })

      const provider = useAlgoliaSearchProvider()
      const result = await provider.searchPacks('test', {
        pageSize: 10,
        pageNumber: 0
      })

      // All 3 results should be the same object reference due to memoization
      expect(result.nodePacks[0]).toBe(result.nodePacks[1])
      expect(result.nodePacks[1]).toBe(result.nodePacks[2])
    })
  })
})
