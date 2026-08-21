import type { Mock } from 'vitest'
import { liteClient as algoliasearch } from 'algoliasearch/dist/lite/builds/browser'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import type { components } from '@/types/comfyRegistryTypes'
import { useAlgoliaSearchProvider } from '@/services/providers/algoliaSearchProvider'
import { SortableAlgoliaField } from '@/workbench/extensions/manager/types/comfyManagerTypes'

type RegistryNodePack = components['schemas']['Node']

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

    it('should fire a tokenized fallback query for a compound name that yields zero primary hits', async () => {
      const mockAlgoliaResults = {
        results: [
          { hits: [] }, // Primary query: raw compound query, no hits
          {
            hits: [
              {
                objectID: 'algolia-1',
                id: 'euler-discrete-scheduler',
                name: 'ComfyUI-EulerFlowMatchingDiscreteScheduler',
                description: 'A scheduler pack',
                publisher_id: 'publisher-1',
                total_install: 10,
                comfy_nodes: []
              }
            ]
          }, // Tokenized fallback query
          { hits: [] } // Query suggestions
        ]
      }

      mockSearchClient.search.mockResolvedValue(mockAlgoliaResults)

      const provider = useAlgoliaSearchProvider()
      const result = await provider.searchPacks('EulerDiscreteScheduler', {
        pageSize: 10,
        pageNumber: 0
      })

      expect(mockSearchClient.search).toHaveBeenCalledWith({
        requests: [
          expect.objectContaining({
            query: 'EulerDiscreteScheduler',
            indexName: 'nodes_index'
          }),
          expect.objectContaining({
            query: 'Euler Discrete Scheduler',
            indexName: 'nodes_index'
          }),
          expect.objectContaining({
            indexName: 'nodes_index_query_suggestions'
          })
        ],
        strategy: 'none'
      })

      expect(result.nodePacks).toHaveLength(1)
      expect(result.nodePacks[0].id).toBe('euler-discrete-scheduler')
    })

    it('should not fire a tokenized fallback query when tokenization does not change the query', async () => {
      mockSearchClient.search.mockResolvedValue({
        results: [{ hits: [] }, { hits: [] }]
      })

      const provider = useAlgoliaSearchProvider()
      await provider.searchPacks('flux upscale', {
        pageSize: 10,
        pageNumber: 0
      })

      // Only the primary query and suggestions query -- no fallback
      expect(mockSearchClient.search).toHaveBeenCalledWith({
        requests: [
          expect.objectContaining({ indexName: 'nodes_index' }),
          expect.objectContaining({
            indexName: 'nodes_index_query_suggestions'
          })
        ],
        strategy: 'none'
      })
    })

    it('should dedupe a hit returned by both the primary and tokenized fallback query', async () => {
      const sharedHit = {
        objectID: 'algolia-1',
        id: 'shared-pack',
        name: 'ComfyUI-EulerDiscreteScheduler',
        description: 'A scheduler pack',
        publisher_id: 'publisher-1',
        total_install: 10,
        comfy_nodes: []
      }
      const fallbackOnlyHit = {
        objectID: 'algolia-2',
        id: 'fallback-only-pack',
        name: 'Another Euler Pack',
        description: 'Also a scheduler pack',
        publisher_id: 'publisher-1',
        total_install: 5,
        comfy_nodes: []
      }

      mockSearchClient.search.mockResolvedValue({
        results: [
          { hits: [sharedHit] }, // Primary query already found it
          { hits: [sharedHit, fallbackOnlyHit] }, // Fallback query re-finds it plus one new hit
          { hits: [] }
        ]
      })

      const provider = useAlgoliaSearchProvider()
      const result = await provider.searchPacks('EulerDiscreteScheduler', {
        pageSize: 10,
        pageNumber: 0
      })

      expect(result.nodePacks).toHaveLength(2)
      expect(result.nodePacks.map((pack) => pack.id)).toEqual([
        'shared-pack',
        'fallback-only-pack'
      ])
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

    it('should fall back to objectID when id field is missing from a hit', async () => {
      const mockAlgoliaResults = {
        results: [
          {
            hits: [
              {
                objectID: 'objectID-only',
                name: 'Pack without id',
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

      expect(result.nodePacks[0].id).toBe('objectID-only')
    })

    it('should not fire a tokenized fallback query for an empty query', async () => {
      mockSearchClient.search.mockResolvedValue({
        results: [{ hits: [] }]
      })

      const provider = useAlgoliaSearchProvider()
      await provider.searchPacks('', {
        pageSize: 10,
        pageNumber: 0
      })

      expect(mockSearchClient.search).toHaveBeenCalledWith({
        requests: [expect.objectContaining({ indexName: 'nodes_index' })],
        strategy: 'none'
      })
    })

    it('should not fire a tokenized fallback query for a whitespace-only query', async () => {
      mockSearchClient.search.mockResolvedValue({
        results: [{ hits: [] }, { hits: [] }]
      })

      const provider = useAlgoliaSearchProvider()
      await provider.searchPacks('   ', {
        pageSize: 10,
        pageNumber: 0
      })

      // Only the primary query and suggestions query -- tokenizing
      // whitespace-only input yields '', so no fallback is fired
      expect(mockSearchClient.search).toHaveBeenCalledWith({
        requests: [
          expect.objectContaining({ indexName: 'nodes_index' }),
          expect.objectContaining({
            indexName: 'nodes_index_query_suggestions'
          })
        ],
        strategy: 'none'
      })
    })

    it('should propagate an Algolia API error raised while the tokenized fallback query is in flight', async () => {
      const algoliaError = new Error('Algolia request failed')
      mockSearchClient.search.mockRejectedValue(algoliaError)

      const provider = useAlgoliaSearchProvider()

      await expect(
        provider.searchPacks('EulerDiscreteScheduler', {
          pageSize: 10,
          pageNumber: 0
        })
      ).rejects.toThrow('Algolia request failed')
    })

    it('should add no fallback hits when the primary query already fills the page', async () => {
      const primaryHits = Array.from({ length: 10 }, (_, i) => ({
        objectID: `primary-${i}`,
        id: `primary-${i}`,
        name: `Primary Pack ${i}`,
        publisher_id: 'pub',
        total_install: 0,
        comfy_nodes: []
      }))
      const fallbackOnlyHit = {
        objectID: 'fallback-only',
        id: 'fallback-only',
        name: 'Fallback Only Pack',
        publisher_id: 'pub',
        total_install: 0,
        comfy_nodes: []
      }

      mockSearchClient.search.mockResolvedValue({
        results: [
          { hits: primaryHits },
          { hits: [fallbackOnlyHit] },
          { hits: [] }
        ]
      })

      const provider = useAlgoliaSearchProvider()
      const result = await provider.searchPacks('EulerDiscreteScheduler', {
        pageSize: 10,
        pageNumber: 0
      })

      expect(result.nodePacks).toHaveLength(10)
      expect(result.nodePacks.map((pack) => pack.id)).not.toContain(
        'fallback-only'
      )
    })

    it('should cap fallback hits so the merged result never exceeds a page', async () => {
      const primaryHits = [
        {
          objectID: 'primary-0',
          id: 'primary-0',
          name: 'Primary Pack',
          publisher_id: 'pub',
          total_install: 0,
          comfy_nodes: []
        }
      ]
      const fallbackHits = Array.from({ length: 5 }, (_, i) => ({
        objectID: `fallback-${i}`,
        id: `fallback-${i}`,
        name: `Fallback Pack ${i}`,
        publisher_id: 'pub',
        total_install: 0,
        comfy_nodes: []
      }))

      mockSearchClient.search.mockResolvedValue({
        results: [{ hits: primaryHits }, { hits: fallbackHits }, { hits: [] }]
      })

      const provider = useAlgoliaSearchProvider()
      const result = await provider.searchPacks('EulerDiscreteScheduler', {
        pageSize: 3,
        pageNumber: 0
      })

      // 1 primary hit + at most 2 fallback hits to stay within pageSize 3
      expect(result.nodePacks).toHaveLength(3)
      expect(result.nodePacks.map((pack) => pack.id)).toEqual([
        'primary-0',
        'fallback-0',
        'fallback-1'
      ])
    })

    it('should fire owner-stripped and tokenized fallback queries for a pasted repo slug', async () => {
      mockSearchClient.search.mockResolvedValue({
        results: [{ hits: [] }, { hits: [] }, { hits: [] }, { hits: [] }]
      })

      const provider = useAlgoliaSearchProvider()
      await provider.searchPacks('kijai/comfyui-KJNodes', {
        pageSize: 10,
        pageNumber: 0
      })

      expect(mockSearchClient.search).toHaveBeenCalledWith({
        requests: [
          expect.objectContaining({
            query: 'kijai/comfyui-KJNodes',
            indexName: 'nodes_index'
          }),
          expect.objectContaining({
            query: 'comfyui-KJNodes',
            indexName: 'nodes_index'
          }),
          expect.objectContaining({
            query: 'comfyui KJ Nodes',
            indexName: 'nodes_index'
          }),
          expect.objectContaining({
            indexName: 'nodes_index_query_suggestions'
          })
        ],
        strategy: 'none'
      })
    })

    it('should merge hits from every fallback query in order, deduped', async () => {
      const hit = (id: string) => ({
        objectID: id,
        id,
        name: id,
        publisher_id: 'pub',
        total_install: 0,
        comfy_nodes: []
      })

      mockSearchClient.search.mockResolvedValue({
        results: [
          { hits: [hit('primary')] },
          { hits: [hit('primary'), hit('owner-stripped')] },
          { hits: [hit('owner-stripped'), hit('tokenized')] },
          { hits: [] }
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
        'tokenized'
      ])
    })

    // Pages are concatenated into one list by useRegistrySearch, so re-running
    // the fallback per page would re-append hits already shown on page 0.
    it('should not fire fallback queries beyond the first page', async () => {
      mockSearchClient.search.mockResolvedValue({
        results: [{ hits: [] }, { hits: [] }]
      })

      const provider = useAlgoliaSearchProvider()
      await provider.searchPacks('kijai/comfyui-KJNodes', {
        pageSize: 10,
        pageNumber: 1
      })

      expect(mockSearchClient.search).toHaveBeenCalledWith({
        requests: [
          expect.objectContaining({
            query: 'kijai/comfyui-KJNodes',
            indexName: 'nodes_index'
          }),
          expect.objectContaining({
            indexName: 'nodes_index_query_suggestions'
          })
        ],
        strategy: 'none'
      })
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

  describe('getSortValue', () => {
    const testPack: Partial<RegistryNodePack> = {
      id: '1',
      name: 'Test Pack',
      downloads: 100,
      publisher: { id: 'pub1', name: 'Publisher One' },
      latest_version: {
        version: '1.0.0',
        createdAt: '2024-01-15T10:00:00Z'
      },
      created_at: '2024-01-01T10:00:00Z'
    }

    it('should return correct values for each sort field', () => {
      const provider = useAlgoliaSearchProvider()

      expect(
        provider.getSortValue(testPack, SortableAlgoliaField.Downloads)
      ).toBe(100)
      expect(provider.getSortValue(testPack, SortableAlgoliaField.Name)).toBe(
        'Test Pack'
      )
      expect(
        provider.getSortValue(testPack, SortableAlgoliaField.Publisher)
      ).toBe('Publisher One')

      const createdTimestamp = new Date('2024-01-01T10:00:00Z').getTime()
      expect(
        provider.getSortValue(
          testPack as RegistryNodePack,
          SortableAlgoliaField.Created
        )
      ).toBe(createdTimestamp)

      const updatedTimestamp = new Date('2024-01-15T10:00:00Z').getTime()
      expect(
        provider.getSortValue(testPack, SortableAlgoliaField.Updated)
      ).toBe(updatedTimestamp)
    })

    it('should handle missing values', () => {
      const incompletePack: Partial<RegistryNodePack> = {
        id: '1',
        name: 'Incomplete'
      }
      const provider = useAlgoliaSearchProvider()

      expect(
        provider.getSortValue(
          incompletePack as RegistryNodePack,
          SortableAlgoliaField.Downloads
        )
      ).toBe(0)
      expect(
        provider.getSortValue(
          incompletePack as RegistryNodePack,
          SortableAlgoliaField.Publisher
        )
      ).toBe('')
      expect(
        provider.getSortValue(
          incompletePack as RegistryNodePack,
          SortableAlgoliaField.Created
        )
      ).toBe(0)
      expect(
        provider.getSortValue(
          incompletePack as RegistryNodePack,
          SortableAlgoliaField.Updated
        )
      ).toBe(0)
    })

    it('should default a missing name to an empty string', () => {
      const nameless: Partial<RegistryNodePack> = { id: '1' }
      const provider = useAlgoliaSearchProvider()

      expect(
        provider.getSortValue(
          nameless as RegistryNodePack,
          SortableAlgoliaField.Name
        )
      ).toBe('')
    })

    it('should return 0 for an unrecognized sort field', () => {
      const provider = useAlgoliaSearchProvider()

      expect(
        provider.getSortValue(testPack as RegistryNodePack, 'not_a_real_field')
      ).toBe(0)
    })
  })

  describe('getSortableFields', () => {
    it('should return all Algolia sort fields', () => {
      const provider = useAlgoliaSearchProvider()
      const fields = provider.getSortableFields()

      expect(fields).toEqual([
        {
          id: SortableAlgoliaField.Downloads,
          label: 'Downloads',
          direction: 'desc'
        },
        {
          id: SortableAlgoliaField.Created,
          label: 'Created',
          direction: 'desc'
        },
        {
          id: SortableAlgoliaField.Updated,
          label: 'Updated',
          direction: 'desc'
        },
        {
          id: SortableAlgoliaField.Publisher,
          label: 'Publisher',
          direction: 'asc'
        },
        { id: SortableAlgoliaField.Name, label: 'Name', direction: 'asc' }
      ])
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
