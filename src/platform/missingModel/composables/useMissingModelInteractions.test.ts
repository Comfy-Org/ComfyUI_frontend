import { createPinia, setActivePinia } from 'pinia'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { createApp } from 'vue'
import type { App } from 'vue'
import { createI18n } from 'vue-i18n'

import enMessages from '@/locales/en/main.json' with { type: 'json' }
import type { MissingModelCandidate } from '@/platform/missingModel/types'

const mockGetNodeByExecutionId = vi.fn()
const mockResolveNodeDisplayName = vi.fn()
const mockTrackDownload = vi.fn()
const mockInvalidateModelsForCategory = vi.fn()
const mockUpdateModelsForNodeType = vi.fn()
const mockGetAllNodeProviders = vi.fn()
const mockDownloadList = vi.fn(
  (): Array<{ taskId: string; status: string }> => []
)

vi.mock('@/platform/distribution/types', () => ({
  isCloud: false
}))

vi.mock('@/scripts/app', () => ({
  app: {
    rootGraph: null
  }
}))

vi.mock('@/utils/graphTraversalUtil', () => ({
  getNodeByExecutionId: (...args: unknown[]) =>
    mockGetNodeByExecutionId(...args)
}))

vi.mock('@/utils/nodeTitleUtil', () => ({
  resolveNodeDisplayName: (...args: unknown[]) =>
    mockResolveNodeDisplayName(...args)
}))

vi.mock('@/renderer/core/canvas/canvasStore', () => ({
  useCanvasStore: () => ({})
}))

vi.mock('@/stores/assetsStore', () => ({
  useAssetsStore: () => ({
    updateModelsForNodeType: mockUpdateModelsForNodeType,
    invalidateModelsForCategory: mockInvalidateModelsForCategory,
    updateModelsForTag: vi.fn()
  })
}))

vi.mock('@/stores/assetDownloadStore', () => ({
  useAssetDownloadStore: () => ({
    get downloadList() {
      return mockDownloadList()
    },
    trackDownload: mockTrackDownload
  })
}))

vi.mock('@/stores/modelToNodeStore', () => ({
  useModelToNodeStore: () => ({
    getAllNodeProviders: mockGetAllNodeProviders
  })
}))

import { app } from '@/scripts/app'
import { useMissingModelStore } from '@/platform/missingModel/missingModelStore'
import {
  getModelStateKey,
  getNodeDisplayLabel,
  useMissingModelInteractions
} from './useMissingModelInteractions'

function makeCandidate(
  overrides: Partial<MissingModelCandidate> = {}
): MissingModelCandidate {
  return {
    name: 'model.safetensors',
    nodeId: '1',
    nodeType: 'CheckpointLoaderSimple',
    widgetName: 'ckpt_name',
    isAssetSupported: false,
    isMissing: true,
    ...overrides
  }
}

