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

  beforeEach(() => {
    vi.clearAllMocks()

    // Setup store mock
    vi.mocked(useComfyRegistryStore).mockReturnValue({
      search: {
        call: mockSearchCall,
        clear: mockSearchClear
      }
    } as any)
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
  })

  describe('clearSearchCache', () => {
    it('should delegate to store search.clear', () => {
      const provider = useComfyRegistrySearchProvider()
      provider.clearSearchCache()

      expect(mockSearchClear).toHaveBeenCalled()
    })
  })

  describe('getSortValue', () => {
    const testPack = {
      id: '1',
      name: 'Test Pack',
      downloads: 100,
      publisher: { id: 'pub1', name: 'Publisher One' },
      latest_version: {
        version: '1.0.0',
        createdAt: '2024-01-15T10:00:00Z'
      }
    }

    it('should return download count for downloads field', () => {
      const provider = useComfyRegistrySearchProvider()
      expect(provider.getSortValue(testPack, 'downloads')).toBe(100)
    })

    it('should return pack name for name field', () => {
      const provider = useComfyRegistrySearchProvider()
      expect(provider.getSortValue(testPack, 'name')).toBe('Test Pack')
    })

    it('should return publisher name for publisher field', () => {
      const provider = useComfyRegistrySearchProvider()
      expect(provider.getSortValue(testPack, 'publisher')).toBe('Publisher One')
    })

    it('should return timestamp for updated field', () => {
      const provider = useComfyRegistrySearchProvider()
      const timestamp = new Date('2024-01-15T10:00:00Z').getTime()
      expect(provider.getSortValue(testPack, 'updated')).toBe(timestamp)
    })

    it('should handle missing values gracefully', () => {
      const incompletePack = { id: '1', name: 'Incomplete' }
      const provider = useComfyRegistrySearchProvider()

      expect(provider.getSortValue(incompletePack, 'downloads')).toBe(0)
      expect(provider.getSortValue(incompletePack, 'publisher')).toBe('')
      expect(provider.getSortValue(incompletePack, 'updated')).toBe(0)
    })

    it('should return 0 for unknown sort fields', () => {
      const provider = useComfyRegistrySearchProvider()
      expect(provider.getSortValue(testPack, 'unknown')).toBe(0)
    })
  })

  describe('getSortableFields', () => {
    it('should return supported sort fields', () => {
      const provider = useComfyRegistrySearchProvider()
      const fields = provider.getSortableFields()

      expect(fields).toEqual([
        { id: 'downloads', label: 'Downloads', direction: 'desc' },
        { id: 'name', label: 'Name', direction: 'asc' },
        { id: 'publisher', label: 'Publisher', direction: 'asc' },
        { id: 'updated', label: 'Updated', direction: 'desc' }
      ])
    })
  })
})
