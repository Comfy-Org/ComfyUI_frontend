import type { Mock } from 'vitest'
import { liteClient as algoliasearch } from 'algoliasearch/dist/lite/builds/browser'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import { reportError } from '@/platform/telemetry/reportError'
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
vi.mock(import('algoliasearch/dist/lite/builds/browser'), () => ({
  liteClient: vi.fn()
}))

vi.mock(import('@/platform/telemetry/reportError'))

interface MockSearchClient {
  search: Mock
}

const packHit = (id: string) => ({
  objectID: id,
  id,
  name: id,
  publisher_id: 'pub',
  total_install: 0,
  comfy_nodes: []
})

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

  const packQueriesPerRequest = () =>
    mockSearchClient.search.mock.calls.map(([{ requests }]) =>
      requests
        .filter((r: { indexName: string }) => r.indexName === 'nodes_index')
        .map((r: { query: string }) => r.query)
    )

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

    it.for(['id', 'objectID'])(
      'should take the pack id from a hit that has only %s',
      async (idField) => {
        mockSearchClient.search.mockResolvedValue({
          results: [
            {
              hits: [
                {
                  [idField]: 'single-id',
                  name: 'Pack',
                  publisher_id: 'pub',
                  total_install: 0,
                  comfy_nodes: []
                }
              ]
            },
            { hits: [] }
          ]
        })

        const provider = useAlgoliaSearchProvider()
        const result = await provider.searchPacks('test', {
          pageSize: 10,
          pageNumber: 0
        })

        expect(result.nodePacks[0].id).toBe('single-id')
      }
    )

    it('rejects when the Algolia request fails so the gateway can fail over', async () => {
      const algoliaError = new Error('Algolia request failed')
      mockSearchClient.search.mockRejectedValue(algoliaError)

      const provider = useAlgoliaSearchProvider()

      await expect(
        provider.searchPacks('euler-discrete-scheduler', {
          pageSize: 10,
          pageNumber: 0
        })
      ).rejects.toThrow('Algolia request failed')
    })

    it('preserves raw results and suggestions when the rewrite request fails', async () => {
      const fallbackError = new Error('Algolia rewrite request failed')
      mockSearchClient.search
        .mockResolvedValueOnce({
          results: [
            { hits: [packHit('raw-preserved')], nbPages: 1 },
            { hits: [{ query: 'euler discrete scheduler', popularity: 7 }] }
          ]
        })
        .mockRejectedValueOnce(fallbackError)

      const provider = useAlgoliaSearchProvider()
      const result = await provider.searchPacks('euler-discrete-scheduler', {
        pageSize: 10,
        pageNumber: 0
      })

      expect(result.nodePacks.map((pack) => pack.id)).toEqual(['raw-preserved'])
      expect(result.querySuggestions).toEqual([
        { query: 'euler discrete scheduler', popularity: 7 }
      ])
      expect(result.rawResultsEmpty).toBe(false)
      expect(result.hasMore).toBe(false)
      expect(reportError).toHaveBeenCalledExactlyOnceWith(fallbackError, {
        errorType: 'error_searching_algolia_fallbacks',
        surface: 'platform',
        level: 'warning',
        tags: { outcome: 'degraded' }
      })
    })

    it('sends no fallback queries when the raw query fills the page', async () => {
      mockSearchClient.search.mockResolvedValueOnce({
        results: [
          { hits: Array.from({ length: 10 }, (_, i) => packHit(`raw-${i}`)) },
          { hits: [] }
        ]
      })

      const provider = useAlgoliaSearchProvider()
      const result = await provider.searchPacks('euler-discrete-scheduler', {
        pageSize: 10,
        pageNumber: 0
      })

      expect(packQueriesPerRequest()).toEqual([['euler-discrete-scheduler']])
      expect(result.nodePacks).toHaveLength(10)
    })

    it('sends the fallback queries in a second batch when the raw query is short of a page', async () => {
      mockSearchClient.search
        .mockResolvedValueOnce({ results: [{ hits: [] }, { hits: [] }] })
        .mockResolvedValueOnce({ results: [{ hits: [] }, { hits: [] }] })

      const provider = useAlgoliaSearchProvider()
      await provider.searchPacks('kijai/comfyui-KJNodes', {
        pageSize: 10,
        pageNumber: 0
      })

      expect(packQueriesPerRequest()).toEqual([
        ['kijai/comfyui-KJNodes'],
        ['comfyui-KJNodes', 'comfyui KJNodes']
      ])
    })

    it('should cap fallback hits so the merged result never exceeds a page', async () => {
      mockSearchClient.search
        .mockResolvedValueOnce({
          results: [{ hits: [packHit('raw-0')] }, { hits: [] }]
        })
        .mockResolvedValueOnce({
          results: [
            { hits: Array.from({ length: 5 }, (_, i) => packHit(`fb-${i}`)) }
          ]
        })

      const provider = useAlgoliaSearchProvider()
      const result = await provider.searchPacks('euler-discrete-scheduler', {
        pageSize: 3,
        pageNumber: 0
      })

      expect(result.nodePacks.map((pack) => pack.id)).toEqual([
        'raw-0',
        'fb-0',
        'fb-1'
      ])
    })

    it('should merge hits from every fallback query in order, deduped', async () => {
      mockSearchClient.search
        .mockResolvedValueOnce({
          results: [
            { hits: [packHit('primary')] },
            { hits: [{ query: 'comfyui kjnodes', popularity: 7 }] }
          ]
        })
        .mockResolvedValueOnce({
          results: [
            { hits: [packHit('primary'), packHit('owner-stripped')] },
            { hits: [packHit('owner-stripped'), packHit('separator-split')] }
          ]
        })

      const provider = useAlgoliaSearchProvider()
      const result = await provider.searchPacks('kijai/comfyui-KJNodes', {
        pageSize: 10,
        pageNumber: 0
      })

      expect(result.nodePacks.map((pack) => pack.id)).toEqual([
        'primary',
        'owner-stripped',
        'separator-split'
      ])
      expect(result.querySuggestions).toEqual([
        { query: 'comfyui kjnodes', popularity: 7 }
      ])
    })

    it.for([
      { pageNumber: 0, nbPages: 3, expected: true },
      { pageNumber: 2, nbPages: 3, expected: false },
      { pageNumber: 0, nbPages: undefined, expected: false }
    ])(
      'reports hasMore $expected on page $pageNumber of $nbPages',
      async ({ pageNumber, nbPages, expected }) => {
        mockSearchClient.search.mockResolvedValueOnce({
          results: [
            {
              hits: Array.from({ length: 10 }, (_, i) => packHit(`${i}`)),
              nbPages
            },
            { hits: [] }
          ]
        })

        const provider = useAlgoliaSearchProvider()
        const result = await provider.searchPacks('test', {
          pageSize: 10,
          pageNumber
        })

        expect(result.hasMore).toBe(expected)
      }
    )

    it('sends no fallback queries when searching node names', async () => {
      mockSearchClient.search.mockResolvedValueOnce({
        results: [{ hits: [] }, { hits: [] }]
      })

      const provider = useAlgoliaSearchProvider()
      await provider.searchPacks('VHS_VideoCombine', {
        pageSize: 10,
        pageNumber: 0,
        restrictSearchableAttributes: ['comfy_nodes']
      })

      expect(packQueriesPerRequest()).toEqual([['VHS_VideoCombine']])
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
