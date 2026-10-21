import type { AxiosAdapter } from 'axios'
import { assert, beforeEach, describe, expect, it, vi } from 'vitest'
import type { MockInstance } from 'vitest'

import { useComfyRegistrySearchProvider } from '@/services/providers/registrySearchProvider'
import { useComfyRegistryStore } from '@/stores/comfyRegistryStore'
import type { SearchPacksResult } from '@/types/searchServiceTypes'

const registryAdapter = await vi.hoisted(async () => {
  const { default: axios } = await import('axios')
  const adapter = vi.fn<AxiosAdapter>()
  axios.defaults.adapter = adapter
  return adapter
})

const respondWith = (data: unknown) =>
  registryAdapter.mockImplementation(async (config) => ({
    data,
    status: 200,
    statusText: 'OK',
    headers: {},
    config
  }))

const succeeded = (nodePacks: SearchPacksResult['nodePacks']) => ({
  ok: true,
  result: { nodePacks, querySuggestions: [] }
})

const failedWith = (message: string) => ({
  ok: false,
  cause: new Error(message)
})

describe('useComfyRegistrySearchProvider', () => {
  let mockSearchCall: MockInstance<
    ReturnType<typeof useComfyRegistryStore>['search']['call']
  >
  let mockSearchClear: MockInstance<
    ReturnType<typeof useComfyRegistryStore>['search']['clear']
  >
  let mockListAllPacksCall: MockInstance<
    ReturnType<typeof useComfyRegistryStore>['listAllPacks']['call']
  >
  let mockListAllPacksClear: MockInstance<
    ReturnType<typeof useComfyRegistryStore>['listAllPacks']['clear']
  >

  beforeEach(() => {
    const store = useComfyRegistryStore()
    mockSearchCall = vi.spyOn(store.search, 'call').mockResolvedValue(null)
    mockSearchClear = vi.spyOn(store.search, 'clear')
    mockListAllPacksCall = vi
      .spyOn(store.listAllPacks, 'call')
      .mockResolvedValue(null)
    mockListAllPacksClear = vi.spyOn(store.listAllPacks, 'clear')
  })

  describe('searchPacks', () => {
    it('should search for packs by name', async () => {
      const mockResults = {
        nodes: [
          { id: '1', name: 'Test Pack 1' },
          { id: '2', name: 'Test Pack 2' }
        ]
      }
      mockSearchCall.mockResolvedValue(mockResults)

      const provider = useComfyRegistrySearchProvider()
      const outcome = await provider.searchPacks('test', {
        pageSize: 10,
        pageNumber: 0,
        restrictSearchableAttributes: ['name', 'description']
      })

      expect(mockSearchCall).toHaveBeenCalledWith({
        search: 'test',
        comfy_node_search: undefined,
        limit: 10,
        page: 1
      })
      expect(outcome).toEqual(succeeded(mockResults.nodes))
    })

    it('should search for packs by node names', async () => {
      const mockResults = {
        nodes: [{ id: '1', name: 'Pack with LoadImage node' }]
      }
      mockSearchCall.mockResolvedValue(mockResults)

      const provider = useComfyRegistrySearchProvider()
      const outcome = await provider.searchPacks('LoadImage', {
        pageSize: 20,
        pageNumber: 1,
        restrictSearchableAttributes: ['comfy_nodes']
      })

      expect(mockSearchCall).toHaveBeenCalledWith({
        search: undefined,
        comfy_node_search: 'LoadImage',
        limit: 20,
        page: 2
      })
      expect(outcome).toEqual(succeeded(mockResults.nodes))
    })

    it('should handle empty results', async () => {
      mockSearchCall.mockResolvedValue({ nodes: [] })

      const provider = useComfyRegistrySearchProvider()
      const outcome = await provider.searchPacks('nonexistent', {
        pageSize: 10,
        pageNumber: 0
      })

      expect(outcome).toEqual(succeeded([]))
    })

    it.for([
      { name: 'no nodes', response: {}, path: 'at "nodes"' },
      {
        name: 'nodes that are not a list',
        response: { nodes: {} },
        path: 'at "nodes"'
      },
      {
        name: 'a node that is not an object',
        response: { nodes: [{ id: '1' }, null] },
        path: 'at "nodes[1]"'
      }
    ])(
      'fails and evicts the page when the response has $name',
      async ({ response, path }) => {
        const store = useComfyRegistryStore()
        const evict = vi.spyOn(store.search, 'evict')
        mockSearchCall.mockRestore()
        respondWith(response)
        const provider = useComfyRegistrySearchProvider()

        const outcome = await provider.searchPacks('test', {
          pageSize: 10,
          pageNumber: 0
        })

        assert(!outcome.ok, 'expected the search to fail')
        expect(outcome.cause).toBeInstanceOf(Error)
        expect(String(outcome.cause)).toContain(
          'Malformed registry search response'
        )
        expect(String(outcome.cause)).toContain(path)
        expect(evict).toHaveBeenCalledExactlyOnceWith(
          expect.objectContaining({ limit: 10, page: 1 })
        )
      }
    )

    it('fails and evicts the listAllPacks page on a malformed response', async () => {
      const store = useComfyRegistryStore()
      const evict = vi.spyOn(store.listAllPacks, 'evict')
      mockListAllPacksCall.mockRestore()
      respondWith({ nodes: {} })
      const provider = useComfyRegistrySearchProvider()

      const outcome = await provider.searchPacks('', {
        pageSize: 10,
        pageNumber: 0
      })

      assert(!outcome.ok, 'expected the search to fail')
      expect(String(outcome.cause)).toContain(
        'Malformed registry search response'
      )
      expect(String(outcome.cause)).toContain('at "nodes"')
      expect(evict).toHaveBeenCalledExactlyOnceWith({ limit: 10, page: 1 })
    })

    it('should use listAllPacks for empty query', async () => {
      const mockResults = {
        nodes: [
          { id: '1', name: 'Pack 1' },
          { id: '2', name: 'Pack 2' }
        ]
      }
      mockListAllPacksCall.mockResolvedValue(mockResults)

      const provider = useComfyRegistrySearchProvider()
      const outcome = await provider.searchPacks('', {
        pageSize: 20,
        pageNumber: 0
      })

      expect(mockListAllPacksCall).toHaveBeenCalledWith({
        limit: 20,
        page: 1
      })
      expect(mockSearchCall).not.toHaveBeenCalled()
      expect(outcome).toEqual(succeeded(mockResults.nodes))
    })

    it('should use listAllPacks for whitespace-only query', async () => {
      const mockResults = {
        nodes: [{ id: '1', name: 'Pack 1' }]
      }
      mockListAllPacksCall.mockResolvedValue(mockResults)

      const provider = useComfyRegistrySearchProvider()
      const outcome = await provider.searchPacks('   ', {
        pageSize: 10,
        pageNumber: 0
      })

      expect(mockListAllPacksCall).toHaveBeenCalledWith({
        limit: 10,
        page: 1
      })
      expect(mockSearchCall).not.toHaveBeenCalled()
      expect(outcome).toEqual(succeeded(mockResults.nodes))
    })

    it('should handle empty results from listAllPacks', async () => {
      mockListAllPacksCall.mockResolvedValue({ nodes: [] })

      const provider = useComfyRegistrySearchProvider()
      const outcome = await provider.searchPacks('', {
        pageSize: 10,
        pageNumber: 0
      })

      expect(outcome).toEqual(succeeded([]))
    })

    it.for([
      { request: 'search', query: 'test' },
      { request: 'listAllPacks', query: '' }
    ] as const)(
      'fails and evicts only the failed $request page from the cache',
      async ({ request, query }) => {
        const store = useComfyRegistryStore()
        const evict = vi.spyOn(store[request], 'evict')
        const provider = useComfyRegistrySearchProvider()

        await expect(
          provider.searchPacks(query, { pageSize: 10, pageNumber: 0 })
        ).resolves.toEqual(failedWith('Comfy Registry request failed'))

        expect(evict).toHaveBeenCalledExactlyOnceWith(
          expect.objectContaining({ limit: 10, page: 1 })
        )
        expect(mockSearchClear).not.toHaveBeenCalled()
        expect(mockListAllPacksClear).not.toHaveBeenCalled()
      }
    )

    it('names the registry error in the failure', async () => {
      const store = useComfyRegistryStore()
      store.error = 'Failed to perform search: Network Error'
      const provider = useComfyRegistrySearchProvider()

      await expect(
        provider.searchPacks('test', { pageSize: 10, pageNumber: 0 })
      ).resolves.toEqual(
        failedWith(
          'Comfy Registry request failed: Failed to perform search: Network Error'
        )
      )
    })
  })

  describe('clearSearchCache', () => {
    it('should clear both search and listAllPacks caches', () => {
      const provider = useComfyRegistrySearchProvider()
      provider.clearSearchCache()

      expect(mockSearchClear).toHaveBeenCalled()
      expect(mockListAllPacksClear).toHaveBeenCalled()
    })
  })
})