describe('useMissingModelInteractions', () => {
  const mountedApps: App<Element>[] = []

  function setupWithI18n<T>(factory: () => T): T {
    let result: T | undefined
    const host = document.createElement('div')
    const app = createApp({
      setup() {
        result = factory()
        return () => null
      }
    })
    app.use(
      createI18n({
        legacy: false,
        locale: 'en',
        messages: { en: enMessages }
      })
    )
    app.mount(host)
    mountedApps.push(app)

    if (result === undefined) {
      throw new Error('Composable setup did not run')
    }
    return result
  }

  function setupMissingModelInteractions(): ReturnType<
    typeof useMissingModelInteractions
  > {
    return setupWithI18n(() => useMissingModelInteractions())
  }

  beforeEach(() => {
    setActivePinia(createPinia())
    vi.resetAllMocks()
    mockDownloadList.mockImplementation(
      (): Array<{ taskId: string; status: string }> => []
    )
    ;(app as { rootGraph: unknown }).rootGraph = null
  })

  afterEach(() => {
    for (const app of mountedApps.splice(0)) {
      app.unmount()
    }
  })

  describe('getModelStateKey', () => {
    it('returns key with supported prefix when asset is supported', () => {
      expect(getModelStateKey('model.safetensors', 'checkpoints', true)).toBe(
        'supported::checkpoints::model.safetensors'
      )
    })

    it('returns key with unsupported prefix when asset is not supported', () => {
      expect(getModelStateKey('model.safetensors', 'loras', false)).toBe(
        'unsupported::loras::model.safetensors'
      )
    })

    it('handles null directory', () => {
      expect(getModelStateKey('model.safetensors', null, true)).toBe(
        'supported::::model.safetensors'
      )
    })
  })

  describe('getNodeDisplayLabel', () => {
    it('returns fallback when graph is null', () => {
      ;(app as { rootGraph: unknown }).rootGraph = null
      expect(getNodeDisplayLabel('1', 'Node #1')).toBe('Node #1')
    })

    it('calls resolveNodeDisplayName when graph is available', () => {
      const mockGraph = {}
      const mockNode = { id: 1 }
      ;(app as { rootGraph: unknown }).rootGraph = mockGraph
      mockGetNodeByExecutionId.mockReturnValue(mockNode)
      mockResolveNodeDisplayName.mockReturnValue('My Checkpoint')

      const result = getNodeDisplayLabel('1', 'Node #1')

      expect(mockGetNodeByExecutionId).toHaveBeenCalledWith(mockGraph, '1')
      expect(result).toBe('My Checkpoint')
    })
  })

  describe('toggleModelExpand / isModelExpanded', () => {
    it('starts collapsed by default', () => {
      const { isModelExpanded } = setupMissingModelInteractions()
      expect(isModelExpanded('key1')).toBe(false)
    })

    it('toggles to expanded', () => {
      const { toggleModelExpand, isModelExpanded } =
        setupMissingModelInteractions()
      toggleModelExpand('key1')
      expect(isModelExpanded('key1')).toBe(true)
    })

    it('toggles back to collapsed', () => {
      const { toggleModelExpand, isModelExpanded } =
        setupMissingModelInteractions()
      toggleModelExpand('key1')
      toggleModelExpand('key1')
      expect(isModelExpanded('key1')).toBe(false)
    })
  })

  describe('confirmLibrarySelect', () => {
    it('updates widget values on referencing nodes and removes missing model', () => {
      const mockGraph = {}
      ;(app as { rootGraph: unknown }).rootGraph = mockGraph

      const widget1 = { name: 'ckpt_name', value: 'old_model.safetensors' }
      const widget2 = { name: 'ckpt_name', value: 'old_model.safetensors' }
      const node1 = { widgets: [widget1] }
      const node2 = { widgets: [widget2] }

      mockGetNodeByExecutionId.mockImplementation(
        (_graph: unknown, id: string) => {
          if (id === '10') return node1
          if (id === '20') return node2
          return null
        }
      )

      const store = useMissingModelStore()
      store.selectedLibraryModel['key1'] = 'new_model.safetensors'
      store.importTaskIds['key1'] = 'task-123'
      store.setMissingModels([
        makeCandidate({ name: 'old_model.safetensors', nodeId: '10' }),
        makeCandidate({ name: 'old_model.safetensors', nodeId: '20' })
      ])

      const removeSpy = vi.spyOn(store, 'removeMissingModelByNameOnNodes')

      const { confirmLibrarySelect } = setupMissingModelInteractions()
      confirmLibrarySelect(
        'key1',
        'old_model.safetensors',
        [
          { nodeId: '10', widgetName: 'ckpt_name' },
          { nodeId: '20', widgetName: 'ckpt_name' }
        ],
        null
      )

      expect(widget1.value).toBe('new_model.safetensors')
      expect(widget2.value).toBe('new_model.safetensors')
      expect(removeSpy).toHaveBeenCalledWith(
        'old_model.safetensors',
        new Set(['10', '20'])
      )
      expect(store.selectedLibraryModel['key1']).toBeUndefined()
      expect(store.importTaskIds['key1']).toBeUndefined()
    })

    it('does nothing when no selection exists', () => {
      ;(app as { rootGraph: unknown }).rootGraph = {}
      const store = useMissingModelStore()
      const removeSpy = vi.spyOn(store, 'removeMissingModelByNameOnNodes')

      const { confirmLibrarySelect } = setupMissingModelInteractions()
      confirmLibrarySelect('key1', 'model.safetensors', [], null)

      expect(removeSpy).not.toHaveBeenCalled()
    })

    it('does nothing when graph is null', () => {
      ;(app as { rootGraph: unknown }).rootGraph = null
      const store = useMissingModelStore()
      store.selectedLibraryModel['key1'] = 'new.safetensors'
      const removeSpy = vi.spyOn(store, 'removeMissingModelByNameOnNodes')

      const { confirmLibrarySelect } = setupMissingModelInteractions()
      confirmLibrarySelect('key1', 'model.safetensors', [], null)

      expect(removeSpy).not.toHaveBeenCalled()
    })

    it('refreshes model cache when directory is provided', () => {
      ;(app as { rootGraph: unknown }).rootGraph = {}
      mockGetNodeByExecutionId.mockReturnValue(null)
      mockGetAllNodeProviders.mockReturnValue([
        { nodeDef: { name: 'CheckpointLoaderSimple' } }
      ])

      const store = useMissingModelStore()
      store.selectedLibraryModel['key1'] = 'new.safetensors'

      const { confirmLibrarySelect } = setupMissingModelInteractions()
      confirmLibrarySelect('key1', 'model.safetensors', [], 'checkpoints')

      expect(mockGetAllNodeProviders).toHaveBeenCalledWith('checkpoints')
    })
  })

  describe('getDownloadStatus', () => {
    it('returns null when no taskId is tracked for the key', () => {
      const { getDownloadStatus } = setupMissingModelInteractions()
      expect(getDownloadStatus('key1')).toBeNull()
    })

    it('returns the matching download record when a taskId is tracked', () => {
      const store = useMissingModelStore()
      store.importTaskIds['key1'] = 'task-42'
      mockDownloadList.mockReturnValue([
        { taskId: 'task-other', status: 'running' },
        { taskId: 'task-42', status: 'created' }
      ])

      const { getDownloadStatus } = setupMissingModelInteractions()
      expect(getDownloadStatus('key1')).toEqual({
        taskId: 'task-42',
        status: 'created'
      })
    })
  })

  describe('handleUploadedModelImport', () => {
    it('tracks an async-pending result via importTaskIds and trackDownload', () => {
      const store = useMissingModelStore()

      const { handleUploadedModelImport } = setupMissingModelInteractions()
      handleUploadedModelImport('key1', {
        status: 'processing',
        taskId: 'task-99',
        modelType: 'checkpoints',
        filename: 'model.safetensors'
      })

      expect(store.importTaskIds['key1']).toBe('task-99')
      expect(store.selectedLibraryModel['key1']).toBe('model.safetensors')
      expect(mockTrackDownload).toHaveBeenCalledWith(
        'task-99',
        'checkpoints',
        'model.safetensors'
      )
    })

    it('invalidates model caches when the result is already completed', () => {
      const { handleUploadedModelImport } = setupMissingModelInteractions()
      handleUploadedModelImport('key1', {
        status: 'success',
        modelType: 'checkpoints',
        filename: 'model.safetensors'
      })

      expect(mockInvalidateModelsForCategory).toHaveBeenCalledWith(
        'checkpoints'
      )
    })
  })
})
