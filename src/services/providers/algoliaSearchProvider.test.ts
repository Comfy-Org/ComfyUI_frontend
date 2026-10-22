import type { Mock } from 'vitest'
import { liteClient as algoliasearch } from 'algoliasearch/dist/lite/builds/browser'
import { afterEach, assert, beforeEach, describe, expect, it, vi } from 'vitest'

import { reportError } from '@/platform/telemetry/reportError'
import { useRegistrySearchGateway } from '@/services/gateway/registrySearchGateway'
import { useAlgoliaSearchProvider } from '@/services/providers/algoliaSearchProvider'
import { useComfyRegistrySearchProvider } from '@/services/providers/registrySearchProvider'
import type {
  SearchPacksOutcome,
  SearchPacksResult
} from '@/types/searchServiceTypes'

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

vi.mock(import('@/services/providers/registrySearchProvider'))

async function searchResult(
  search: Promise<SearchPacksOutcome>
): Promise<SearchPacksResult> {
  const outcome = await search
  assert(outcome.ok, 'expected the search to succeed')
  return outcome.result
}

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

  const packTagsPerRequest = () =>
    mockSearchClient.search.mock.calls.map(([{ requests }]) =>
      requests
        .filter((r: { indexName: string }) => r.indexName === 'nodes_index')
        .map((r: { analyticsTags?: string[] }) => r.analyticsTags)
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
      const result = await searchResult(
        provider.searchPacks('test', {
          pageSize: 10,
          pageNumber: 0
        })
      )

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
      const result = await searchResult(
        provider.searchPacks('test', {
          pageSize: 10,
          pageNumber: 0
        })
      )

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

    it('serves a search with analytics tags from the cache of the same untagged search', async () => {
      mockSearchClient.search.mockResolvedValue({
        results: [{ hits: [packHit('pack-1')] }, { hits: [] }]
      })

      const provider = useAlgoliaSearchProvider()
      const params = { pageSize: 10, pageNumber: 0 }
      await provider.searchPacks('test', params)
      await provider.searchPacks('test', { ...params, analyticsTags: ['user'] })

      expect(mockSearchClient.search).toHaveBeenCalledTimes(1)
    })

    it.for(['id', 'objectID'])(
      'should take the pack id from a hit that has only %s',
      async (idField) => {
        mockSearchClient.search.mockResolvedValue({
          results: [
            {
              hits: [
                {
                  [idField]: `only-${idField}`,
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
        const result = await searchResult(
          provider.searchPacks('test', {
            pageSize: 10,
            pageNumber: 0
          })
        )

        expect(result.nodePacks[0].id).toBe(`only-${idField}`)
      }
    )

    it('fails the search when the Algolia request fails so the gateway can fail over', async () => {
      const algoliaError = new Error('Algolia request failed')
      mockSearchClient.search.mockRejectedValue(algoliaError)

      const provider = useAlgoliaSearchProvider()

      await expect(
        provider.searchPacks('euler-discrete-scheduler', {
          pageSize: 10,
          pageNumber: 0
        })
      ).resolves.toEqual({ ok: false, cause: algoliaError })
    })

    it.for([
      { name: 'no results', response: { results: [] }, path: 'at index 0' },
      {
        name: 'pack hits that are not a list',
        response: { results: [{ hits: null }] },
        path: 'at "[0].hits"'
      },
      {
        name: 'a pack hit without an id',
        response: { results: [{ hits: [{ name: 'Pack' }] }] },
        path: 'at "[0].hits[0]"'
      },
      {
        name: 'a page count that is not a number',
        response: { results: [{ hits: [], nbPages: '2' }] },
        path: 'at "[0].nbPages"'
      },
      {
        name: 'a suggestion without a query',
        response: { results: [{ hits: [] }, { hits: [{ popularity: 1 }] }] },
        path: 'at "[1].hits[0].query"'
      }
    ])(
      'fails the search when the response has $name',
      async ({ response, path }) => {
        mockSearchClient.search.mockResolvedValue(response)

        const provider = useAlgoliaSearchProvider()
        const outcome = await provider.searchPacks('euler-discrete-scheduler', {
          pageSize: 10,
          pageNumber: 0
        })

        assert(!outcome.ok, 'expected the search to fail')
        expect(outcome.cause).toBeInstanceOf(Error)
        expect(String(outcome.cause)).toContain(
          'Malformed Algolia search response'
        )
        expect(String(outcome.cause)).toContain(path)
      }
    )

    it('degrades to the raw results when the rewrite response is malformed', async () => {
      mockSearchClient.search
        .mockResolvedValueOnce({ results: [{ hits: [], nbPages: 0 }] })
        .mockResolvedValueOnce({ results: [{ hits: [{ name: 'Pack' }] }] })

      const provider = useAlgoliaSearchProvider()
      const result = await searchResult(
        provider.searchPacks('euler-discrete-scheduler', {
          pageSize: 10,
          pageNumber: 0
        })
      )

      expect(result.nodePacks).toEqual([])
      expect(reportError).toHaveBeenCalledExactlyOnceWith(
        expect.objectContaining({
          message: expect.stringContaining('Malformed Algolia search response')
        }),
        expect.objectContaining({
          errorType: 'error_searching_algolia_fallbacks',
          tags: { outcome: 'degraded' }
        })
      )
    })

    it('preserves raw results and suggestions when the rewrite request fails', async () => {
      const fallbackError = new Error('Algolia rewrite request failed')
      mockSearchClient.search
        .mockResolvedValueOnce({
          results: [
            { hits: [], nbPages: 0 },
            { hits: [{ query: 'euler discrete scheduler', popularity: 7 }] }
          ]
        })
        .mockRejectedValueOnce(fallbackError)

      const provider = useAlgoliaSearchProvider()
      const result = await searchResult(
        provider.searchPacks('euler-discrete-scheduler', {
          pageSize: 10,
          pageNumber: 0
        })
      )

      expect(result.nodePacks).toEqual([])
      expect(result.querySuggestions).toEqual([
        { query: 'euler discrete scheduler', popularity: 7 }
      ])
      expect(result.rawResultsEmpty).toBe(true)
      expect(result.hasMore).toBe(false)
      expect(reportError).toHaveBeenCalledExactlyOnceWith(fallbackError, {
        errorType: 'error_searching_algolia_fallbacks',
        surface: 'platform',
        level: 'warning',
        tags: { outcome: 'degraded' }
      })
    })

    it('retries the search after a failed rewrite request instead of serving it from cache', async () => {
      mockSearchClient.search
        .mockResolvedValueOnce({ results: [{ hits: [], nbPages: 0 }] })
        .mockRejectedValueOnce(new Error('Algolia rewrite request failed'))
        .mockResolvedValueOnce({ results: [{ hits: [], nbPages: 0 }] })
        .mockResolvedValueOnce({
          results: [{ hits: [packHit('comfyui-kjnodes')] }, { hits: [] }]
        })

      const provider = useAlgoliaSearchProvider()
      const params = { pageSize: 10, pageNumber: 0 }
      const degraded = await searchResult(
        provider.searchPacks('kijai/comfyui-kjnodes', params)
      )
      const retried = await searchResult(
        provider.searchPacks('kijai/comfyui-kjnodes', params)
      )

      expect(degraded.nodePacks).toEqual([])
      expect(retried.nodePacks.map((pack) => pack.id)).toEqual([
        'comfyui-kjnodes'
      ])
      expect(mockSearchClient.search).toHaveBeenCalledTimes(4)
    })

    it('sends no fallback queries when the raw query fills the page', async () => {
      mockSearchClient.search.mockResolvedValueOnce({
        results: [
          { hits: Array.from({ length: 10 }, (_, i) => packHit(`raw-${i}`)) },
          { hits: [] }
        ]
      })

      const provider = useAlgoliaSearchProvider()
      const result = await searchResult(
        provider.searchPacks('euler-discrete-scheduler', {
          pageSize: 10,
          pageNumber: 0
        })
      )

      expect(packQueriesPerRequest()).toEqual([['euler-discrete-scheduler']])
      expect(result.nodePacks).toHaveLength(10)
    })

    it('sends no fallback queries when the raw query has some hits', async () => {
      mockSearchClient.search.mockResolvedValueOnce({
        results: [{ hits: [packHit('raw-0')] }, { hits: [] }]
      })

      const provider = useAlgoliaSearchProvider()
      const result = await searchResult(
        provider.searchPacks('comfyui-kjnodes', {
          pageSize: 10,
          pageNumber: 0
        })
      )

      expect(packQueriesPerRequest()).toEqual([['comfyui-kjnodes']])
      expect(result.nodePacks.map((pack) => pack.id)).toEqual(['raw-0'])
    })

    it('sends the fallback queries in a second batch when the raw query has no hits', async () => {
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

    it('leaves an untagged query untagged and tags its rewrites as rewrite', async () => {
      mockSearchClient.search
        .mockResolvedValueOnce({ results: [{ hits: [] }, { hits: [] }] })
        .mockResolvedValueOnce({ results: [{ hits: [] }, { hits: [] }] })

      const provider = useAlgoliaSearchProvider()
      await provider.searchPacks('kijai/comfyui-KJNodes', {
        pageSize: 10,
        pageNumber: 0
      })

      expect(packTagsPerRequest()).toEqual([
        [undefined],
        [['rewrite'], ['rewrite']]
      ])
    })

    it("sends the caller's analytics tags on the query and tags its rewrites rewrite instead of user", async () => {
      mockSearchClient.search
        .mockResolvedValueOnce({ results: [{ hits: [] }, { hits: [] }] })
        .mockResolvedValueOnce({ results: [{ hits: [] }, { hits: [] }] })

      const provider = useAlgoliaSearchProvider()
      await provider.searchPacks('kijai/comfyui-KJNodes', {
        pageSize: 10,
        pageNumber: 0,
        analyticsTags: ['user', 'dialog']
      })

      const [[rawBatch]] = mockSearchClient.search.mock.calls
      expect(rawBatch.requests[1]).not.toHaveProperty('analyticsTags')
      expect(packTagsPerRequest()).toEqual([
        [['user', 'dialog']],
        [
          ['dialog', 'rewrite'],
          ['dialog', 'rewrite']
        ]
      ])
    })

    it('should cap fallback hits so the merged result never exceeds a page', async () => {
      mockSearchClient.search
        .mockResolvedValueOnce({ results: [{ hits: [] }, { hits: [] }] })
        .mockResolvedValueOnce({
          results: [
            { hits: Array.from({ length: 5 }, (_, i) => packHit(`fb-${i}`)) }
          ]
        })

      const provider = useAlgoliaSearchProvider()
      const result = await searchResult(
        provider.searchPacks('euler-discrete-scheduler', {
          pageSize: 3,
          pageNumber: 0
        })
      )

      expect(result.nodePacks.map((pack) => pack.id)).toEqual([
        'fb-0',
        'fb-1',
        'fb-2'
      ])
    })

    it('should merge hits from every fallback query in order, deduped', async () => {
      mockSearchClient.search
        .mockResolvedValueOnce({
          results: [
            { hits: [] },
            { hits: [{ query: 'comfyui kjnodes', popularity: 7 }] }
          ]
        })
        .mockResolvedValueOnce({
          results: [
            { hits: [packHit('owner-stripped'), packHit('shared')] },
            { hits: [packHit('shared'), packHit('separator-split')] }
          ]
        })

      const provider = useAlgoliaSearchProvider()
      const result = await searchResult(
        provider.searchPacks('kijai/comfyui-KJNodes', {
          pageSize: 10,
          pageNumber: 0
        })
      )

      expect(result.nodePacks.map((pack) => pack.id)).toEqual([
        'owner-stripped',
        'shared',
        'separator-split'
      ])
      expect(result.querySuggestions).toEqual([
        { query: 'comfyui kjnodes', popularity: 7 }
      ])
    })

    it.for([
      { pageNumber: 0, nbPages: 3, expected: true },
      { pageNumber: 2, nbPages: 3, expected: false },
      { pageNumber: 0, nbPages: undefined, expected: undefined }
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
        const result = await searchResult(
          provider.searchPacks('test', {
            pageSize: 10,
            pageNumber
          })
        )

        expect(result.hasMore).toBe(expected)
      }
    )

    it('does not make the gateway fail over when only the rewrite request fails', async () => {
      const registrySearchPacks = vi.fn()
      vi.mocked(useComfyRegistrySearchProvider).mockReturnValue({
        searchPacks: registrySearchPacks,
        clearSearchCache: vi.fn()
      })
      mockSearchClient.search
        .mockResolvedValueOnce({ results: [{ hits: [] }, { hits: [] }] })
        .mockRejectedValueOnce(new Error('Algolia rewrite request failed'))

      const gateway = useRegistrySearchGateway()
      const result = await searchResult(
        gateway.searchPacks('kijai/comfyui-KJNodes', {
          pageSize: 10,
          pageNumber: 0
        })
      )

      expect(packQueriesPerRequest()).toEqual([
        ['kijai/comfyui-KJNodes'],
        ['comfyui-KJNodes', 'comfyui KJNodes']
      ])
      expect(result.rawResultsEmpty).toBe(true)
      expect(registrySearchPacks).not.toHaveBeenCalled()
    })

    it('fails over to the registry when the Algolia response is malformed', async () => {
      const registryResult: SearchPacksResult = {
        nodePacks: [{ id: 'registry-pack', name: 'Registry Pack' }],
        querySuggestions: []
      }
      const registrySearchPacks = vi
        .fn()
        .mockResolvedValue({ ok: true, result: registryResult })
      vi.mocked(useComfyRegistrySearchProvider).mockReturnValue({
        searchPacks: registrySearchPacks,
        clearSearchCache: vi.fn()
      })
      mockSearchClient.search.mockResolvedValue({ results: [] })

      const gateway = useRegistrySearchGateway()
      const result = await searchResult(
        gateway.searchPacks('euler-discrete-scheduler', {
          pageSize: 10,
          pageNumber: 0
        })
      )

      expect(result).toBe(registryResult)
      expect(registrySearchPacks).toHaveBeenCalledOnce()
    })

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
      const result = await searchResult(
        provider.searchPacks('test', {
          pageSize: 10,
          pageNumber: 0
        })
      )

      // All 3 results should be the same object reference due to memoization
      expect(result.nodePacks[0]).toBe(result.nodePacks[1])
      expect(result.nodePacks[1]).toBe(result.nodePacks[2])
    })

    it('keys conversions of hits without an id by objectID', async () => {
      const hitWithoutId = (objectID: string) => ({
        objectID,
        name: objectID,
        publisher_id: 'pub',
        total_install: 0,
        comfy_nodes: []
      })
      mockSearchClient.search.mockResolvedValue({
        results: [
          { hits: [hitWithoutId('no-id-a'), hitWithoutId('no-id-b')] },
          { hits: [] }
        ]
      })

      const provider = useAlgoliaSearchProvider()
      const result = await searchResult(
        provider.searchPacks('test', {
          pageSize: 10,
          pageNumber: 0
        })
      )

      expect(result.nodePacks.map((pack) => pack.name)).toEqual([
        'no-id-a',
        'no-id-b'
      ])
    })
  })
})
