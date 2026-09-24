import { render, screen } from '@testing-library/vue'
import { getActivePinia } from 'pinia'
import { beforeEach, describe, expect, it, onTestFinished, vi } from 'vitest'

import { fromAny } from '@total-typescript/shoehorn'

import type { NodeError } from '@/platform/remote/comfyui/types'
import { useExecutionErrorStore } from '@/stores/executionErrorStore'
import { useWidgetValueStore } from '@/stores/widgetValueStore'
import { toNodeId } from '@/types/nodeId'
import { widgetId } from '@/types/widgetId'
import { computed, defineComponent, h, nextTick, ref } from 'vue'
import type { PropType } from 'vue'
import type { ComponentProps } from 'vue-component-type-helpers'
import { createI18n } from 'vue-i18n'

import {
  LGraphEventMode,
  TitleMode
} from '@/lib/litegraph/src/types/globalEnums'
import type { LGraphNode as LiteGraphNode } from '@/lib/litegraph/src/litegraph'
import type { NodeState } from '@/types/nodeState'
import { resizeNodeLayout } from '@/renderer/core/layout/operations/graphLayoutAttachment'
import LGraphNode from '@/renderer/extensions/vueNodes/components/LGraphNode.vue'
import type NodeWidgets from '@/renderer/extensions/vueNodes/components/NodeWidgets.vue'
import { useVueElementTracking } from '@/renderer/extensions/vueNodes/composables/useVueNodeResizeTracking'
import type { ResizeCallbackPayload } from '@/renderer/extensions/vueNodes/interactions/resize/useNodeResize'
import { useCanvasStore } from '@/renderer/core/canvas/canvasStore'
import { useSettingStore } from '@/platform/settings/settingStore'
import { app } from '@/scripts/app'
import { useNodeOutputStore } from '@/stores/nodeOutputStore'
import { getNodeByLocatorId } from '@/utils/graphTraversalUtil'

type ResizeCallback = (
  result: ResizeCallbackPayload,
  element: HTMLElement
) => void

const mockData = vi.hoisted(() => ({
  mockExecuting: false,
  mockLgraphNode: null as Record<string, unknown> | null,
  resizeCallback: null as ResizeCallback | null
}))

vi.mock(import('@/utils/graphTraversalUtil'))
vi.mocked(getNodeByLocatorId).mockImplementation(() =>
  fromAny<LiteGraphNode, unknown>(
    mockData.mockLgraphNode ?? { isSubgraphNode: () => false }
  )
)

vi.mock(import('@/renderer/core/layout/transform/useTransformState'))

vi.mock<unknown>(
  import('@/renderer/extensions/vueNodes/composables/useNodeEventHandlers'),
  () => {
    const handleNodeSelect = vi.fn()
    return { useNodeEventHandlers: () => ({ handleNodeSelect }) }
  }
)

vi.mock(
  import('@/renderer/extensions/vueNodes/composables/useVueNodeResizeTracking'),
  () => ({
    useVueElementTracking: vi.fn()
  })
)

vi.mock<unknown>(import('@/scripts/app'), () => ({
  app: {
    rootGraph: { id: 'graph-test', getNodeById: vi.fn() },
    canvas: { setDirty: vi.fn() },
    nodeOutputs: {},
    nodePreviewImages: {}
  }
}))

vi.mock(import('@/composables/useErrorHandling'))

vi.mock<unknown>(
  import('@/renderer/extensions/vueNodes/layout/useNodeLayout'),
  () => ({
    useNodeLayout: () => ({
      position: { x: 100, y: 50 },
      size: computed(() => ({ width: 200, height: 100 })),
      zIndex: 0,
      startDrag: vi.fn(),
      handleDrag: vi.fn(),
      endDrag: vi.fn(),
      moveTo: vi.fn()
    })
  })
)

