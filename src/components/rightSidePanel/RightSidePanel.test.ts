import { createTestingPinia } from '@pinia/testing'
import { render, screen } from '@testing-library/vue'
import { fromAny } from '@total-typescript/shoehorn'
import { setActivePinia } from 'pinia'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { defineComponent, nextTick, ref } from 'vue'
import { createI18n } from 'vue-i18n'

import type { LGraphNode } from '@/lib/litegraph/src/litegraph'
import RightSidePanel from './RightSidePanel.vue'

const mockSelectedItems = ref<unknown[]>([])
const mockActiveWorkflow = ref<{ path: string } | null>({ path: 'wf-1' })
const mockActiveTab = ref<
  'errors' | 'parameters' | 'nodes' | 'info' | 'settings' | 'subgraph'
>('parameters')
const mockIsEditingSubgraph = ref(false)
const mockSidebarLocation = ref<'left' | 'right'>('right')

const closePanelMock = vi.fn()
const openPanelMock = vi.fn()

vi.mock('@/renderer/core/canvas/canvasStore', () => ({
  useCanvasStore: () => ({
    canvas: { setDirty: vi.fn() },
    currentGraph: undefined,
    selectedItems: mockSelectedItems
  })
}))

vi.mock('@/platform/workflow/management/stores/workflowStore', () => ({
  useWorkflowStore: () => ({
    get activeWorkflow() {
      return mockActiveWorkflow.value
    }
  })
}))

vi.mock('@/stores/workspace/rightSidePanelStore', () => ({
  useRightSidePanelStore: () => ({
    get isOpen() {
      return true
    },
    activeTab: mockActiveTab,
    isEditingSubgraph: mockIsEditingSubgraph,
    closePanel: closePanelMock,
    openPanel: openPanelMock
  })
}))

vi.mock('@/platform/settings/settingStore', () => ({
  useSettingStore: () => ({
    get: vi.fn((key: string) => {
      if (key === 'Comfy.Sidebar.Location') return mockSidebarLocation.value
      if (key === 'Comfy.RightSidePanel.ShowErrorsTab') return false
      return undefined
    })
  })
}))

vi.mock('@/stores/executionErrorStore', () => ({
  useExecutionErrorStore: () => ({
    hasAnyError: false,
    allErrorExecutionIds: [],
    activeGraphErrorNodeIds: new Set<string>(),
    isContainerWithInternalError: vi.fn(() => false)
  })
}))

vi.mock('@/platform/missingModel/missingModelStore', () => ({
  useMissingModelStore: () => ({
    activeMissingModelGraphIds: new Set<string>()
  })
}))

vi.mock('@/platform/missingMedia/missingMediaStore', () => ({
  useMissingMediaStore: () => ({
    activeMissingMediaGraphIds: new Set<string>()
  })
}))

vi.mock('@/platform/nodeReplacement/missingNodesErrorStore', () => ({
  useMissingNodesErrorStore: () => ({
    missingAncestorExecutionIds: []
  })
}))

vi.mock('@/composables/graph/useGraphHierarchy', () => ({
  useGraphHierarchy: () => ({
    findParentGroup: vi.fn(() => null)
  })
}))

vi.mock('@/scripts/app', () => ({
  app: {
    isGraphReady: false,
    rootGraph: { nodes: [] }
  }
}))

vi.mock('@/utils/graphTraversalUtil', () => ({
  getActiveGraphNodeIds: vi.fn(() => new Set<string>())
}))

vi.mock('@/utils/nodeTitleUtil', () => ({
  resolveNodeDisplayName: vi.fn(() => 'Mock Node')
}))

vi.mock('@/utils/executableGroupNodeDto', () => ({
  isGroupNode: vi.fn(() => false)
}))

vi.mock('@/utils/litegraphUtil', () => ({
  isLGraphGroup: vi.fn(() => false),
  isLGraphNode: vi.fn(
    (item: unknown) =>
      typeof item === 'object' && item !== null && 'isSubgraphNode' in item
  )
}))

vi.mock('@/i18n', () => ({
  st: vi.fn((key: string) => key)
}))

vi.mock(import('pinia'), async (importOriginal) => {
  const actual = await importOriginal()
  return {
    ...actual,
    storeToRefs: (store: Record<string, unknown>) => store
  }
})

vi.mock(import('@/lib/litegraph/src/litegraph'), async (importOriginal) => {
  const actual = await importOriginal()
  class SubgraphNode {}
  return {
    ...actual,
    SubgraphNode: SubgraphNode as unknown as typeof actual.SubgraphNode
  }
})

const mountCounters = {
  tabNodes: 0,
  tabNormalInputs: 0,
  tabSubgraphInputs: 0,
  subgraphEditor: 0
}

function makeMountTracker(key: keyof typeof mountCounters, testid: string) {
  return defineComponent({
    setup() {
      mountCounters[key]++
      const id = mountCounters[key]
      return { id }
    },
    template: `<div data-testid="${testid}" :data-mount-id="id" />`
  })
}

