import { createPinia, setActivePinia } from 'pinia'
import { beforeEach, describe, expect, it, vi } from 'vitest'

import type { MissingModelCandidate } from '@/platform/missingModel/types'

const mockGetNodeByExecutionId = vi.fn()
const mockResolveNodeDisplayName = vi.fn()
const mockValidateSourceUrl = vi.fn()
const mockGetAssetMetadata = vi.fn()
const mockGetAssetDisplayName = vi.fn((a: { name: string }) => a.name)
const mockGetAssetFilename = vi.fn((a: { name: string }) => a.name)
const mockGetAssets = vi.fn()
const mockUpdateModelsForNodeType = vi.fn()
const mockGetAllNodeProviders = vi.fn()
const mockFindElectronDownloadByUrl = vi.fn()
const mockDownloadList = vi.fn(
  (): Array<{
    taskId: string
    status: string
    progress?: number
    error?: string
  }> => []
)

vi.mock('@/i18n', () => ({
  st: vi.fn((_key: string, fallback: string) => fallback)
}))

vi.mock('@/platform/distribution/types', () => ({
  isCloud: false,
  isDesktop: false
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
    invalidateModelsForCategory: vi.fn(),
    updateModelsForTag: vi.fn()
  })
}))

vi.mock('@/stores/assetDownloadStore', () => ({
  useAssetDownloadStore: () => ({
    get downloadList() {
      return mockDownloadList()
    },
    trackDownload: vi.fn()
  })
}))

vi.mock('@/stores/electronDownloadStore', () => ({
  useElectronDownloadStore: () => ({
    findByUrl: (...args: unknown[]) => mockFindElectronDownloadByUrl(...args)
  })
}))

vi.mock('@/stores/modelToNodeStore', () => ({
  useModelToNodeStore: () => ({
    getAllNodeProviders: mockGetAllNodeProviders
  })
}))

vi.mock('@/platform/assets/services/assetService', () => ({
  assetService: {
    getAssetMetadata: (...args: unknown[]) => mockGetAssetMetadata(...args)
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
    hostnames: ['civitai.com']
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
    mockFindElectronDownloadByUrl.mockReset()
    mockFindElectronDownloadByUrl.mockReturnValue(null)
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
      store.downloadRefs['key1'] = { kind: 'asset-import', taskId: 'task-123' }
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

    it('returns true when a tracked download is completed', () => {
      const store = useMissingModelStore()
      store.selectedLibraryModel['key1'] = 'model.safetensors'
      store.downloadRefs['key1'] = {
        kind: 'electron-download',
        url: 'https://example.com/model.safetensors'
      }
      mockFindElectronDownloadByUrl.mockReturnValue({
        progress: 1,
        status: 'completed'
      })

      const { isSelectionConfirmable } = useMissingModelInteractions()
      expect(isSelectionConfirmable('key1')).toBe(true)
    })

    it('returns false when a tracked download failed', () => {
      const store = useMissingModelStore()
      store.selectedLibraryModel['key1'] = 'model.safetensors'
      store.downloadRefs['key1'] = {
        kind: 'electron-download',
        url: 'https://example.com/model.safetensors'
      }
      mockFindElectronDownloadByUrl.mockReturnValue({
        progress: 0.3,
        status: 'failed'
      })

      const { isSelectionConfirmable } = useMissingModelInteractions()
      expect(isSelectionConfirmable('key1')).toBe(false)
    })
  })

  describe('getDownloadStatus', () => {
    it('returns the tracked asset import status for asset-import refs', () => {
      const store = useMissingModelStore()
      store.downloadRefs['key1'] = { kind: 'asset-import', taskId: 'task-123' }
      mockDownloadList.mockReturnValue([
        {
          taskId: 'task-123',
          status: 'running',
          progress: 0.5,
          error: undefined
        }
      ])

      const { getDownloadStatus } = useMissingModelInteractions()
      expect(getDownloadStatus('key1')).toEqual({
        progress: 0.5,
        status: 'running',
        error: undefined
      })
    })

    it('returns the tracked Electron download status for electron refs', () => {
      const store = useMissingModelStore()
      store.downloadRefs['key1'] = {
        kind: 'electron-download',
        url: 'https://example.com/model.safetensors'
      }
      mockFindElectronDownloadByUrl.mockReturnValue({
        progress: 0.4,
        status: 'paused',
        error: 'network stalled'
      })

      const { getDownloadStatus } = useMissingModelInteractions()
      expect(getDownloadStatus('key1')).toEqual({
        progress: 0.4,
        status: 'paused',
        error: 'network stalled'
      })
    })

    it('returns null when no tracked download ref exists', () => {
      const { getDownloadStatus } = useMissingModelInteractions()
      expect(getDownloadStatus('key1')).toBeNull()
    })
  })

  describe('cancelLibrarySelect', () => {
    it('clears selectedLibraryModel, importCategoryMismatch, and download refs', () => {
      const store = useMissingModelStore()
      store.selectedLibraryModel['key1'] = 'model.safetensors'
      store.importCategoryMismatch['key1'] = 'loras'
      store.downloadRefs['key1'] = {
        kind: 'electron-download',
        url: 'https://example.com/model.safetensors'
      }

      const { cancelLibrarySelect } = useMissingModelInteractions()
      cancelLibrarySelect('key1')

      expect(store.selectedLibraryModel['key1']).toBeUndefined()
      expect(store.importCategoryMismatch['key1']).toBeUndefined()
      expect(store.downloadRefs['key1']).toBeUndefined()
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
      store.downloadRefs['key1'] = {
        kind: 'electron-download',
        url: 'https://example.com/old_model.safetensors'
      }
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
      expect(store.downloadRefs['key1']).toBeUndefined()
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
})
