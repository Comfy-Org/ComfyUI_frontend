import { createPinia, setActivePinia } from 'pinia'
import { beforeEach, describe, expect, it, vi } from 'vitest'

import { api } from '@/scripts/api'
import { useModelStore } from '@/stores/modelStore'

// Mock the setting store to return asset API setting
vi.mock('@/stores/settingStore', () => ({
  useSettingStore: vi.fn(() => ({
    get: vi.fn((key: string) => {
      if (key === 'Comfy.Assets.UseAssetAPI') {
        return true // Enable asset API for tests
      }
      return false
    })
  }))
}))

describe('Model Store - Asset API Integration', () => {
  beforeEach(() => {
    // Create a fresh Pinia instance and make it active
    setActivePinia(createPinia())

    vi.resetAllMocks()
    // Mock API methods
    vi.spyOn(api, 'getAssetModelFolders')
    vi.spyOn(api, 'getAssetModels')
  })

  describe('loadModelFolders with Asset API', () => {
    it('should use asset API when UseAssetAPI setting is enabled', async () => {
      const mockFolders = [
        { name: 'checkpoints', folders: [] },
        { name: 'loras', folders: [] },
        { name: 'vae', folders: [] }
      ]

      vi.mocked(api.getAssetModelFolders).mockResolvedValueOnce(mockFolders)

      const modelStore = useModelStore()
      await modelStore.loadModelFolders()

      expect(api.getAssetModelFolders).toHaveBeenCalledOnce()
      expect(modelStore.modelFolders).toHaveLength(3)
      expect(modelStore.modelFolders[0].directory).toBe('checkpoints')
      expect(modelStore.modelFolders[1].directory).toBe('loras')
      expect(modelStore.modelFolders[2].directory).toBe('vae')
    })

    it('should handle empty folders response from asset API', async () => {
      vi.mocked(api.getAssetModelFolders).mockResolvedValueOnce([])

      const modelStore = useModelStore()
      await modelStore.loadModelFolders()

      expect(api.getAssetModelFolders).toHaveBeenCalledOnce()
      expect(modelStore.modelFolders).toHaveLength(0)
    })

    it('should propagate asset API errors during folder loading', async () => {
      vi.mocked(api.getAssetModelFolders).mockRejectedValueOnce(
        new Error(
          'Unable to load model folders: Server returned 500. Please try again.'
        )
      )

      const modelStore = useModelStore()

      await expect(modelStore.loadModelFolders()).rejects.toThrow(
        'Unable to load model folders: Server returned 500. Please try again.'
      )
    })
  })

  describe('ModelFolder.load with Asset API', () => {
    it('should use asset API to load models in folder', async () => {
      const mockModels = [
        { name: 'model1.safetensors', pathIndex: 0 },
        { name: 'model2.safetensors', pathIndex: 0 }
      ]

      vi.mocked(api.getAssetModelFolders).mockResolvedValueOnce([
        { name: 'checkpoints', folders: [] }
      ])
      vi.mocked(api.getAssetModels).mockResolvedValueOnce(mockModels)

      const modelStore = useModelStore()
      await modelStore.loadModelFolders()

      const checkpointsFolder =
        await modelStore.getLoadedModelFolder('checkpoints')

      expect(api.getAssetModels).toHaveBeenCalledWith('checkpoints')
      expect(checkpointsFolder).not.toBeNull()
      expect(Object.keys(checkpointsFolder!.models)).toHaveLength(2)
      expect(checkpointsFolder!.models['0/model1.safetensors']).toBeDefined()
      expect(checkpointsFolder!.models['0/model2.safetensors']).toBeDefined()
    })

    it('should handle empty models response from asset API', async () => {
      vi.mocked(api.getAssetModelFolders).mockResolvedValueOnce([
        { name: 'empty-folder', folders: [] }
      ])
      vi.mocked(api.getAssetModels).mockResolvedValueOnce([])

      const modelStore = useModelStore()
      await modelStore.loadModelFolders()

      const emptyFolder = await modelStore.getLoadedModelFolder('empty-folder')

      expect(api.getAssetModels).toHaveBeenCalledWith('empty-folder')
      expect(emptyFolder).not.toBeNull()
      expect(Object.keys(emptyFolder!.models)).toHaveLength(0)
    })

    it('should propagate asset API errors during model loading', async () => {
      vi.mocked(api.getAssetModelFolders).mockResolvedValueOnce([
        { name: 'checkpoints', folders: [] }
      ])
      vi.mocked(api.getAssetModels).mockRejectedValueOnce(
        new Error(
          'Unable to load models for checkpoints: Server returned 404. Please try again.'
        )
      )

      const modelStore = useModelStore()
      await modelStore.loadModelFolders()

      await expect(
        modelStore.getLoadedModelFolder('checkpoints')
      ).rejects.toThrow(
        'Unable to load models for checkpoints: Server returned 404. Please try again.'
      )
    })

    it('should create ComfyModelDef instances with correct structure from asset API', async () => {
      const mockModels = [
        { name: 'awesome-checkpoint-v1.2.safetensors', pathIndex: 0 }
      ]

      vi.mocked(api.getAssetModelFolders).mockResolvedValueOnce([
        { name: 'checkpoints', folders: [] }
      ])
      vi.mocked(api.getAssetModels).mockResolvedValueOnce(mockModels)

      const modelStore = useModelStore()
      await modelStore.loadModelFolders()

      const checkpointsFolder =
        await modelStore.getLoadedModelFolder('checkpoints')
      const model =
        checkpointsFolder!.models['0/awesome-checkpoint-v1.2.safetensors']

      expect(model).toBeDefined()
      expect(model.file_name).toBe('awesome-checkpoint-v1.2.safetensors')
      expect(model.directory).toBe('checkpoints')
      expect(model.path_index).toBe(0)
      expect(model.simplified_file_name).toBe('awesome-checkpoint-v1.2')
      expect(model.title).toBe('awesome-checkpoint-v1.2')
      expect(model.key).toBe('checkpoints/awesome-checkpoint-v1.2.safetensors')
      expect(model.normalized_file_name).toBe(
        'awesome-checkpoint-v1.2.safetensors'
      )
    })
  })

  describe('End-to-End Asset API Flow', () => {
    it('should load folders and models using asset API throughout', async () => {
      const mockFolders = [
        { name: 'checkpoints', folders: [] },
        { name: 'loras', folders: [] }
      ]
      const mockCheckpointModels = [
        { name: 'checkpoint1.safetensors', pathIndex: 0 }
      ]
      const mockLoraModels = [
        { name: 'lora1.safetensors', pathIndex: 0 },
        { name: 'lora2.safetensors', pathIndex: 0 }
      ]

      vi.mocked(api.getAssetModelFolders).mockResolvedValueOnce(mockFolders)
      vi.mocked(api.getAssetModels)
        .mockResolvedValueOnce(mockCheckpointModels) // First call for checkpoints
        .mockResolvedValueOnce(mockLoraModels) // Second call for loras

      const modelStore = useModelStore()

      // Load folders
      await modelStore.loadModelFolders()
      expect(modelStore.modelFolders).toHaveLength(2)

      // Load all models
      await modelStore.loadModels()

      // Verify API was called correctly
      expect(api.getAssetModelFolders).toHaveBeenCalledOnce()
      expect(api.getAssetModels).toHaveBeenCalledTimes(2)
      expect(api.getAssetModels).toHaveBeenCalledWith('checkpoints')
      expect(api.getAssetModels).toHaveBeenCalledWith('loras')

      // Verify models are loaded correctly
      const allModels = modelStore.models
      expect(allModels).toHaveLength(3)
      expect(
        allModels.find((m) => m.file_name === 'checkpoint1.safetensors')
      ).toBeDefined()
      expect(
        allModels.find((m) => m.file_name === 'lora1.safetensors')
      ).toBeDefined()
      expect(
        allModels.find((m) => m.file_name === 'lora2.safetensors')
      ).toBeDefined()
    })
  })
})
