import { createTestingPinia } from '@pinia/testing'
import { render, screen } from '@testing-library/vue'
import { setActivePinia } from 'pinia'
import { beforeEach, describe, expect, it, vi } from 'vitest'

import { fromAny } from '@total-typescript/shoehorn'

import type { NodeError } from '@/schemas/apiSchema'
import { useExecutionErrorStore } from '@/stores/executionErrorStore'
import { useWidgetValueStore } from '@/stores/widgetValueStore'
import { toNodeId } from '@/types/nodeId'
import { widgetId } from '@/types/widgetId'
import { computed, nextTick, ref } from 'vue'
import type { ComponentProps } from 'vue-component-type-helpers'
import { createI18n } from 'vue-i18n'

import {
  LGraphEventMode,
  TitleMode
} from '@/lib/litegraph/src/types/globalEnums'
import type { NodeState } from '@/types/nodeState'
import LGraphNode from '@/renderer/extensions/vueNodes/components/LGraphNode.vue'
import { useVueElementTracking } from '@/renderer/extensions/vueNodes/composables/useVueNodeResizeTracking'
import { useCanvasStore } from '@/renderer/core/canvas/canvasStore'
import { useSettingStore } from '@/platform/settings/settingStore'
import { app } from '@/scripts/app'
import { useNodeOutputStore } from '@/stores/nodeOutputStore'

const mockData = vi.hoisted(() => ({
  mockExecuting: false,
  mockLgraphNode: null as Record<string, unknown> | null
}))

vi.mock('@/utils/graphTraversalUtil', async (importOriginal) => {
  const actual = (await importOriginal()) as Record<string, unknown>
  return {
    ...actual,
    getNodeByLocatorId: vi.fn(
      () => mockData.mockLgraphNode ?? { isSubgraphNode: () => false }
    )
  }
})

vi.mock('@/renderer/core/layout/transform/useTransformState', () => {
  return {
    useTransformState: () => ({
      screenToCanvas: vi.fn(),
      canvasToScreen: vi.fn(),
      camera: { z: 1 },
      isNodeInViewport: vi.fn()
    })
  }
})

vi.mock(
  '@/renderer/extensions/vueNodes/composables/useNodeEventHandlers',
  () => {
    const handleNodeSelect = vi.fn()
    return { useNodeEventHandlers: () => ({ handleNodeSelect }) }
  }
)

vi.mock(
  '@/renderer/extensions/vueNodes/composables/useVueNodeResizeTracking',
  () => ({
    useVueElementTracking: vi.fn()
  })
)

vi.mock('@/scripts/app', () => ({
  app: {
    rootGraph: { id: 'graph-test', getNodeById: vi.fn() },
    canvas: { setDirty: vi.fn() }
  }
}))

vi.mock('@/composables/useErrorHandling', () => ({
  useErrorHandling: () => ({
    toastErrorHandler: vi.fn()
  })
}))

vi.mock('@/renderer/extensions/vueNodes/layout/useNodeLayout', () => ({
  useNodeLayout: () => ({
    position: { x: 100, y: 50 },
    size: computed(() => ({ width: 200, height: 100 })),
    zIndex: 0,
    startDrag: vi.fn(),
    handleDrag: vi.fn(),
    endDrag: vi.fn(),
    moveTo: vi.fn()
  })
}))

vi.mock(
  '@/renderer/extensions/vueNodes/execution/useNodeExecutionState',
  () => ({
    useNodeExecutionState: vi.fn(() => ({
      executing: computed(() => mockData.mockExecuting),
      progress: computed(() => undefined),
      progressPercentage: computed(() => undefined),
      progressState: computed(() => undefined),
      executionState: computed(() => 'idle' as const)
    }))
  })
)

vi.mock('@/renderer/extensions/vueNodes/preview/useNodePreviewState', () => ({
  useNodePreviewState: vi.fn(() => ({
    latestPreviewUrl: computed(() => ''),
    shouldShowPreviewImg: computed(() => false)
  }))
}))

vi.mock(
  '@/renderer/extensions/vueNodes/interactions/resize/useNodeResize',
  () => ({
    useNodeResize: vi.fn(() => ({
      startResize: vi.fn(),
      isResizing: computed(() => false)
    }))
  })
)

const i18n = createI18n({
  legacy: false,
  locale: 'en',
  messages: {
    en: {
      g: {
        error: 'Error'
      },
      rightSidePanel: {
        showAdvancedShort: 'Show Advanced',
        showAdvancedInputsButton: 'Show Advanced Inputs'
      },
      'Node Render Error': 'Node Render Error'
    }
  }
})

