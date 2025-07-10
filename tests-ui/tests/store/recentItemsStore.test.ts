import { createPinia, setActivePinia } from 'pinia'
import { beforeEach, describe, expect, it, vi } from 'vitest'

import { api } from '@/scripts/api'
import { ComfyModelLog } from '@/services/modelLogService'
import { ComfyModelDef, useModelStore } from '@/stores/modelStore'
import { useRecentItemsStore } from '@/stores/recentItemsStore'
import { useWorkflowStore } from '@/stores/workflowStore'

// Mock the api
vi.mock('@/scripts/api', () => ({
  api: {
    getModels: vi.fn(),
    getModelFolders: vi.fn(),
    viewMetadata: vi.fn(),
    getUserData: vi.fn(),
    storeUserData: vi.fn(),
    listUserDataFullInfo: vi.fn(),
    apiURL: vi.fn(),
    addEventListener: vi.fn(),
    getSettings: vi.fn(),
    storeSetting: vi.fn()
  }
}))

// Mock the app
vi.mock('@/scripts/app', () => ({
  app: {
    canvas: null,
    ui: {
      settings: {
        dispatchChange: vi.fn()
      }
    }
  }
}))

// Mock the stores
vi.mock('@/stores/settingStore')

vi.mock('@/services/modelLogService', () => {
  const mockActiveState: Record<string, number> = {}
  return {
    ComfyModelLog: {
      fromAPI: vi.fn().mockResolvedValue({
        activeState: mockActiveState,
        updateModelUsage: vi.fn((key: string, timestamp?: number) => {
          mockActiveState[key] = timestamp || Date.now()
        }),
        save: vi.fn().mockResolvedValue(undefined),
        isLoaded: true,
        isModified: false
      }),
      // Add static properties for testing
      dir: 'models',
      filename: 'models_usage.json',
      filePath: 'models/models_usage.json'
    }
  }
})

