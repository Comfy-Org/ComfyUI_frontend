import { createPinia, setActivePinia } from 'pinia'
import { beforeEach, describe, expect, it, vi } from 'vitest'

import type { MissingModelCandidate } from '@/platform/missingModel/types'

const mockGetNodeByExecutionId = vi.fn()
const mockResolveNodeDisplayName = vi.fn()
const mockValidateSourceUrl = vi.fn()
const mockGetAssetMetadata = vi.fn()
const mockUploadAssetAsync = vi.fn()
const mockTrackDownload = vi.fn()
const mockInvalidateModelsForCategory = vi.fn()
const mockGetAssetDisplayName = vi.fn((a: { name: string }) => a.name)
const mockGetAssetFilename = vi.fn((a: { name: string }) => a.name)
const mockGetAssets = vi.fn()
const mockUpdateModelsForNodeType = vi.fn()
const mockGetAllNodeProviders = vi.fn()
const mockDownloadList = vi.fn(
  (): Array<{ taskId: string; status: string }> => []
)

vi.mock('@/i18n', () => ({
  st: vi.fn((_key: string, fallback: string) => fallback)
}))

vi.mock('@/platform/distribution/types', () => ({
  isCloud: false
}))

vi.mock('vue-i18n', () => ({
  useI18n: () => ({
    t: (key: string) => key
  })
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
    getAssets: mockGetAssets,
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

vi.mock('@/platform/assets/services/assetService', () => ({
  assetService: {
    getAssetMetadata: (...args: unknown[]) => mockGetAssetMetadata(...args),
    uploadAssetAsync: (...args: unknown[]) => mockUploadAssetAsync(...args)
  }
}))

vi.mock('@/platform/assets/utils/assetMetadataUtils', () => ({
  getAssetDisplayName: (a: { name: string }) => mockGetAssetDisplayName(a),
  getAssetFilename: (a: { name: string }) => mockGetAssetFilename(a)
}))

vi.mock('@/platform/assets/importSources/civitaiImportSource', () => ({
  civitaiImportSource: {
    type: 'civitai',
    name: 'Civitai',
    hostnames: ['civitai.com', 'civitai.red']
  }
}))

vi.mock('@/platform/assets/importSources/huggingfaceImportSource', () => ({
  huggingfaceImportSource: {
    type: 'huggingface',
    name: 'Hugging Face',
    hostnames: ['huggingface.co']
  }
}))

vi.mock('@/platform/assets/utils/importSourceUtil', () => ({
  validateSourceUrl: (...args: unknown[]) => mockValidateSourceUrl(...args)
}))

import { app } from '@/scripts/app'
import { useMissingModelStore } from '@/platform/missingModel/missingModelStore'
import {
  getComboValue,
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
  beforeEach(() => {
    setActivePinia(createPinia())
    vi.resetAllMocks()
    mockGetAssetDisplayName.mockImplementation((a: { name: string }) => a.name)
    mockGetAssetFilename.mockImplementation((a: { name: string }) => a.name)
    mockDownloadList.mockImplementation(
      (): Array<{ taskId: string; status: string }> => []
    )
    ;(app as { rootGraph: unknown }).rootGraph = null
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

  describe('getComboValue', () => {
    it('returns undefined when node is not found', () => {
      ;(app as { rootGraph: unknown }).rootGraph = {}
      mockGetNodeByExecutionId.mockReturnValue(null)

      const result = getComboValue(makeCandidate())
      expect(result).toBeUndefined()
    })

    it('returns undefined when widget is not found', () => {
      ;(app as { rootGraph: unknown }).rootGraph = {}
      mockGetNodeByExecutionId.mockReturnValue({
        widgets: [{ name: 'other_widget', value: 'test' }]
      })

      const result = getComboValue(makeCandidate())
      expect(result).toBeUndefined()
    })

    it('returns string value directly', () => {
      ;(app as { rootGraph: unknown }).rootGraph = {}
      mockGetNodeByExecutionId.mockReturnValue({
        widgets: [{ name: 'ckpt_name', value: 'v1-5.safetensors' }]
      })

      expect(getComboValue(makeCandidate())).toBe('v1-5.safetensors')
    })

    it('returns stringified number value', () => {
      ;(app as { rootGraph: unknown }).rootGraph = {}
      mockGetNodeByExecutionId.mockReturnValue({
        widgets: [{ name: 'ckpt_name', value: 42 }]
      })

      expect(getComboValue(makeCandidate())).toBe('42')
    })

    it('returns undefined for unexpected types', () => {
      ;(app as { rootGraph: unknown }).rootGraph = {}
      mockGetNodeByExecutionId.mockReturnValue({
        widgets: [{ name: 'ckpt_name', value: { complex: true } }]
      })

      expect(getComboValue(makeCandidate())).toBeUndefined()
    })

    it('returns undefined when nodeId is null', () => {
      const result = getComboValue(makeCandidate({ nodeId: undefined }))
      expect(result).toBeUndefined()
    })
  })

  describe('toggleModelExpand / isModelExpanded', () => {
    it('starts collapsed by default', () => {
      const { isModelExpanded } = useMissingModelInteractions()
      expect(isModelExpanded('key1')).toBe(false)
    })

    it('toggles to expanded', () => {
      const { toggleModelExpand, isModelExpanded } =
        useMissingModelInteractions()
      toggleModelExpand('key1')
      expect(isModelExpanded('key1')).toBe(true)
    })

    it('toggles back to collapsed', () => {
      const { toggleModelExpand, isModelExpanded } =
        useMissingModelInteractions()
      toggleModelExpand('key1')
      toggleModelExpand('key1')
      expect(isModelExpanded('key1')).toBe(false)
    })
  })

  describe('handleComboSelect', () => {
    it('sets selectedLibraryModel in store', () => {
      const store = useMissingModelStore()
      const { handleComboSelect } = useMissingModelInteractions()

      handleComboSelect('key1', 'model_v2.safetensors')
      expect(store.selectedLibraryModel['key1']).toBe('model_v2.safetensors')
    })

    it('does not set value when undefined', () => {
      const store = useMissingModelStore()
      const { handleComboSelect } = useMissingModelInteractions()

      handleComboSelect('key1', undefined)
      expect(store.selectedLibraryModel['key1']).toBeUndefined()
    })
  })

  describe('isSelectionConfirmable', () => {
    it('returns false when no selection exists', () => {
      const { isSelectionConfirmable } = useMissingModelInteractions()
      expect(isSelectionConfirmable('key1')).toBe(false)
    })

    it('returns false when download is running', () => {
      const store = useMissingModelStore()
      store.selectedLibraryModel['key1'] = 'model.safetensors'
      store.importTaskIds['key1'] = 'task-123'
      mockDownloadList.mockReturnValue([
        { taskId: 'task-123', status: 'running' }
      ])

      const { isSelectionConfirmable } = useMissingModelInteractions()
      expect(isSelectionConfirmable('key1')).toBe(false)
    })

    it('returns false when importCategoryMismatch exists', () => {
      const store = useMissingModelStore()
      store.selectedLibraryModel['key1'] = 'model.safetensors'
      store.importCategoryMismatch['key1'] = 'loras'

      const { isSelectionConfirmable } = useMissingModelInteractions()
      expect(isSelectionConfirmable('key1')).toBe(false)
    })

    it('returns true when selection is ready with no active download', () => {
      const store = useMissingModelStore()
      store.selectedLibraryModel['key1'] = 'model.safetensors'
      mockDownloadList.mockReturnValue([])

      const { isSelectionConfirmable } = useMissingModelInteractions()
      expect(isSelectionConfirmable('key1')).toBe(true)
    })
  })

  describe('cancelLibrarySelect', () => {
    it('clears selectedLibraryModel and importCategoryMismatch', () => {
      const store = useMissingModelStore()
      store.selectedLibraryModel['key1'] = 'model.safetensors'
      store.importCategoryMismatch['key1'] = 'loras'

      const { cancelLibrarySelect } = useMissingModelInteractions()
      cancelLibrarySelect('key1')

      expect(store.selectedLibraryModel['key1']).toBeUndefined()
      expect(store.importCategoryMismatch['key1']).toBeUndefined()
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
      store.setMissingModels([
        makeCandidate({ name: 'old_model.safetensors', nodeId: '10' }),
        makeCandidate({ name: 'old_model.safetensors', nodeId: '20' })
      ])

      const removeSpy = vi.spyOn(store, 'removeMissingModelByNameOnNodes')

      const { confirmLibrarySelect } = useMissingModelInteractions()
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
    })

    it('does nothing when no selection exists', () => {
      ;(app as { rootGraph: unknown }).rootGraph = {}
      const store = useMissingModelStore()
      const removeSpy = vi.spyOn(store, 'removeMissingModelByNameOnNodes')

      const { confirmLibrarySelect } = useMissingModelInteractions()
      confirmLibrarySelect('key1', 'model.safetensors', [], null)

      expect(removeSpy).not.toHaveBeenCalled()
    })

    it('does nothing when graph is null', () => {
      ;(app as { rootGraph: unknown }).rootGraph = null
      const store = useMissingModelStore()
      store.selectedLibraryModel['key1'] = 'new.safetensors'
      const removeSpy = vi.spyOn(store, 'removeMissingModelByNameOnNodes')

      const { confirmLibrarySelect } = useMissingModelInteractions()
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

      const { confirmLibrarySelect } = useMissingModelInteractions()
      confirmLibrarySelect('key1', 'model.safetensors', [], 'checkpoints')

      expect(mockGetAllNodeProviders).toHaveBeenCalledWith('checkpoints')
    })
  })

  describe('handleUrlInput', () => {
    it('clears previous state on new input', () => {
      const store = useMissingModelStore()
      store.urlMetadata['key1'] = { name: 'old' } as never
      store.urlErrors['key1'] = 'old error'
      store.urlFetching['key1'] = true

      const { handleUrlInput } = useMissingModelInteractions()
      handleUrlInput('key1', 'https://civitai.com/models/123')

      expect(store.urlInputs['key1']).toBe('https://civitai.com/models/123')
      expect(store.urlMetadata['key1']).toBeUndefined()
      expect(store.urlErrors['key1']).toBeUndefined()
      expect(store.urlFetching['key1']).toBe(false)
    })

    it('does not set debounce timer for empty input', () => {
      const store = useMissingModelStore()
      const setTimerSpy = vi.spyOn(store, 'setDebounceTimer')

      const { handleUrlInput } = useMissingModelInteractions()
      handleUrlInput('key1', '   ')

      expect(setTimerSpy).not.toHaveBeenCalled()
    })

    it('sets debounce timer for non-empty input', () => {
      const store = useMissingModelStore()
      const setTimerSpy = vi.spyOn(store, 'setDebounceTimer')

      const { handleUrlInput } = useMissingModelInteractions()
      handleUrlInput('key1', 'https://civitai.com/models/123')

      expect(setTimerSpy).toHaveBeenCalledWith(
        'key1',
        expect.any(Function),
        800
      )
    })

    it('clears previous debounce timer', () => {
      const store = useMissingModelStore()
      const clearTimerSpy = vi.spyOn(store, 'clearDebounceTimer')

      const { handleUrlInput } = useMissingModelInteractions()
      handleUrlInput('key1', 'https://civitai.com/models/123')

      expect(clearTimerSpy).toHaveBeenCalledWith('key1')
    })
  })

  describe('getTypeMismatch', () => {
    it('returns null when groupDirectory is null', () => {
      const { getTypeMismatch } = useMissingModelInteractions()
      expect(getTypeMismatch('key1', null)).toBeNull()
    })

    it('returns null when no metadata exists', () => {
      const { getTypeMismatch } = useMissingModelInteractions()
      expect(getTypeMismatch('key1', 'checkpoints')).toBeNull()
    })

    it('returns null when metadata has no tags', () => {
      const store = useMissingModelStore()
      store.urlMetadata['key1'] = { name: 'model', tags: [] } as never

      const { getTypeMismatch } = useMissingModelInteractions()
      expect(getTypeMismatch('key1', 'checkpoints')).toBeNull()
    })

    it('returns null when detected type matches directory', () => {
      const store = useMissingModelStore()
      store.urlMetadata['key1'] = {
        name: 'model',
        tags: ['checkpoints']
      } as never

      const { getTypeMismatch } = useMissingModelInteractions()
      expect(getTypeMismatch('key1', 'checkpoints')).toBeNull()
    })

    it('returns detected type when it differs from directory', () => {
      const store = useMissingModelStore()
      store.urlMetadata['key1'] = {
        name: 'model',
        tags: ['loras']
      } as never

      const { getTypeMismatch } = useMissingModelInteractions()
      expect(getTypeMismatch('key1', 'checkpoints')).toBe('loras')
    })

    it('returns null when tags contain no recognized model type', () => {
      const store = useMissingModelStore()
      store.urlMetadata['key1'] = {
        name: 'model',
        tags: ['other', 'random']
      } as never

      const { getTypeMismatch } = useMissingModelInteractions()
      expect(getTypeMismatch('key1', 'checkpoints')).toBeNull()
    })
  })

  describe('getComboOptions', () => {
    it('returns assets from assetsStore when the model is asset-supported', () => {
      mockGetAssets.mockReturnValueOnce([
        { name: 'modelA.safetensors' },
        { name: 'modelB.safetensors' }
      ])

      const { getComboOptions } = useMissingModelInteractions()
      const options = getComboOptions(makeCandidate({ isAssetSupported: true }))

      expect(mockGetAssets).toHaveBeenCalledWith('CheckpointLoaderSimple')
      expect(options).toEqual([
        { name: 'modelA.safetensors', value: 'modelA.safetensors' },
        { name: 'modelB.safetensors', value: 'modelB.safetensors' }
      ])
    })

    it('returns widget options when the model is not asset-supported', () => {
      ;(app as { rootGraph: unknown }).rootGraph = {}
      mockGetNodeByExecutionId.mockReturnValue({
        widgets: [
          {
            name: 'ckpt_name',
            value: '',
            options: { values: ['v1.safetensors', 'v2.safetensors'] }
          }
        ]
      })

      const { getComboOptions } = useMissingModelInteractions()
      const options = getComboOptions(makeCandidate())

      expect(options).toEqual([
        { name: 'v1.safetensors', value: 'v1.safetensors' },
        { name: 'v2.safetensors', value: 'v2.safetensors' }
      ])
    })

    it('returns an empty array when the widget has no options.values', () => {
      ;(app as { rootGraph: unknown }).rootGraph = {}
      mockGetNodeByExecutionId.mockReturnValue({
        widgets: [{ name: 'ckpt_name', value: '' }]
      })

      const { getComboOptions } = useMissingModelInteractions()
      expect(getComboOptions(makeCandidate())).toEqual([])
    })
  })

  describe('getDownloadStatus', () => {
    it('returns null when no taskId is tracked for the key', () => {
      const { getDownloadStatus } = useMissingModelInteractions()
      expect(getDownloadStatus('key1')).toBeNull()
    })

    it('returns the matching download record when a taskId is tracked', () => {
      const store = useMissingModelStore()
      store.importTaskIds['key1'] = 'task-42'
      mockDownloadList.mockReturnValue([
        { taskId: 'task-other', status: 'running' },
        { taskId: 'task-42', status: 'created' }
      ])

      const { getDownloadStatus } = useMissingModelInteractions()
      expect(getDownloadStatus('key1')).toEqual({
        taskId: 'task-42',
        status: 'created'
      })
    })
  })

  describe('handleImport', () => {
    const setupImportableState = (key: string) => {
      const store = useMissingModelStore()
      store.urlInputs[key] = 'https://civitai.com/models/123'
      store.urlMetadata[key] = {
        filename: 'model.safetensors',
        name: 'model'
      } as never
      mockValidateSourceUrl.mockReturnValue(true)
      return store
    }

    it('tracks an async-pending result via importTaskIds and trackDownload', async () => {
      const store = setupImportableState('key1')
      mockUploadAssetAsync.mockResolvedValueOnce({
        type: 'async',
        task: { task_id: 'task-99', status: 'created' }
      })

      const { handleImport } = useMissingModelInteractions()
      await handleImport('key1', 'checkpoints')

      expect(store.importTaskIds['key1']).toBe('task-99')
      expect(mockTrackDownload).toHaveBeenCalledWith(
        'task-99',
        'checkpoints',
        'model.safetensors'
      )
    })

    it('invalidates model caches when the async result is already completed', async () => {
      setupImportableState('key1')
      mockUploadAssetAsync.mockResolvedValueOnce({
        type: 'async',
        task: { task_id: 'task-100', status: 'completed' }
      })

      const { handleImport } = useMissingModelInteractions()
      await handleImport('key1', 'checkpoints')

      expect(mockInvalidateModelsForCategory).toHaveBeenCalledWith(
        'checkpoints'
      )
    })

    it('records importCategoryMismatch when sync result tags differ from groupDirectory', async () => {
      const store = setupImportableState('key1')
      mockUploadAssetAsync.mockResolvedValueOnce({
        type: 'sync',
        asset: { tags: ['models', 'loras'] }
      })

      const { handleImport } = useMissingModelInteractions()
      await handleImport('key1', 'checkpoints')

      expect(store.importCategoryMismatch['key1']).toBe('loras')
    })

    it('writes the error message to urlErrors when the upload rejects', async () => {
      const store = setupImportableState('key1')
      mockUploadAssetAsync.mockRejectedValueOnce(new Error('Upload boom'))

      const { handleImport } = useMissingModelInteractions()
      await handleImport('key1', 'checkpoints')

      expect(store.urlErrors['key1']).toBe('Upload boom')
      expect(store.urlImporting['key1']).toBe(false)
    })
  })
})
