import { beforeEach, describe, expect, it, vi } from 'vitest'
import type { Mock } from 'vitest'

import { ComfyModelDef, useModelStore } from '@/stores/modelStore'

import { useModelLoader } from './useModelLoader'

interface MockModelFolder {
  directory: string
  models: Record<string, ComfyModelDef>
}

interface MockModelStore {
  modelFolders: MockModelFolder[]
  loadModelFolders: Mock
  loadModels: Mock
}

vi.mock('@/stores/modelStore', () => ({
  useModelStore: vi.fn(),
  ComfyModelDef: class {
    file_name: string
    directory: string
    path_index: number
    key: string
    title: string | null = null
    simplified_file_name: string
    has_loaded_metadata = false
    description: string | null = null
    tags: string[] = []
    author: string | null = null
    architecture_id: string | null = null
    resolution: string | null = null
    usage_hint: string | null = null
    trigger_phrase: string | null = null

    constructor(fileName: string, directory: string, pathIndex: number) {
      this.file_name = fileName
      this.directory = directory
      this.path_index = pathIndex
      this.key = `${directory}/${fileName}`
      this.simplified_file_name = fileName.replace('.safetensors', '')
    }

    async load() {
      this.has_loaded_metadata = true
    }
  }
}))

describe('useModelLoader', () => {
  let mockModelStore: MockModelStore

  beforeEach(() => {
    vi.clearAllMocks()

    const { clearCache } = useModelLoader()
    clearCache()

    mockModelStore = {
      modelFolders: [
        {
          directory: 'checkpoints',
          models: {
            'model1.safetensors': new ComfyModelDef(
              'model1.safetensors',
              'checkpoints',
              0
            )
          }
        }
      ],
      loadModelFolders: vi.fn().mockResolvedValue(undefined),
      loadModels: vi.fn().mockResolvedValue(undefined)
    }

    vi.mocked(useModelStore).mockReturnValue(
      mockModelStore as unknown as ReturnType<typeof useModelStore>
    )
  })

  it('should initialize with default state', () => {
    const { isLoading, error, models } = useModelLoader()

    expect(isLoading.value).toBe(false)
    expect(error.value).toBeNull()
    expect(models.value).toEqual([])
  })

  it('should load models successfully', async () => {
    const { isLoading, error, models, loadModels } = useModelLoader()

    await loadModels()

    expect(mockModelStore.loadModelFolders).toHaveBeenCalledTimes(1)
    expect(mockModelStore.loadModels).toHaveBeenCalledTimes(1)
    expect(isLoading.value).toBe(false)
    expect(error.value).toBeNull()
    expect(models.value).toHaveLength(1)
    expect(models.value[0].fileName).toBe('model1.safetensors')
  })

  it('should use cached data on second load', async () => {
    const { loadModels } = useModelLoader()

    await loadModels()
    expect(mockModelStore.loadModelFolders).toHaveBeenCalledTimes(1)

    await loadModels()
    expect(mockModelStore.loadModelFolders).toHaveBeenCalledTimes(1)
  })

  it('should force reload when force=true', async () => {
    const { loadModels } = useModelLoader()

    await loadModels()
    expect(mockModelStore.loadModelFolders).toHaveBeenCalledTimes(1)

    await loadModels(true)
    expect(mockModelStore.loadModelFolders).toHaveBeenCalledTimes(2)
  })

  it('should deduplicate concurrent requests', async () => {
    const { loadModels } = useModelLoader()

    const promise1 = loadModels(true)
    const promise2 = loadModels(true)

    await Promise.all([promise1, promise2])

    expect(mockModelStore.loadModelFolders).toHaveBeenCalledTimes(1)
  })

  it('should handle errors gracefully', async () => {
    const testError = new Error('API Error')
    mockModelStore.loadModels = vi.fn().mockRejectedValue(testError)

    const { isLoading, error, loadModels } = useModelLoader()

    await expect(loadModels(true)).rejects.toThrow('API Error')

    expect(isLoading.value).toBe(false)
    expect(error.value).toBe(testError)
  })

  it('should allow retry after error', async () => {
    const testError = new Error('API Error')
    mockModelStore.loadModels = vi.fn().mockRejectedValueOnce(testError)

    const { error, retryLoad } = useModelLoader()

    await expect(retryLoad()).rejects.toThrow('API Error')
    expect(error.value).toBe(testError)

    mockModelStore.loadModels = vi.fn().mockResolvedValue(undefined)
    await retryLoad()

    expect(error.value).toBeNull()
  })

  it('should clear cache', async () => {
    const { loadModels, clearCache } = useModelLoader()

    await loadModels()
    expect(mockModelStore.loadModelFolders).toHaveBeenCalledTimes(1)

    clearCache()

    await loadModels()
    expect(mockModelStore.loadModelFolders).toHaveBeenCalledTimes(2)
  })
})
