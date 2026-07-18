import { createTestingPinia } from '@pinia/testing'
import { fromPartial } from '@total-typescript/shoehorn'
import userEvent from '@testing-library/user-event'
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
  settingState,
  modelsState
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
    settingState: { useAssetAPI: false, autoLoadAll: false },
    modelsState: {
      push: (_: unknown) => {},
      reset: () => {}
    }
  }
})

vi.mock('@/composables/node/useNodeDragToCanvas', () => ({
  useNodeDragToCanvas: () => ({ startDrag: mockStartDrag })
}))

const mockToastAdd = vi.hoisted(() => vi.fn())
vi.mock('@/platform/updates/common/toastStore', () => ({
  useToastStore: () => ({ add: mockToastAdd })
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

vi.mock('@/stores/modelStore', async () => {
  const { reactive } = await import('vue')
  const models = reactive<ComfyModelDef[]>([])
  modelsState.push = (model: unknown) => {
    models.push(model as ComfyModelDef)
  }
  modelsState.reset = () => {
    models.splice(0, models.length, mockModel)
  }
  return {
    ResourceState: {
      Loading: 'loading',
      Loaded: 'loaded'
    },
    useModelStore: () => ({
      modelFolders: [],
      models,
      loadModels: mockLoadModels,
      loadModelFolders: vi.fn().mockResolvedValue([]),
      refresh: vi.fn().mockResolvedValue(undefined),
      refreshModelFolder: mockRefreshModelFolder
    })
  }
})

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

vi.mock('@/components/common/TreeExplorer.vue', async () => {
  const { watchEffect } = await import('vue')
  return {
    default: {
      name: 'TreeExplorer',
      template: '<div data-testid="tree-explorer" />',
      props: ['root', 'expandedKeys'],
      setup(props: { root: TreeExplorerNode<unknown> }) {
        watchEffect(() => captureRoot(props.root))
      }
    }
  }
})

vi.mock('@/components/ui/search-input/SearchInput.vue', () => ({
  default: {
    name: 'SearchInput',
    template: '<input data-testid="search-input" @input="onInput" />',
    props: ['modelValue', 'placeholder'],
    emits: ['update:modelValue', 'search'],
    setup(
      _props: unknown,
      {
        emit,
        expose
      }: {
        emit: (event: 'update:modelValue' | 'search', value: string) => void
        expose: (exposed: Record<string, unknown>) => void
      }
    ) {
      expose({ focus: vi.fn() })
      return {
        onInput: (event: Event) => {
          const value = (event.target as HTMLInputElement).value
          emit('update:modelValue', value)
          emit('search', value)
        }
      }
    }
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
    modelsState.reset()
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

  describe('search', () => {
    it('updates active search results when a reload adds a matching model', async () => {
      const user = userEvent.setup()
      renderComponent()
      await nextTick()

      await user.type(screen.getByTestId('search-input'), 'model')
      await nextTick()

      expect(mockLoadModels).toHaveBeenCalled()
      const leafLabels = () => {
        const { children: folders = [] } = getRoot()
        return folders.flatMap(({ children: leaves = [] }) =>
          leaves.map((leaf) => leaf.label)
        )
      }
      expect(leafLabels()).toEqual(['model'])

      // A completed scan reloads the store while the search is still active.
      modelsState.push(
        fromPartial<ComfyModelDef>({
          key: 'checkpoints/model-new.safetensors',
          file_name: 'model-new.safetensors',
          simplified_file_name: 'model-new',
          title: 'Model New',
          directory: 'checkpoints',
          searchable: 'checkpoints/model-new.safetensors'
        })
      )
      await nextTick()

      expect(leafLabels()).toEqual(['model', 'model-new'])
    })
  })

  describe('asset mode', () => {
    it('surfaces an error toast when the eager load fails on mount', async () => {
      const error = vi.spyOn(console, 'error').mockImplementation(() => {})
      settingState.useAssetAPI = true
      mockLoadModels.mockRejectedValueOnce(new Error('walk failed'))

      renderComponent()
      await nextTick()
      await nextTick()

      expect(mockToastAdd).toHaveBeenCalledWith(
        expect.objectContaining({ severity: 'error' })
      )
      error.mockRestore()
    })

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