const i18n = createI18n({
  legacy: false,
  locale: 'en',
  messages: {
    en: {
      g: { settings: 'Settings' },
      rightSidePanel: {
        errors: 'Errors',
        nodes: 'Nodes',
        parameters: 'Parameters',
        info: 'Info',
        workflowOverview: 'Workflow',
        title: 'Selection ({count})',
        fallbackNodeTitle: 'Untitled',
        fallbackGroupTitle: 'Untitled Group',
        editTitle: 'Edit',
        editSubgraph: 'Edit subgraph',
        togglePanel: 'Toggle panel',
        globalSettings: { title: 'Global Settings' }
      }
    }
  }
})

const renderOptions = {
  global: {
    plugins: [i18n],
    stubs: {
      EditableText: { template: '<span><slot /></span>' },
      Tab: { template: '<div><slot /></div>' },
      TabList: {
        template: '<div><slot /></div>',
        emits: ['update:modelValue']
      },
      Button: { template: '<button><slot /></button>' },
      TabErrors: { template: '<div data-testid="tab-errors" />' },
      TabGlobalParameters: {
        template: '<div data-testid="tab-global-parameters" />'
      },
      TabNodes: makeMountTracker('tabNodes', 'tab-nodes'),
      TabGlobalSettings: {
        template: '<div data-testid="tab-global-settings" />'
      },
      TabSubgraphInputs: makeMountTracker(
        'tabSubgraphInputs',
        'tab-subgraph-inputs'
      ),
      TabNormalInputs: makeMountTracker('tabNormalInputs', 'tab-normal-inputs'),
      TabInfo: { template: '<div data-testid="tab-info" />' },
      TabSettings: { template: '<div data-testid="tab-settings" />' },
      SubgraphEditor: makeMountTracker('subgraphEditor', 'subgraph-editor')
    }
  }
}

describe('RightSidePanel', () => {
  beforeEach(() => {
    setActivePinia(createTestingPinia({ stubActions: false }))
    vi.clearAllMocks()
    mockSelectedItems.value = []
    mockActiveWorkflow.value = { path: 'wf-1' }
    mockActiveTab.value = 'parameters'
    mockIsEditingSubgraph.value = false
    mountCounters.tabNodes = 0
    mountCounters.tabNormalInputs = 0
    mountCounters.tabSubgraphInputs = 0
    mountCounters.subgraphEditor = 0
  })

  afterEach(() => {
    vi.restoreAllMocks()
  })

  it('remounts TabNodes when the active workflow path changes', async () => {
    mockActiveTab.value = 'nodes'

    render(RightSidePanel, renderOptions)
    await nextTick()

    const initial = screen
      .getByTestId('tab-nodes')
      .getAttribute('data-mount-id')
    expect(initial).toBeTruthy()

    mockActiveWorkflow.value = { path: 'wf-2' }
    await nextTick()
    await nextTick()

    const remounted = screen
      .getByTestId('tab-nodes')
      .getAttribute('data-mount-id')
    expect(remounted).not.toBe(initial)
  })

  it('does not remount TabNodes when the workflow path stays the same', async () => {
    mockActiveTab.value = 'nodes'

    render(RightSidePanel, renderOptions)
    await nextTick()

    const initial = screen
      .getByTestId('tab-nodes')
      .getAttribute('data-mount-id')

    mockActiveWorkflow.value = { path: 'wf-1' }
    await nextTick()

    expect(screen.getByTestId('tab-nodes').getAttribute('data-mount-id')).toBe(
      initial
    )
  })

  it('uses an empty workflow key when no workflow is active', async () => {
    mockActiveTab.value = 'nodes'
    mockActiveWorkflow.value = null

    render(RightSidePanel, renderOptions)
    await nextTick()

    expect(screen.getByTestId('tab-nodes')).toBeInTheDocument()
  })

  it('remounts TabNormalInputs when selection identity changes', async () => {
    const node1 = fromAny<LGraphNode, unknown>({
      id: 11,
      title: 'Node 1',
      isSubgraphNode: () => false,
      widgets: []
    })
    const node2 = fromAny<LGraphNode, unknown>({
      id: 22,
      title: 'Node 2',
      isSubgraphNode: () => false,
      widgets: []
    })

    mockSelectedItems.value = [node1]
    mockActiveTab.value = 'parameters'

    render(RightSidePanel, renderOptions)
    await nextTick()
    await nextTick()

    const initial = screen
      .getByTestId('tab-normal-inputs')
      .getAttribute('data-mount-id')
    expect(initial).toBeTruthy()

    mockSelectedItems.value = [node2]
    await nextTick()
    await nextTick()

    const remounted = screen
      .getByTestId('tab-normal-inputs')
      .getAttribute('data-mount-id')
    expect(remounted).not.toBe(initial)
  })

  it('remounts TabNormalInputs when the workflow path changes (selectedNodesKey embeds workflowKey)', async () => {
    const node = fromAny<LGraphNode, unknown>({
      id: 11,
      title: 'Node 1',
      isSubgraphNode: () => false,
      widgets: []
    })

    mockSelectedItems.value = [node]
    mockActiveTab.value = 'parameters'

    render(RightSidePanel, renderOptions)
    await nextTick()
    await nextTick()

    const initial = screen
      .getByTestId('tab-normal-inputs')
      .getAttribute('data-mount-id')

    mockActiveWorkflow.value = { path: 'wf-2' }
    await nextTick()
    await nextTick()

    const remounted = screen
      .getByTestId('tab-normal-inputs')
      .getAttribute('data-mount-id')
    expect(remounted).not.toBe(initial)
  })
})