describe('useRecentItemsStore', () => {
  let recentItemsStore: ReturnType<typeof useRecentItemsStore>
  let workflowStore: ReturnType<typeof useWorkflowStore>
  let modelStore: ReturnType<typeof useModelStore>
  let mockSettingStore: any

  const mockModels = [
    {
      name: 'model1.safetensors',
      pathIndex: 0,
      created: 1700000000,
      modified: 1700000000,
      size: 12345678,
      date_created: 1700000000,
      last_modified: 1700000100
    },
    {
      name: 'model2.safetensors',
      pathIndex: 0,
      created: 1700000200,
      modified: 1700000200,
      size: 23456789,
      date_created: 1700000200,
      last_modified: 1700000300
    },
    {
      name: 'model3.safetensors',
      pathIndex: 0,
      created: 1700000400,
      modified: 1700000400,
      size: 34567890,
      date_created: 1700000400,
      last_modified: 1700000050
    }
  ]

  const mockWorkflows = [
    {
      path: 'workflows/workflow1.json',
      modified: 1700000000,
      size: 1024,
      created: 1700000000,
      lastModified: 1700000100
    },
    {
      path: 'workflows/workflow2.json',
      modified: 1700000200,
      size: 2048,
      created: 1700000200,
      lastModified: 1700000300
    },
    {
      path: 'workflows/workflow3.json',
      modified: 1700000400,
      size: 4096,
      created: 1700000400,
      lastModified: 1700000050
    }
  ]

  beforeEach(async () => {
    setActivePinia(createPinia())

    // Clear all mocks
    vi.clearAllMocks()

    // Setup mock setting store
    mockSettingStore = {
      get: vi.fn((key: string) => {
        if (key === 'Comfy.Sidebar.RecentItems.MaxCount') {
          return 5
        }
        return null
      }),
      set: vi.fn(),
      loadSettingValues: vi.fn(),
      addSetting: vi.fn()
    }

    // Setup mock implementations
    const { useSettingStore } = await import('@/stores/settingStore')
    vi.mocked(useSettingStore).mockReturnValue(mockSettingStore)

    // Initialize stores
    workflowStore = useWorkflowStore()
    modelStore = useModelStore()
    recentItemsStore = useRecentItemsStore()

    // Mock settings
    vi.mocked(api.getSettings).mockResolvedValue({
      'Comfy.Sidebar.RecentItems.MaxCount': 5
    } as any)

    vi.mocked(api.getUserData).mockResolvedValue({
      'Comfy.Sidebar.RecentItems.MaxCount': 5
    } as any)

    // Setup setting store with max count setting
    await mockSettingStore.loadSettingValues()
    mockSettingStore.addSetting({
      id: 'Comfy.Sidebar.RecentItems.MaxCount',
      name: 'Max Recent Items Count',
      type: 'number',
      defaultValue: 5
    })

    // Mock model store
    vi.mocked(api.getModels).mockResolvedValue(mockModels)
    vi.mocked(api.getModelFolders).mockResolvedValue([
      { name: 'checkpoints', folders: ['/path/to/checkpoints'] }
    ])
    vi.mocked(api.viewMetadata).mockResolvedValue({})

    // Mock workflow store
    vi.mocked(api.listUserDataFullInfo).mockResolvedValue(
      mockWorkflows.map((workflow) => ({
        path: workflow.path,
        modified: workflow.modified,
        size: workflow.size,
        created: workflow.created
      }))
    )
    vi.mocked(api.getUserData).mockResolvedValue({
      status: 200,
      json: () =>
        Promise.resolve({
          'checkpoints/model1.safetensors': 1700000100,
          'checkpoints/model2.safetensors': 1700000300,
          'checkpoints/model3.safetensors': 1700000050
        })
    } as Response)

    vi.mocked(api.storeUserData).mockResolvedValue({
      status: 200
    } as Response)
  })

  describe('recentlyAddedWorkflows', () => {
    it('should return empty array when no workflows exist', () => {
      expect(recentItemsStore.recentlyAddedWorkflows).toEqual([])
    })

    it('should return workflows sorted by creation date (newest first)', async () => {
      await workflowStore.syncWorkflows()
      const recentWorkflows = recentItemsStore.recentlyAddedWorkflows

      expect(recentWorkflows).toHaveLength(3)
      expect(recentWorkflows[0].created).toBe(1700000400) // workflow3 - newest
      expect(recentWorkflows[1].created).toBe(1700000200) // workflow2
      expect(recentWorkflows[2].created).toBe(1700000000) // workflow1 - oldest
    })

    it('should limit results to maxRecentItemCount', async () => {
      // Add more mock workflows than the limit
      const manyWorkflows = Array.from({ length: 10 }, (_, i) => ({
        path: `workflows/workflow${i}.json`,
        modified: 1700000000 + i * 1000,
        size: 1024,
        created: 1700000000 + i * 1000
      }))

      vi.mocked(api.listUserDataFullInfo).mockResolvedValue(
        manyWorkflows.map((workflow) => ({
          path: workflow.path,
          size: workflow.size,
          modified: workflow.modified,
          created: workflow.created
        }))
      )

      await workflowStore.syncWorkflows()
      recentItemsStore = useRecentItemsStore()
      const recentWorkflows = recentItemsStore.recentlyAddedWorkflows

      expect(recentWorkflows).toHaveLength(5) // Should be limited to maxRecentItemCount
    })
  })

  describe('recentlyAddedModels', () => {
    it('should return empty array when no models exist', () => {
      expect(recentItemsStore.recentlyAddedModels).toEqual([])
    })

    it('should return models sorted by date_created (newest first)', async () => {
      await modelStore.loadModelFolders()
      await modelStore.getLoadedModelFolder('checkpoints')
      const recentModels = recentItemsStore.recentlyAddedModels

      expect(recentModels).toHaveLength(3)
      expect(recentModels[0].date_created).toBe(1700000400) // model3 - newest
      expect(recentModels[1].date_created).toBe(1700000200) // model2
      expect(recentModels[2].date_created).toBe(1700000000) // model1 - oldest
    })

    it('should limit results to maxRecentItemCount', async () => {
      // Mock more models than the limit
      const manyModels = Array.from({ length: 10 }, (_, i) => ({
        name: `model${i}.safetensors`,
        pathIndex: 0,
        created: 1700000000 + i * 1000,
        modified: 1700000000 + i * 1000,
        size: 12345678,
        date_created: 1700000000 + i * 1000,
        last_modified: 1700000000 + i * 1000
      }))

      vi.mocked(api.getModels).mockResolvedValue(manyModels)

      await modelStore.loadModelFolders()
      await modelStore.getLoadedModelFolder('checkpoints')
      const recentModels = recentItemsStore.recentlyAddedModels

      expect(recentModels).toHaveLength(5) // Should be limited to maxRecentItemCount
    })
  })

  describe('recentlyUsedWorkflows', () => {
    it('should return empty array when no workflows exist', () => {
      expect(recentItemsStore.recentlyUsedWorkflows).toEqual([])
    })

    it('should return workflows sorted by lastModified (most recent first)', async () => {
      await workflowStore.syncWorkflows()
      const recentWorkflows = recentItemsStore.recentlyUsedWorkflows

      expect(recentWorkflows).toHaveLength(3)
      expect(recentWorkflows[0].lastModified).toBe(1700000400) // workflow2 - most recent
      expect(recentWorkflows[1].lastModified).toBe(1700000200) // workflow1
      expect(recentWorkflows[2].lastModified).toBe(1700000000) // workflow3 - least recent
    })

    it('should handle workflows without lastModified property', async () => {
      const workflowsWithoutLastModified = [
        {
          path: 'workflows/workflow1.json',
          modified: 1700000000,
          size: 1024,
          created: 1700000000
          // No lastModified property
        },
        {
          path: 'workflows/workflow2.json',
          modified: 1700000200,
          size: 2048,
          created: 1700000200,
          lastModified: 1700000300
        }
      ]

      vi.mocked(api.listUserDataFullInfo).mockResolvedValue(
        workflowsWithoutLastModified.map((workflow) => ({
          path: workflow.path,
          modified: workflow.modified,
          size: workflow.size,
          created: workflow.created
        }))
      )

      await workflowStore.syncWorkflows()
      const recentWorkflows = recentItemsStore.recentlyUsedWorkflows

      expect(recentWorkflows).toHaveLength(2)
      expect(recentWorkflows[0].lastModified).toBe(1700000200)
    })
  })

  describe('recentlyUsedModels', () => {
    it('should return empty array when no usage log exists', () => {
      expect(recentItemsStore.recentlyUsedModels).toEqual([])
    })

    it('should return models sorted by usage log (most recent first)', async () => {
      // Create proper ComfyModelDef instances with correct key property
      const modelDefs = mockModels.map((model) => {
        const modelDef = new ComfyModelDef(
          model.name,
          'checkpoints',
          model.pathIndex,
          model.date_created,
          model.last_modified,
          model.size
        )
        // Mock the key property to return the expected format
        Object.defineProperty(modelDef, 'key', {
          get: () => `checkpoints/${model.name}`,
          configurable: true
        })
        return modelDef
      })

      // Mock the model log service
      vi.mock('@/services/modelLogService', () => {
        const mockActiveState: Record<string, number> = {
          'checkpoints/model1.safetensors': 1700000100,
          'checkpoints/model2.safetensors': 1700000300,
          'checkpoints/model3.safetensors': 1700000050
        }

        return {
          ComfyModelLog: {
            fromAPI: vi.fn().mockResolvedValue({
              activeState: mockActiveState,
              updateModelUsage: vi.fn((key: string, timestamp?: number) => {
                mockActiveState[key] = timestamp || Date.now()
              }),
              save: vi.fn().mockResolvedValue(undefined),
              isLoaded: true,
              isModified: false
            }),
            dir: 'models',
            filename: 'models_usage.json',
            filePath: 'models/models_usage.json'
          }
        }
      })

      // Mock the modelStore to return our ComfyModelDef instances
      vi.spyOn(modelStore, 'models', 'get').mockReturnValue(modelDefs)
      // Create a new store instance to get the mocked service
      recentItemsStore = useRecentItemsStore()

      // Load the recent models to populate the usage log
      await recentItemsStore.loadRecentModels()

      const recentModels = recentItemsStore.recentlyUsedModels

      expect(recentModels).toHaveLength(3)
      expect(recentModels[0].file_name).toBe('model2.safetensors') // most recent usage
      expect(recentModels[1].file_name).toBe('model1.safetensors')
      expect(recentModels[2].file_name).toBe('model3.safetensors') // least recent usage
    })

    it('should handle models that no longer exist in model store', async () => {
      await modelStore.loadModelFolders()
      await modelStore.getLoadedModelFolder('checkpoints')

      // Create proper ComfyModelDef instances (only first 2 models) with correct key property
      const modelDefs = mockModels.slice(0, 2).map((model) => {
        const modelDef = new ComfyModelDef(
          model.name,
          'checkpoints',
          model.pathIndex,
          model.date_created,
          model.last_modified,
          model.size
        )
        // Mock the key property to return the expected format
        Object.defineProperty(modelDef, 'key', {
          get: () => `checkpoints/${model.name}`,
          configurable: true
        })
        return modelDef
      })

      // Mock the modelStore to return only 2 models
      vi.spyOn(modelStore, 'models', 'get').mockReturnValue(modelDefs)

      // Create a new store instance to get the mocked service
      recentItemsStore = useRecentItemsStore()

      // Load the recent models to populate the usage log
      await recentItemsStore.loadRecentModels()

      const recentModels = recentItemsStore.recentlyUsedModels

      expect(recentModels).toHaveLength(2) // Should filter out the deleted model
      expect(recentModels[0].file_name).toBe('model2.safetensors')
      expect(recentModels[1].file_name).toBe('model1.safetensors')
    })
  })

  describe('logModelUsage', () => {
    it('should update model usage and save', async () => {
      const modelDef = new ComfyModelDef(
        'test-model.safetensors',
        'checkpoints',
        0,
        1700000000,
        1700000000,
        12345678
      )
      Object.defineProperty(modelDef, 'key', {
        get: () => 'checkpoints/test-model.safetensors',
        configurable: true
      })

      const mockModelLogInstance = {
        activeState: {},
        updateModelUsage: vi.fn(),
        save: vi.fn().mockResolvedValue(undefined),
        isLoaded: true,
        isModified: false
      }

      vi.mocked(ComfyModelLog.fromAPI).mockResolvedValue(
        mockModelLogInstance as any
      )

      await recentItemsStore.loadRecentModels()
      await recentItemsStore.logModelUsage(modelDef)

      expect(mockModelLogInstance.updateModelUsage).toHaveBeenCalledWith(
        'checkpoints/test-model.safetensors'
      )
      expect(mockModelLogInstance.save).toHaveBeenCalled()
    })
  })

  describe('store reactivity', () => {
    it('should react to changes in underlying stores', async () => {
      // Initially empty
      expect(recentItemsStore.recentlyAddedWorkflows).toEqual([])
      expect(recentItemsStore.recentlyAddedModels).toEqual([])

      // Load data
      await workflowStore.syncWorkflows()
      await modelStore.loadModelFolders()
      await modelStore.loadModels()

      // Should now have data
      expect(recentItemsStore.recentlyAddedWorkflows).toHaveLength(3)
      expect(recentItemsStore.recentlyAddedModels).toHaveLength(3)
    })
  })
})
