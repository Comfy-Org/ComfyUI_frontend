import { createTestingPinia } from '@pinia/testing'
import { fromPartial } from '@total-typescript/shoehorn'
import { render, screen } from '@testing-library/vue'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { nextTick } from 'vue'
import { createI18n } from 'vue-i18n'

import type { TreeExplorerNode } from '@/types/treeExplorerTypes'
import type { ComfyModelDef } from '@/stores/modelStore'

import ModelLibrarySidebarTab from './ModelLibrarySidebarTab.vue'

const {
  captureRoot,
  getRoot,
  resetRoot,
  mockStartDrag,
  mockGetNodeProvider,
  mockToggleNodeOnEvent,
  mockRefreshModelFolder,
  mockLoadModels,
  downloadStoreState,
  settingState
} = vi.hoisted(() => {
  let capturedRoot: TreeExplorerNode<unknown> | null = null
  return {
    captureRoot: (root: TreeExplorerNode<unknown>) => {
      capturedRoot = root
    },
    getRoot: () => capturedRoot as TreeExplorerNode<ComfyModelDef>,
    resetRoot: () => {
      capturedRoot = null
    },
    mockStartDrag: vi.fn(),
    mockGetNodeProvider: vi.fn(),
    mockToggleNodeOnEvent: vi.fn(),
    mockRefreshModelFolder: vi.fn().mockResolvedValue(undefined),
    mockLoadModels: vi.fn().mockResolvedValue([]),
    downloadStoreState: { setLastCompleted: (_: unknown) => {} },
    settingState: { useAssetAPI: false, autoLoadAll: false }
  }
})

vi.mock('@/composables/node/useNodeDragToCanvas', () => ({
  useNodeDragToCanvas: () => ({ startDrag: mockStartDrag })
}))

vi.mock('@/stores/modelToNodeStore', () => ({
  useModelToNodeStore: () => ({ getNodeProvider: mockGetNodeProvider })
}))

const mockModel = fromPartial<ComfyModelDef>({
  key: 'checkpoints/model.safetensors',
  file_name: 'model.safetensors',
  simplified_file_name: 'model',
  title: 'Model',
  directory: 'checkpoints',
  searchable: 'checkpoints/model.safetensors'
})

vi.mock('@/stores/modelStore', () => ({
  ResourceState: {
    Loading: 'loading',
    Loaded: 'loaded'
  },
  useModelStore: () => ({
    modelFolders: [],
    models: [mockModel],
    loadModels: mockLoadModels,
    loadModelFolders: vi.fn().mockResolvedValue([]),
    refresh: vi.fn().mockResolvedValue(undefined),
    refreshModelFolder: mockRefreshModelFolder
  })
}))

vi.mock('@/stores/assetDownloadStore', async () => {
  const { ref } = await import('vue')
  const lastCompletedDownload = ref<{
    taskId: string
    modelType: string
    timestamp: number
  } | null>(null)
  downloadStoreState.setLastCompleted = (value) => {
    lastCompletedDownload.value = value as typeof lastCompletedDownload.value
  }
  return {
    useAssetDownloadStore: () => ({
      get lastCompletedDownload() {
        return lastCompletedDownload.value
      }
    })
  }
})

vi.mock('@/platform/settings/settingStore', () => ({
  useSettingStore: () => ({
    get: vi.fn((key: string) => {
      if (key === 'Comfy.ModelLibrary.NameFormat') return 'filename'
      if (key === 'Comfy.Assets.UseAssetAPI') return settingState.useAssetAPI
      if (key === 'Comfy.ModelLibrary.AutoLoadAll') {
        return settingState.autoLoadAll
      }
      return false
    })
  })
}))

vi.mock('@/composables/useTreeExpansion', () => ({
  useTreeExpansion: () => ({
    expandNode: vi.fn(),
    toggleNodeOnEvent: mockToggleNodeOnEvent
  })
}))

vi.mock('@/components/common/TreeExplorer.vue', () => ({
  default: {
    name: 'TreeExplorer',
    template: '<div data-testid="tree-explorer" />',
    props: ['root', 'expandedKeys'],
    setup(props: { root: TreeExplorerNode<unknown> }) {
      captureRoot(props.root)
    }
  }
}))

vi.mock('@/components/ui/search-input/SearchInput.vue', () => ({
  default: {
    name: 'SearchInput',
    template: '<input data-testid="search-input" />',
    props: ['modelValue', 'placeholder'],
    setup() {
      return { focus: vi.fn() }
    },
    expose: ['focus']
  }
}))

