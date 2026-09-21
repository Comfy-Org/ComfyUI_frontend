import { beforeEach, describe, expect, it, vi } from 'vitest'
import type { MockInstance } from 'vitest'

import { useComfyRegistrySearchProvider } from '@/services/providers/registrySearchProvider'
import { useComfyRegistryStore } from '@/stores/comfyRegistryStore'

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
      const result = await provider.searchPacks('test', {
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
      expect(result.nodePacks).toEqual(mockResults.nodes)
      expect(result.querySuggestions).toEqual([])
    })

    it('should search for packs by node names', async () => {
      const mockResults = {
        nodes: [{ id: '1', name: 'Pack with LoadImage node' }]
      }
      mockSearchCall.mockResolvedValue(mockResults)

      const provider = useComfyRegistrySearchProvider()
      const result = await provider.searchPacks('LoadImage', {
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
      expect(result.nodePacks).toEqual(mockResults.nodes)
    })

    it('should handle empty results', async () => {
      mockSearchCall.mockResolvedValue({ nodes: [] })

      const provider = useComfyRegistrySearchProvider()
      const result = await provider.searchPacks('nonexistent', {
        pageSize: 10,
        pageNumber: 0
      })

      expect(result.nodePacks).toEqual([])
      expect(result.querySuggestions).toEqual([])
    })

    it('should handle null results', async () => {
      mockSearchCall.mockResolvedValue(null)

      const provider = useComfyRegistrySearchProvider()
      const result = await provider.searchPacks('test', {
        pageSize: 10,
        pageNumber: 0
      })

      expect(result.nodePacks).toEqual([])
      expect(result.querySuggestions).toEqual([])
    })

    it('should handle results without nodes property', async () => {
      mockSearchCall.mockResolvedValue({})

      const provider = useComfyRegistrySearchProvider()
      const result = await provider.searchPacks('test', {
        pageSize: 10,
        pageNumber: 0
      })

      expect(result.nodePacks).toEqual([])
      expect(result.querySuggestions).toEqual([])
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
      const result = await provider.searchPacks('', {
        pageSize: 20,
        pageNumber: 0
      })

      expect(mockListAllPacksCall).toHaveBeenCalledWith({
        limit: 20,
        page: 1
      })
      expect(mockSearchCall).not.toHaveBeenCalled()
      expect(result.nodePacks).toEqual(mockResults.nodes)
      expect(result.querySuggestions).toEqual([])
    })

    it('should use listAllPacks for whitespace-only query', async () => {
      const mockResults = {
        nodes: [{ id: '1', name: 'Pack 1' }]
      }
      mockListAllPacksCall.mockResolvedValue(mockResults)

      const provider = useComfyRegistrySearchProvider()
      const result = await provider.searchPacks('   ', {
        pageSize: 10,
        pageNumber: 0
      })

      expect(mockListAllPacksCall).toHaveBeenCalledWith({
        limit: 10,
        page: 1
      })
      expect(mockSearchCall).not.toHaveBeenCalled()
      expect(result.nodePacks).toEqual(mockResults.nodes)
    })

    it('should handle empty results from listAllPacks', async () => {
      mockListAllPacksCall.mockResolvedValue({ nodes: [] })

      const provider = useComfyRegistrySearchProvider()
      const result = await provider.searchPacks('', {
        pageSize: 10,
        pageNumber: 0
      })

      expect(result.nodePacks).toEqual([])
      expect(result.querySuggestions).toEqual([])
    })

    it('should handle null results from listAllPacks', async () => {
      mockListAllPacksCall.mockResolvedValue(null)

      const provider = useComfyRegistrySearchProvider()
      const result = await provider.searchPacks('', {
        pageSize: 10,
        pageNumber: 0
      })

      expect(result.nodePacks).toEqual([])
      expect(result.querySuggestions).toEqual([])
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