const pinia = createTestingPinia({
  createSpy: vi.fn,
  stubActions: false
})

function getNodeRoot(container: Element): HTMLElement {
  return container.firstElementChild as HTMLElement
}

function renderLGraphNode(props: ComponentProps<typeof LGraphNode>) {
  return render(LGraphNode, {
    props,
    global: {
      plugins: [pinia, i18n],
      stubs: {
        NodeHeader: true,
        NodeSlots: true,
        NodeWidgets: {
          props: ['nodeData', 'widgetIds'],
          template:
            '<div data-testid="node-widgets">{{ widgetIds.join(",") }}</div>'
        },
        NodeContent: {
          template: '<div data-testid="node-content" />'
        },
        SlotConnectionDot: true
      }
    }
  })
}
const mockNodeData: NodeState = {
  id: toNodeId('test-node-123'),
  graphId: 'test-graph',
  title: 'Test Node',
  type: 'TestNode',
  mode: 0,
  flags: {},
  inputs: [],
  outputs: [],
  properties: {}
}

const mockRerouteNodeData: NodeState = {
  ...mockNodeData,
  id: toNodeId('reroute-node-1'),
  title: '',
  type: 'Reroute',
  titleMode: TitleMode.NO_TITLE
}

describe('LGraphNode', () => {
  beforeEach(() => {
    mockData.mockExecuting = false
    mockData.mockLgraphNode = null

    setActivePinia(pinia)
    const canvasStore = useCanvasStore()
    canvasStore.selectedNodeIds.clear()
    canvasStore.currentGraph = null
    const settingStore = useSettingStore(pinia)
    useNodeOutputStore().nodeOutputs = {}
    useWidgetValueStore().clearGraph('graph-test')
    vi.mocked(settingStore.get).mockImplementation((key) => {
      if (key === 'Comfy.RightSidePanel.ShowErrorsTab') return true
      if (key === 'Comfy.Node.AlwaysShowAdvancedWidgets') return false
      if (key === 'Comfy.Node.Opacity') return 1
    })
  })

  it('should call resize tracking composable with node ID', () => {
    renderLGraphNode({ nodeData: mockNodeData })

    expect(useVueElementTracking).toHaveBeenCalledWith('test-node-123', 'node')
  })

  it('should render with data-node-id attribute', () => {
    const { container } = renderLGraphNode({ nodeData: mockNodeData })

    expect(getNodeRoot(container).getAttribute('data-node-id')).toBe(
      'test-node-123'
    )
  })

  it('should render node title', () => {
    const { container } = render(LGraphNode, {
      props: { nodeData: mockNodeData },
      global: {
        plugins: [pinia, i18n],
        stubs: {
          NodeSlots: true,
          NodeWidgets: true,
          NodeContent: true,
          SlotConnectionDot: true
        }
      }
    })

    expect(container.textContent).toContain('Test Node')
  })

  it('should apply selected styling when selected prop is true', async () => {
    const canvasStore = useCanvasStore()
    canvasStore.selectedNodeIds.clear()
    canvasStore.selectedNodeIds.add(mockNodeData.id)

    const { container } = renderLGraphNode({ nodeData: mockNodeData })
    const root = getNodeRoot(container)

    expect(root).toHaveClass('outline-node-component-outline')

    const overlay = screen.getByTestId('node-state-outline-overlay')
    expect(overlay).toHaveClass('border-node-component-outline')
  })

  it('should render progress indicator when executing prop is true', () => {
    mockData.mockExecuting = true

    const { container } = renderLGraphNode({ nodeData: mockNodeData })
    const root = getNodeRoot(container)

    expect(root).toHaveClass('outline-node-stroke-executing')

    const overlay = screen.getByTestId('node-state-outline-overlay')
    expect(overlay).toHaveClass('border-node-stroke-executing')
  })

  it('hides a linked core LoadImage input preview', () => {
    mockData.mockLgraphNode = {
      constructor: {
        comfyClass: 'LoadImage',
        nodeData: { isCoreNode: true }
      },
      inputs: [{ name: 'image', widget: { name: 'image' } }],
      isInputConnected: vi.fn(() => true),
      isSubgraphNode: () => false
    }
    const nodeOutputStore = useNodeOutputStore()
    nodeOutputStore.nodeOutputs['test-node-123'] = {
      images: [{ filename: 'input.png', type: 'input' }]
    }
    vi.mocked(nodeOutputStore.getNodeImageUrls).mockReturnValue(['/input.png'])

    renderLGraphNode({
      nodeData: {
        ...mockNodeData,
        type: 'LoadImage'
      }
    })

    expect(screen.queryByTestId('node-content')).not.toBeInTheDocument()
  })

  it('keeps an executed output preview when the LoadImage selector is linked', () => {
    mockData.mockLgraphNode = {
      constructor: {
        comfyClass: 'LoadImage',
        nodeData: { isCoreNode: true }
      },
      inputs: [{ name: 'image', widget: { name: 'image' } }],
      isInputConnected: vi.fn(() => true),
      isSubgraphNode: () => false
    }
    const nodeOutputStore = useNodeOutputStore()
    nodeOutputStore.nodeOutputs['test-node-123'] = {
      images: [{ filename: 'output.png', type: 'output' }]
    }
    vi.mocked(nodeOutputStore.getNodeImageUrls).mockReturnValue(['/output.png'])

    renderLGraphNode({
      nodeData: {
        ...mockNodeData,
        type: 'LoadImage'
      }
    })

    expect(screen.getByTestId('node-content')).toBeInTheDocument()
  })

  it('restores only the core LoadAudio input player on disconnect', async () => {
    const isAudioLinked = ref(true)
    mockData.mockLgraphNode = {
      constructor: {
        comfyClass: 'LoadAudio',
        nodeData: { isCoreNode: true }
      },
      inputs: [{ name: 'audio', widget: { name: 'audio' } }],
      isInputConnected: vi.fn(() => isAudioLinked.value),
      isSubgraphNode: () => false
    }
    // widgetIds/nodeLocatorId derive from canvasStore.rootGraphId
    // (currentGraph.rootGraph.id), so this test needs a minimal root graph.
    // Scoped to this test only; beforeEach resets currentGraph to null.
    const fakeRootGraph: Record<string, unknown> = {
      id: 'graph-test',
      getNodeById: () => mockData.mockLgraphNode,
      subgraphs: new Map()
    }
    fakeRootGraph.rootGraph = fakeRootGraph
    useCanvasStore().currentGraph = fromAny(fakeRootGraph)
    const widgetValueStore = useWidgetValueStore()
    widgetValueStore.registerWidget(
      widgetId('graph-test', mockNodeData.id, 'audio'),
      { type: 'combo', value: '', options: {} }
    )
    widgetValueStore.registerWidget(
      widgetId('graph-test', mockNodeData.id, 'audioUI'),
      { type: 'audioUI', value: '', options: {} }
    )

    renderLGraphNode({
      nodeData: {
        ...mockNodeData,
        // graphId must match the root graph id, or locatorIdFromState treats
        // it as a (non-UUID) subgraph id and resolves no lgraphNode.
        graphId: 'graph-test',
        type: 'LoadAudio'
      }
    })

    expect(screen.getByTestId('node-widgets')).not.toHaveTextContent('audioUI')

    isAudioLinked.value = false
    await nextTick()

    expect(screen.getByTestId('node-widgets')).toHaveTextContent('audioUI')
  })

  it('should widen the selection outline rounding when the node has an error', () => {
    const canvasStore = useCanvasStore()
    canvasStore.selectedNodeIds.add(mockNodeData.id)
    vi.mocked(useExecutionErrorStore().getNodeErrors).mockReturnValue(
      fromAny<NodeError, unknown>({ errors: [], class_type: 'TestNode' })
    )

    renderLGraphNode({ nodeData: mockNodeData })

    const overlay = screen.getByTestId('node-state-outline-overlay')
    expect(overlay).toHaveClass('rounded-[19px]')
    expect(overlay).not.toHaveClass('rounded-[15px]')
  })

  it('should apply the bypass overlay when the node is bypassed', () => {
    renderLGraphNode({
      nodeData: { ...mockNodeData, mode: LGraphEventMode.BYPASS }
    })

    const wrapper = screen.getByTestId('node-inner-wrapper')
    expect(wrapper).toHaveClass('before:bg-bypass/60')
  })

  it('should apply the muted overlay when the node is muted', () => {
    renderLGraphNode({
      nodeData: { ...mockNodeData, mode: LGraphEventMode.NEVER }
    })

    const wrapper = screen.getByTestId('node-inner-wrapper')
    expect(wrapper).toHaveClass('before:rounded-xl')
    expect(wrapper).not.toHaveClass('before:bg-bypass/60')
  })

  it('drops the height var while collapsed and restores the size on expand', async () => {
    const { container, rerender } = renderLGraphNode({
      nodeData: { ...mockNodeData, flags: { collapsed: false } }
    })
    const root = getNodeRoot(container)
    expect(root.style.getPropertyValue('--node-height')).toBe('130px')

    await rerender({
      nodeData: { ...mockNodeData, flags: { collapsed: true } }
    })
    expect(root.style.getPropertyValue('--node-height')).toBe('')

    await rerender({
      nodeData: { ...mockNodeData, flags: { collapsed: false } }
    })
    expect(root.style.getPropertyValue('--node-height')).toBe('130px')
  })

  it('should initialize height CSS vars for expanded nodes', () => {
    const { container } = renderLGraphNode({
      nodeData: {
        ...mockNodeData,
        flags: { collapsed: false }
      }
    })
    const root = getNodeRoot(container)

    expect(root.style.getPropertyValue('--node-height')).toBe('130px')
    expect(root.style.getPropertyValue('--node-height-x')).toBe('')
  })

  it('should hide advanced footer button while the node is collapsed', () => {
    mockData.mockLgraphNode = {
      isSubgraphNode: () => false,
      widgets: [
        { name: 'advancedWidget', type: 'number', options: { advanced: true } }
      ]
    }
    renderLGraphNode({
      nodeData: {
        ...mockNodeData,
        flags: { collapsed: true }
      }
    })

    expect(
      screen.queryByRole('button', { name: /show advanced/i })
    ).not.toBeInTheDocument()
  })

  it('should show error-only footer for collapsed nodes with advanced widgets', () => {
    mockData.mockLgraphNode = {
      isSubgraphNode: () => false,
      widgets: [
        { name: 'advancedWidget', type: 'number', options: { advanced: true } }
      ]
    }
    // Seed the store, not `node.has_errors`: the ring is derived from the error
    // stores so it can react when the error clears.
    vi.mocked(useExecutionErrorStore().getNodeErrors).mockReturnValue(
      fromAny<NodeError, unknown>({ errors: [], class_type: 'TestNode' })
    )
    renderLGraphNode({
      nodeData: {
        ...mockNodeData,
        flags: { collapsed: true }
      }
    })

    expect(screen.getByRole('button', { name: 'Error' })).toBeInTheDocument()
    expect(
      screen.queryByRole('button', { name: /show advanced/i })
    ).not.toBeInTheDocument()
  })

  describe('Reroute node sizing', () => {
    it('should not enforce minimum width for reroute nodes', () => {
      const { container: rerouteContainer } = renderLGraphNode({
        nodeData: mockRerouteNodeData
      })
      const { container: regularContainer } = renderLGraphNode({
        nodeData: mockNodeData
      })

      const rerouteRoot = getNodeRoot(rerouteContainer)
      const regularRoot = getNodeRoot(regularContainer)

      const rerouteHasMinWidth = [...rerouteRoot.classList].some((c) =>
        c.startsWith('min-w-')
      )
      const regularHasMinWidth = [...regularRoot.classList].some((c) =>
        c.startsWith('min-w-')
      )

      expect(rerouteHasMinWidth).toBe(false)
      expect(regularHasMinWidth).toBe(true)
    })

    it('should use fixed height for reroute nodes', () => {
      const { container } = renderLGraphNode({
        nodeData: mockRerouteNodeData
      })
      const root = getNodeRoot(container)
      const hasFixedHeight = [...root.classList].some((c) => c.startsWith('h-'))
      expect(hasFixedHeight).toBe(true)
    })

    it('should not render resize handle for reroute nodes', () => {
      const { container } = renderLGraphNode({
        nodeData: mockRerouteNodeData
      })
      // eslint-disable-next-line testing-library/no-container, testing-library/no-node-access
      expect(container.querySelector('[role="button"][aria-label]')).toBeNull()
    })

    it('should render resize handle for regular nodes', () => {
      const { container } = renderLGraphNode({ nodeData: mockNodeData })
      expect(
        // eslint-disable-next-line testing-library/no-container, testing-library/no-node-access
        container.querySelector('[role="button"][aria-label]')
      ).not.toBeNull()
    })
  })

  describe('handleDrop', () => {
    it('should set app.dragOverNode and let event bubble', async () => {
      mockData.mockLgraphNode = {
        onDragOver: vi.fn(),
        isSubgraphNode: () => false
      }

      const { container } = renderLGraphNode({ nodeData: mockNodeData })
      const nodeEl = getNodeRoot(container)
      // eslint-disable-next-line testing-library/no-node-access
      const parent = nodeEl.parentElement!

      const parentListener = vi.fn()
      expect(parent).not.toBeNull()
      parent.addEventListener('drop', parentListener)

      nodeEl.dispatchEvent(
        new Event('drop', { bubbles: true, cancelable: true })
      )

      expect(parentListener).toHaveBeenCalled()
      expect(app.dragOverNode).toBe(mockData.mockLgraphNode)
    })
  })
})