vi.mock('./SidebarTopArea.vue', () => ({
  default: { name: 'SidebarTopArea', template: '<div><slot /></div>' }
}))

vi.mock('./SidebarTabTemplate.vue', () => ({
  default: {
    name: 'SidebarTabTemplate',
    template:
      '<div><slot name="tool-buttons" /><slot name="header" /><slot name="body" /></div>'
  }
}))

vi.mock('./modelLibrary/ElectronDownloadItems.vue', () => ({
  default: { name: 'ElectronDownloadItems', template: '<div />' }
}))

vi.mock('./modelLibrary/ModelTreeLeaf.vue', () => ({
  default: { name: 'ModelTreeLeaf', template: '<div />', props: ['node'] }
}))

const i18n = createI18n({
  legacy: false,
  locale: 'en',
  messages: { en: {} }
})

describe('ModelLibrarySidebarTab', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    resetRoot()
    downloadStoreState.setLastCompleted(null)
    settingState.useAssetAPI = false
    settingState.autoLoadAll = false
  })

  function renderComponent() {
    return render(ModelLibrarySidebarTab, {
      global: {
        plugins: [createTestingPinia({ stubActions: false }), i18n],
        stubs: { teleport: true },
        directives: { tooltip: {} }
      }
    })
  }

  it('renders search input', () => {
    renderComponent()
    expect(screen.getByTestId('search-input')).toBeInTheDocument()
  })

  it('starts a ghost drag carrying the widget value to fill on placement', async () => {
    const mockNodeDef = { name: 'CheckpointLoaderSimple' }

    mockGetNodeProvider.mockReturnValue({
      nodeDef: mockNodeDef,
      key: 'ckpt_name'
    })

    renderComponent()
    await nextTick()

    const root = getRoot()
    const checkpointsFolder = root.children?.[0]
    const modelLeaf = checkpointsFolder?.children?.[0]

    expect(modelLeaf?.label).toBe('model')
    expect(modelLeaf?.leaf).toBe(true)

    const mockEvent = new MouseEvent('click')
    await modelLeaf?.handleClick?.(mockEvent)

    expect(mockGetNodeProvider).toHaveBeenCalledWith('checkpoints')
    expect(mockStartDrag).toHaveBeenCalledWith(mockNodeDef, {
      widgetValues: { ckpt_name: 'model.safetensors' },
      source: 'sidebar_drag'
    })
  })

  it('toggles folder expansion on click', async () => {
    renderComponent()
    await nextTick()

    const root = getRoot()
    const checkpointsFolder = root.children?.[0]
    const mockEvent = new MouseEvent('click')

    await checkpointsFolder?.handleClick?.(mockEvent)

    expect(mockToggleNodeOnEvent).toHaveBeenCalled()
  })

  it('refreshes the affected folder when an asset download completes', async () => {
    renderComponent()
    await nextTick()

    expect(mockRefreshModelFolder).not.toHaveBeenCalled()

    downloadStoreState.setLastCompleted({
      taskId: 'task-1',
      modelType: 'checkpoints',
      timestamp: Date.now()
    })
    await nextTick()

    expect(mockRefreshModelFolder).toHaveBeenCalledWith('checkpoints')
  })

  it('does not refresh when no download has completed', async () => {
    renderComponent()
    await nextTick()

    expect(mockRefreshModelFolder).not.toHaveBeenCalled()
  })

  describe('asset mode', () => {
    it('hides the load-all button and eager-loads models on mount', async () => {
      settingState.useAssetAPI = true
      renderComponent()
      await nextTick()

      expect(screen.queryByLabelText('g.loadAllFolders')).toBeNull()
      expect(screen.getByLabelText('g.refresh')).toBeInTheDocument()
      expect(mockLoadModels).toHaveBeenCalledTimes(1)
    })

    it('legacy mode keeps the load-all button and stays lazy by default', async () => {
      renderComponent()
      await nextTick()

      expect(screen.getByLabelText('g.loadAllFolders')).toBeInTheDocument()
      expect(mockLoadModels).not.toHaveBeenCalled()
    })

    it('legacy mode still honors AutoLoadAll', async () => {
      settingState.autoLoadAll = true
      renderComponent()
      await nextTick()

      expect(mockLoadModels).toHaveBeenCalledTimes(1)
    })
  })
})