vi.mock(
  import('@/renderer/extensions/vueNodes/execution/useNodeExecutionState'),
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

vi.mock<unknown>(
  import('@/renderer/extensions/vueNodes/preview/useNodePreviewState'),
  () => ({
    useNodePreviewState: vi.fn(() => ({
      latestPreviewUrl: computed(() => ''),
      shouldShowPreviewImg: computed(() => false)
    }))
  })
)

vi.mock(
  import('@/renderer/extensions/vueNodes/interactions/resize/useNodeResize'),
  () => ({
    useNodeResize: vi.fn((resizeCallback: ResizeCallback) => {
      mockData.resizeCallback = resizeCallback
      return {
        startResize: vi.fn(),
        isResizing: ref(false)
      }
    })
  })
)

vi.mock(import('@/renderer/core/layout/operations/graphLayoutAttachment'), {
  spy: true
})

const i18n = createI18n({
  legacy: false,
  locale: 'en',
  messages: {
    en: {
      g: {
        error: 'Error',
        resizeFromBottomRight: 'Resize from bottom right'
      },
      rightSidePanel: {
        showAdvancedShort: 'Show Advanced',
        showAdvancedInputsButton: 'Show Advanced Inputs'
      },
      'Node Render Error': 'Node Render Error'
    }
  }
})

function getNodeRoot(container: Element): HTMLElement {
  return container.firstElementChild as HTMLElement
}

let capturedNodeContentMedia: unknown
const NodeContentStub = defineComponent({
  props: { media: { type: Object, required: true } },
  setup(props) {
    capturedNodeContentMedia = props.media
    return () => h('div', { 'data-testid': 'node-content' })
  }
})

function renderLGraphNode(props: ComponentProps<typeof LGraphNode>) {
  return render(LGraphNode, {
    props,
    global: {
      plugins: [getActivePinia()!, i18n],
      stubs: {
        NodeHeader: true,
        NodeSlots: true,
        NodeWidgets: {
          props: {
            nodeData: Object as PropType<NodeState>,
            processedWidgetModel: {
              type: Object as PropType<
                NonNullable<
                  ComponentProps<typeof NodeWidgets>['processedWidgetModel']
                >
              >,
              required: true
            }
          },
          template:
            '<div data-testid="node-widgets">{{ processedWidgetModel.processedWidgets.map((widget) => widget.widgetId).join(",") }}</div>'
        },
        NodeContent: NodeContentStub,
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
    vi.mocked(getNodeByLocatorId).mockImplementation(() =>
      fromAny<LiteGraphNode, unknown>(
        mockData.mockLgraphNode ?? { isSubgraphNode: () => false }
      )
    )
    mockData.mockExecuting = false
    mockData.mockLgraphNode = null
    capturedNodeContentMedia = undefined
    mockData.resizeCallback = null

    const canvasStore = useCanvasStore()
    canvasStore.selectedNodeIds.clear()
    canvasStore.currentGraph = null
    const settingStore = useSettingStore()
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
        plugins: [getActivePinia()!, i18n],
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

  it('renders a customtext widget registered by graph mutations', async () => {
    const fakeRootGraph: Record<string, unknown> = {
      id: 'graph-test',
      getNodeById: () => null,
      subgraphs: new Map()
    }
    fakeRootGraph.rootGraph = fakeRootGraph
    useCanvasStore().currentGraph = fromAny(fakeRootGraph)
    useWidgetValueStore().registerWidget(
      widgetId('graph-test', mockNodeData.id, 'prompt'),
      {
        name: 'prompt',
        type: 'customtext',
        value: 'A projected prompt',
        options: {},
        label: 'prompt'
      },
      {}
    )

    render(LGraphNode, {
      props: {
        nodeData: { ...mockNodeData, graphId: 'graph-test' }
      },
      global: {
        plugins: [getActivePinia()!, i18n],
        stubs: {
          AsyncComponentWrapper: {
            props: ['modelValue'],
            template: '<textarea :value="modelValue" />'
          },
          NodeHeader: true,
          NodeSlots: true,
          NodeContent: true,
          SlotConnectionDot: true
        }
      }
    })

    expect(await screen.findByRole('textbox')).toHaveValue('A projected prompt')
  })

  it.for([
    { tier: 'advanced' as const, expectedHeight: '130px' },
    { tier: 'shown' as const, expectedHeight: '362px' }
  ])(
    'reserves image preview height only for a $tier expanding widget',
    ({ tier, expectedHeight }) => {
      const fakeRootGraph: Record<string, unknown> = {
        id: 'graph-test',
        getNodeById: () => null,
        subgraphs: new Map()
      }
      fakeRootGraph.rootGraph = fakeRootGraph
      useCanvasStore().currentGraph = fromAny(fakeRootGraph)
      useWidgetValueStore().registerWidget(
        widgetId('graph-test', mockNodeData.id, 'prompt'),
        { name: 'prompt', type: 'customtext', value: '', options: {} },
        {},
        {
          surfaces: { canvas: 'shown', vueNode: tier, panel: tier },
          suppression: { byExtension: false, byConnection: false }
        }
      )
      useNodeOutputStore().nodeOutputs['test-node-123'] = {
        images: [{ filename: 'output.png', type: 'output' }]
      }
      vi.mocked(useNodeOutputStore().getNodeImages).mockReturnValue([
        { url: '/output.png' }
      ])

      const { container } = renderLGraphNode({
        nodeData: { ...mockNodeData, graphId: 'graph-test' }
      })

      expect(
        getNodeRoot(container).style.getPropertyValue('--node-height')
      ).toBe(expectedHeight)
    }
  )

  it('reconciles the preview reserve once across resize and preview removal', async () => {
    const fakeRootGraph: Record<string, unknown> = {
      id: 'graph-test',
      getNodeById: () => mockData.mockLgraphNode,
      subgraphs: new Map()
    }
    fakeRootGraph.rootGraph = fakeRootGraph
    mockData.mockLgraphNode = { isSubgraphNode: () => false }
    useCanvasStore().currentGraph = fromAny(fakeRootGraph)
    useWidgetValueStore().registerWidget(
      widgetId('graph-test', mockNodeData.id, 'prompt'),
      { name: 'prompt', type: 'customtext', value: '', options: {} }
    )
    const outputs = useNodeOutputStore()
    outputs.nodeOutputs['test-node-123'] = {
      images: [{ filename: 'output.png', type: 'output' }]
    }
    vi.mocked(outputs.getNodeImages).mockReturnValue([{ url: '/output.png' }])
    const { container } = renderLGraphNode({
      nodeData: { ...mockNodeData, graphId: 'graph-test' }
    })

    mockData.resizeCallback?.(
      {
        size: { width: 300, height: 500 },
        position: { x: 10, y: 20 }
      },
      document.createElement('div')
    )
    expect(resizeNodeLayout).toHaveBeenLastCalledWith(
      mockData.mockLgraphNode,
      { width: 300, height: 238 },
      expect.objectContaining({ position: { x: 10, y: 20 } })
    )

    delete outputs.nodeOutputs['test-node-123']
    await nextTick()
    expect(getNodeRoot(container).style.getPropertyValue('--node-height')).toBe(
      '130px'
    )

    outputs.nodeOutputs['test-node-123'] = {
      images: [{ filename: 'output.png', type: 'output' }]
    }
    await nextTick()
    expect(getNodeRoot(container).style.getPropertyValue('--node-height')).toBe(
      '362px'
    )

    mockData.resizeCallback?.(
      {
        size: { width: 300, height: 500 },
        position: { x: 10, y: 20 }
      },
      document.createElement('div')
    )
    expect(vi.mocked(resizeNodeLayout).mock.calls.at(-1)?.[1].height).toBe(238)
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
    vi.mocked(nodeOutputStore.getNodeImages).mockReturnValue([
      {
        url: '/output.png',
        result: { filename: 'output.png', type: 'output' }
      }
    ])

    renderLGraphNode({
      nodeData: {
        ...mockNodeData,
        type: 'LoadImage'
      }
    })

    expect(screen.getByTestId('node-content')).toBeInTheDocument()
  })

  it('passes the output records along with the preview urls', () => {
    mockData.mockLgraphNode = { isSubgraphNode: () => false }
    const nodeOutputStore = useNodeOutputStore()
    nodeOutputStore.nodeOutputs['test-node-123'] = {
      images: [{ filename: 'output.png', subfolder: 'sub', type: 'output' }]
    }
    vi.mocked(nodeOutputStore.getNodeImages).mockReturnValue([
      {
        url: '/output.png',
        result: { filename: 'output.png', subfolder: 'sub', type: 'output' }
      }
    ])

    renderLGraphNode({ nodeData: mockNodeData })

    expect(capturedNodeContentMedia).toMatchObject({
      type: 'image',
      images: [
        {
          url: '/output.png',
          result: { filename: 'output.png', subfolder: 'sub', type: 'output' }
        }
      ]
    })
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

  it('ignores widgets advanced only on another surface', () => {
    mockData.mockLgraphNode = { isSubgraphNode: () => false }
    const rootGraph: Record<string, unknown> = {
      id: 'graph-test',
      getNodeById: () => mockData.mockLgraphNode,
      subgraphs: new Map()
    }
    rootGraph.rootGraph = rootGraph
    useCanvasStore().currentGraph = fromAny(rootGraph)

    const store = useWidgetValueStore()
    const id = widgetId('graph-test', mockNodeData.id, 'canvasAdvanced')
    store.registerWidget(id, { type: 'number', value: 0, options: {} })
    const visibility = store.getWidgetVisibility(id)
    expect(visibility).toBeDefined()
    if (visibility) {
      visibility.surfaces.canvas = 'advanced'
      visibility.surfaces.vueNode = 'shown'
    }

    renderLGraphNode({ nodeData: mockNodeData })

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
      renderLGraphNode({ nodeData: mockRerouteNodeData })

      expect(
        screen.queryByRole('button', { name: 'Resize from bottom right' })
      ).not.toBeInTheDocument()
    })

    it('should render resize handle for regular nodes', () => {
      renderLGraphNode({ nodeData: mockNodeData })

      expect(
        screen.getByRole('button', { name: 'Resize from bottom right' })
      ).toBeInTheDocument()
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

      const parentListener = vi.fn()
      document.addEventListener('drop', parentListener)
      onTestFinished(() => document.removeEventListener('drop', parentListener))

      nodeEl.dispatchEvent(
        new Event('drop', { bubbles: true, cancelable: true })
      )

      expect(parentListener).toHaveBeenCalled()
      expect(app.dragOverNode).toBe(mockData.mockLgraphNode)
    })
  })
})
