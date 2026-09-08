import { beforeEach, describe, expect, it, vi } from 'vitest'

import { useComfyRegistrySearchProvider } from '@/services/providers/registrySearchProvider'
import { useComfyRegistryStore } from '@/stores/comfyRegistryStore'

// Mock the store
vi.mock('@/stores/comfyRegistryStore', () => ({
  useComfyRegistryStore: vi.fn()
}))

describe('useComfyRegistrySearchProvider', () => {
  const mockSearchCall = vi.fn()
  const mockSearchClear = vi.fn()
  const mockListAllPacksCall = vi.fn()
  const mockListAllPacksClear = vi.fn()

  const createMockStore = (
    params: Partial<ReturnType<typeof useComfyRegistryStore>> = {}
  ) => {
    return {
      search: {
        call: mockSearchCall,
        clear: mockSearchClear,
        cancel: vi.fn()
      },
      listAllPacks: {
        call: mockListAllPacksCall,
        clear: mockListAllPacksClear,
        cancel: vi.fn()
      },
      ...params
    } as Partial<ReturnType<typeof useComfyRegistryStore>> as ReturnType<
      typeof useComfyRegistryStore
    >
  }

  beforeEach(() => {
    // Setup store mock
    vi.mocked(useComfyRegistryStore).mockReturnValue(createMockStore())
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
