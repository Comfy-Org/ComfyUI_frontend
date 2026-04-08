/* eslint-disable testing-library/no-container */
/* eslint-disable testing-library/no-node-access */
import { createTestingPinia } from '@pinia/testing'
import { render, screen } from '@testing-library/vue'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { computed, toValue } from 'vue'
import type { ComponentProps } from 'vue-component-type-helpers'
import { createI18n } from 'vue-i18n'

import type { VueNodeData } from '@/composables/graph/useGraphNodeManager'
import { TitleMode } from '@/lib/litegraph/src/types/globalEnums'
import LGraphNode from '@/renderer/extensions/vueNodes/components/LGraphNode.vue'
import { useVueElementTracking } from '@/renderer/extensions/vueNodes/composables/useVueNodeResizeTracking'
import { useCanvasStore } from '@/renderer/core/canvas/canvasStore'
import { setActivePinia } from 'pinia'

const mockData = vi.hoisted(() => ({
  mockExecuting: false,
  mockLgraphNode: null as Record<string, unknown> | null
}))

vi.mock('@/utils/graphTraversalUtil', async (importOriginal) => {
  const actual = (await importOriginal()) as Record<string, unknown>
  return {
    ...actual,
    getLocatorIdFromNodeData: vi.fn(() => 'test-node-123'),
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
    rootGraph: { getNodeById: vi.fn() },
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
      'Node Render Error': 'Node Render Error'
    }
  }
})

const pinia = createTestingPinia({
  createSpy: vi.fn
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
        NodeWidgets: true,
        NodeContent: true,
        SlotConnectionDot: true
      }
    }
  })
}
const mockNodeData: VueNodeData = {
  id: 'test-node-123',
  title: 'Test Node',
  type: 'TestNode',
  mode: 0,
  flags: {},
  inputs: [],
  outputs: [],
  widgets: [],
  selected: false,
  executing: false
}

const mockRerouteNodeData: VueNodeData = {
  ...mockNodeData,
  id: 'reroute-node-1',
  title: '',
  type: 'Reroute',
  titleMode: TitleMode.NO_TITLE
}

describe('LGraphNode', () => {
  beforeEach(() => {
    vi.resetAllMocks()
    mockData.mockExecuting = false

    setActivePinia(pinia)
    const canvasStore = useCanvasStore()
    canvasStore.selectedNodeIds.clear()
  })

  it('should call resize tracking composable with node ID', () => {
    renderLGraphNode({ nodeData: mockNodeData })

    expect(useVueElementTracking).toHaveBeenCalledWith(
      expect.any(Function),
      'node'
    )
    const idArg = vi.mocked(useVueElementTracking).mock.calls[0]?.[0]
    const id = toValue(idArg)
    expect(id).toEqual('test-node-123')
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
    canvasStore.selectedNodeIds.add('test-node-123')

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

  it('should initialize height CSS vars for collapsed nodes', () => {
    const { container } = renderLGraphNode({
      nodeData: {
        ...mockNodeData,
        flags: { collapsed: true }
      }
    })
    const root = getNodeRoot(container)

    expect(root.style.getPropertyValue('--node-height')).toBe('')
    expect(root.style.getPropertyValue('--node-height-x')).toBe('130px')
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
      expect(container.querySelector('[role="button"][aria-label]')).toBeNull()
    })

    it('should render resize handle for regular nodes', () => {
      const { container } = renderLGraphNode({ nodeData: mockNodeData })
      expect(
        container.querySelector('[role="button"][aria-label]')
      ).not.toBeNull()
    })
  })

  describe('handleDrop', () => {
    it('should stop propagation when onDragDrop returns true', async () => {
      const onDragDrop = vi.fn().mockReturnValue(true)
      mockData.mockLgraphNode = {
        onDragDrop,
        onDragOver: vi.fn(),
        isSubgraphNode: () => false
      }

      const { container } = renderLGraphNode({ nodeData: mockNodeData })
      const nodeEl = getNodeRoot(container)
      const parent = nodeEl.parentElement!

      const parentListener = vi.fn()
      expect(parent).not.toBeNull()
      parent.addEventListener('drop', parentListener)

      nodeEl.dispatchEvent(
        new Event('drop', { bubbles: true, cancelable: true })
      )

      expect(onDragDrop).toHaveBeenCalled()
      expect(parentListener).not.toHaveBeenCalled()
    })

    it('should not stop propagation when onDragDrop returns false', async () => {
      const onDragDrop = vi.fn().mockReturnValue(false)
      mockData.mockLgraphNode = {
        onDragDrop,
        onDragOver: vi.fn(),
        isSubgraphNode: () => false
      }

      const { container } = renderLGraphNode({ nodeData: mockNodeData })
      const nodeEl = getNodeRoot(container)
      const parent = nodeEl.parentElement!

      const parentListener = vi.fn()
      expect(parent).not.toBeNull()
      parent.addEventListener('drop', parentListener)

      nodeEl.dispatchEvent(
        new Event('drop', { bubbles: true, cancelable: true })
      )

      expect(onDragDrop).toHaveBeenCalled()
      expect(parentListener).toHaveBeenCalled()
    })
  })
})
