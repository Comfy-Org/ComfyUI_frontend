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
  mockAddNodeOnGraph,
  mockGetNodeProvider,
  mockToggleNodeOnEvent
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
    mockAddNodeOnGraph: vi.fn(),
    mockGetNodeProvider: vi.fn(),
    mockToggleNodeOnEvent: vi.fn()
  }
})

vi.mock('@/services/litegraphService', () => ({
  useLitegraphService: () => ({ addNodeOnGraph: mockAddNodeOnGraph })
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
    loadModels: vi.fn().mockResolvedValue([]),
    loadModelFolders: vi.fn().mockResolvedValue([])
  })
}))

vi.mock('@/platform/settings/settingStore', () => ({
  useSettingStore: () => ({
    get: vi.fn((key: string) => {
      if (key === 'Comfy.ModelLibrary.NameFormat') return 'filename'
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
    template: '<div><slot name="header" /><slot name="body" /></div>'
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
  })

  function renderComponent() {
    return render(ModelLibrarySidebarTab, {
      global: {
        plugins: [createTestingPinia({ stubActions: false }), i18n],
        stubs: { teleport: true }
      }
    })
  }

  it('renders search input', () => {
    renderComponent()
    expect(screen.getByTestId('search-input')).toBeInTheDocument()
  })

  it('handles model click and adds node to graph', async () => {
    const mockNodeDef = { name: 'CheckpointLoaderSimple' }
    const mockWidget = { name: 'ckpt_name', value: '' }
    const mockGraphNode = { widgets: [mockWidget] }

    mockGetNodeProvider.mockReturnValue({
      nodeDef: mockNodeDef,
      key: 'ckpt_name'
    })
    mockAddNodeOnGraph.mockReturnValue(mockGraphNode)

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
    expect(mockAddNodeOnGraph).toHaveBeenCalledWith(mockNodeDef)
    expect(mockWidget.value).toBe('model.safetensors')
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
})
