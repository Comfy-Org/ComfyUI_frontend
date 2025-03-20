import { createPinia, setActivePinia } from 'pinia'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { ref } from 'vue'

import { useComfyRegistryService } from '@/services/comfyRegistryService'
import { useComfyRegistryStore } from '@/stores/comfyRegistryStore'
import type { components, operations } from '@/types/comfyRegistryTypes'

vi.mock('@/services/comfyRegistryService', () => ({
  useComfyRegistryService: vi.fn()
}))

const mockNodePack: components['schemas']['Node'] = {
  id: 'test-pack-id',
  name: 'Test Pack',
  description: 'A test node pack',
  downloads: 1000,
  publisher: {
    id: 'test-publisher',
    name: 'Test Publisher'
  },
  latest_version: {
    id: 'test-version',
    version: '1.0.0',
    createdAt: '2023-01-01T00:00:00Z'
  }
}

const mockListResult: operations['listAllNodes']['responses'][200]['content']['application/json'] =
  {
    nodes: [mockNodePack],
    total: 1,
    page: 1,
    limit: 10
  }

describe('useComfyRegistryStore', () => {
  let mockRegistryService: {
    isLoading: ReturnType<typeof ref<boolean>>
    error: ReturnType<typeof ref<string | null>>
    listAllPacks: ReturnType<typeof vi.fn>
    getPackById: ReturnType<typeof vi.fn>
  }

  beforeEach(() => {
    setActivePinia(createPinia())
    vi.clearAllMocks()
    mockRegistryService = {
      isLoading: ref(false),
      error: ref(null),
      listAllPacks: vi.fn().mockResolvedValue(mockListResult),
      getPackById: vi.fn().mockResolvedValue(mockNodePack)
    }

    vi.mocked(useComfyRegistryService).mockReturnValue(
      mockRegistryService as any
    )
  })

  afterEach(() => {
    useComfyRegistryStore().clearCache()
  })

  it('should fetch and store packs', async () => {
    const store = useComfyRegistryStore()
    const params = { page: 1, limit: 10 }

    const result = await store.listAllPacks.call(params)

    expect(result).toEqual(mockListResult)
    expect(mockRegistryService.listAllPacks).toHaveBeenCalledWith(
      params,
      expect.any(Object) // abort signal
    )
  })

  it('should handle empty nodes array in response', async () => {
    const emptyResult = {
      nodes: undefined,
      total: 0,
      page: 1,
      limit: 10
    }
    mockRegistryService.listAllPacks.mockResolvedValueOnce(emptyResult)

    const store = useComfyRegistryStore()
    const result = await store.listAllPacks.call({ page: 1, limit: 10 })

    expect(result).toEqual(emptyResult)
  })

  it('should fetch a pack by ID', async () => {
    const store = useComfyRegistryStore()
    const packId = 'test-pack-id'

    const result = await store.getPackById.call(packId)

    expect(result).toEqual(mockNodePack)
    expect(mockRegistryService.getPackById).toHaveBeenCalledWith(packId)
  })

  it('should return null when fetching a pack with null ID', async () => {
    const store = useComfyRegistryStore()
    vi.spyOn(store.getPackById, 'call').mockResolvedValueOnce(null)

    const result = await store.getPackById.call(null as any)

    expect(result).toBeNull()
    expect(mockRegistryService.getPackById).not.toHaveBeenCalled()
  })

  it('should handle service errors gracefully', async () => {
    mockRegistryService.listAllPacks.mockResolvedValueOnce(null)

    const store = useComfyRegistryStore()
    const result = await store.listAllPacks.call({ page: 1, limit: 10 })

    expect(result).toBeNull()
  })
})
