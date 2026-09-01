import { beforeEach, describe, expect, it, vi } from 'vitest'
import { defineComponent, h, nextTick, ref } from 'vue'

import { render, screen } from '@testing-library/vue'

import { LiteGraph } from '@/lib/litegraph/src/litegraph'
import type { NodeLayout } from '@/renderer/core/layout/types'
import { toNodeId } from '@/types/nodeId'
import type { NodeId } from '@/types/nodeId'
import type { UUID } from '@/utils/uuid'

type ResizeEntryLike = Pick<
  ResizeObserverEntry,
  | 'target'
  | 'borderBoxSize'
  | 'contentBoxSize'
  | 'devicePixelContentBoxSize'
  | 'contentRect'
>

const resizeObserverState = vi.hoisted(() => {
  const state = {
    callback: null as ResizeObserverCallback | null,
    observe: vi.fn<(element: Element) => void>(),
    unobserve: vi.fn<(element: Element) => void>(),
    disconnect: vi.fn<() => void>()
  }

  const MockResizeObserver: typeof ResizeObserver = class MockResizeObserver implements ResizeObserver {
    observe = state.observe
    unobserve = state.unobserve
    disconnect = state.disconnect

    constructor(callback: ResizeObserverCallback) {
      state.callback = callback
    }
  }

  globalThis.ResizeObserver = MockResizeObserver

  return state
})

const ROOT_GRAPH_ID = vi.hoisted<UUID>(() => 'root-graph')
const SECOND_GRAPH_ID = vi.hoisted<UUID>(() => 'second-graph')

const testState = vi.hoisted(() => {
  const contentSizes = new Map<string, { width: number; height: number }>()

  return {
    linearMode: false,
    rootGraphId: ROOT_GRAPH_ID,
    visibility: null as { value: 'visible' | 'hidden' } | null,
    nodeLayouts: new Map<NodeId, NodeLayout>(),
    contentSizes,
    reportContentSize: vi.fn(
      (
        rootGraphId: UUID,
        nodeId: NodeId,
        size: { width: number; height: number }
      ) => {
        contentSizes.set(`${rootGraphId}:${nodeId}`, size)
      }
    ),
    syncSlotOffsets: vi.fn(),
    setDirty: vi.fn()
  }
})

vi.mock('@vueuse/core', () => ({
  useDocumentVisibility: () => {
    const visibility = ref<'visible' | 'hidden'>('visible')
    testState.visibility = visibility
    return visibility
  },
  createSharedComposable: <T>(fn: T) => fn
}))

vi.mock('@/renderer/core/canvas/canvasStore', () => ({
  useCanvasStore: () => ({
    linearMode: testState.linearMode,
    rootGraphId: testState.rootGraphId,
    canvas: { setDirty: testState.setDirty }
  })
}))

vi.mock('@/composables/element/useCanvasPositionConversion', () => ({
  useSharedCanvasPositionConversion: () => ({
    clientPosToCanvasPos: ([x, y]: [number, number]) => [x, y]
  })
}))

vi.mock('@/renderer/core/layout/store/layoutStore', () => ({
  layoutStore: {
    reportContentSize: testState.reportContentSize,
    contentSizeOf: (rootGraphId: UUID, nodeId: NodeId) =>
      testState.contentSizes.get(`${rootGraphId}:${nodeId}`),
    getNodeLayout: (_rootGraphId: UUID, rawNodeId: NodeId): NodeLayout | null =>
      testState.nodeLayouts.get(rawNodeId) ?? null
  }
}))

vi.mock('@/renderer/core/layout/slots/syncSlotOffsets', () => ({
  syncSlotOffsets: (
    _element: HTMLElement,
    _rootGraphId: UUID,
    nodeId: NodeId
  ) => testState.syncSlotOffsets(nodeId)
}))

import { useVueElementTracking } from './useVueNodeResizeTracking'

function createResizeEntry(options?: {
  element?: HTMLElement
  nodeId?: NodeId
  width?: number
  height?: number
  left?: number
  top?: number
  collapsed?: boolean
}) {
  const {
    element = document.createElement('div'),
    nodeId = toNodeId('test-node'),
    width = 240,
    height = 180,
    left = 100,
    top = 200,
    collapsed = false
  } = options ?? {}

  element.dataset.nodeId = String(nodeId)
  if (collapsed) {
    element.dataset.collapsed = ''
  }
  const rectSpy = vi.fn(() => new DOMRect(left, top, width, height))
  element.getBoundingClientRect = rectSpy
  const boxSizes = [{ inlineSize: width, blockSize: height }]

  const entry = {
    target: element,
    borderBoxSize: boxSizes,
    contentBoxSize: boxSizes,
    devicePixelContentBoxSize: boxSizes,
    contentRect: new DOMRect(left, top, width, height)
  } satisfies ResizeEntryLike

  return {
    entry,
    rectSpy
  }
}

function createObserverMock(): ResizeObserver {
  return {
    observe: vi.fn(),
    unobserve: vi.fn(),
    disconnect: vi.fn()
  }
}

function seedNodeLayout(options: {
  nodeId: NodeId
  left: number
  top: number
  width: number
  height: number
}) {
  const { nodeId, left, top, width, height } = options
  const titleHeight = LiteGraph.NODE_TITLE_HEIGHT
  const contentHeight = height - titleHeight

  testState.nodeLayouts.set(nodeId, {
    id: nodeId,
    position: { x: left, y: top + titleHeight },
    size: { width, height: contentHeight },
    zIndex: 0,
    visible: true,
    bounds: {
      x: left,
      y: top + titleHeight,
      width,
      height: contentHeight
    }
  })
}

describe('useVueNodeResizeTracking', () => {
  beforeEach(() => {
    testState.linearMode = false
    testState.rootGraphId = ROOT_GRAPH_ID
    if (testState.visibility) testState.visibility.value = 'visible'
    testState.nodeLayouts.clear()
    testState.contentSizes.clear()
  })

  it('skips repeated changed-size deliveries after reporting the change', () => {
    const nodeId = toNodeId('changed-size-node')
    const element = document.createElement('div')
    seedNodeLayout({ nodeId, left: 100, top: 200, width: 240, height: 180 })

    const initial = createResizeEntry({ element, nodeId }).entry
    resizeObserverState.callback?.([initial], createObserverMock())

    const changed = createResizeEntry({
      element,
      nodeId,
      width: 241,
      height: 181
    }).entry
    resizeObserverState.callback?.([changed], createObserverMock())
    vi.clearAllMocks()

    resizeObserverState.callback?.([changed], createObserverMock())

    expect(testState.reportContentSize).not.toHaveBeenCalled()
    expect(testState.syncSlotOffsets).not.toHaveBeenCalled()
  })

  it('reports a fresh measurement after root workflow replacement', () => {
    const nodeId = toNodeId('same-local-node-id')
    const { entry } = createResizeEntry({ nodeId })
    seedNodeLayout({ nodeId, left: 100, top: 200, width: 240, height: 180 })

    resizeObserverState.callback?.([entry], createObserverMock())
    vi.clearAllMocks()
    testState.rootGraphId = SECOND_GRAPH_ID

    resizeObserverState.callback?.([entry], createObserverMock())

    expect(testState.reportContentSize).toHaveBeenCalledWith(
      SECOND_GRAPH_ID,
      nodeId,
      {
        width: 240,
        height: 180 - LiteGraph.NODE_TITLE_HEIGHT
      }
    )
    expect(testState.syncSlotOffsets).toHaveBeenCalledWith(nodeId)
  })

  it('remounts root-flat node identities during same-root subgraph navigation', async () => {
    const rootNodeId = toNodeId('root-node')
    const subgraphNodeId = toNodeId('subgraph-node')
    const activeNodeId = ref(rootNodeId)
    const TrackedNode = defineComponent({
      props: { nodeId: { type: String, required: true } },
      setup(props) {
        useVueElementTracking(props.nodeId, 'node')
        return () => h('div', { 'data-testid': 'tracked-node' })
      }
    })
    const GraphView = defineComponent({
      setup() {
        return () =>
          h(TrackedNode, {
            key: activeNodeId.value,
            nodeId: activeNodeId.value
          })
      }
    })
    const view = render(GraphView)
    const rootElement = screen.getByTestId('tracked-node')

    vi.clearAllMocks()
    testState.contentSizes.clear()
    activeNodeId.value = subgraphNodeId
    await nextTick()

    const subgraphElement = screen.getByTestId('tracked-node')
    expect(subgraphElement).not.toBe(rootElement)
    expect(resizeObserverState.unobserve).toHaveBeenCalledWith(rootElement)
    expect(resizeObserverState.observe).toHaveBeenCalledWith(subgraphElement)

    seedNodeLayout({
      nodeId: subgraphNodeId,
      left: 100,
      top: 200,
      width: 240,
      height: 180
    })
    const { entry } = createResizeEntry({
      element: subgraphElement,
      nodeId: subgraphNodeId
    })
    resizeObserverState.callback?.([entry], createObserverMock())

    expect(testState.rootGraphId).toBe(ROOT_GRAPH_ID)
    expect(testState.reportContentSize).toHaveBeenCalledWith(
      ROOT_GRAPH_ID,
      subgraphNodeId,
      {
        width: 240,
        height: 180 - LiteGraph.NODE_TITLE_HEIGHT
      }
    )
    view.unmount()
  })

  it('reports a fresh measurement after same-root graph reconfiguration', () => {
    const nodeId = toNodeId('undo-redo-node')
    const { entry } = createResizeEntry({ nodeId })
    seedNodeLayout({ nodeId, left: 100, top: 200, width: 240, height: 180 })

    resizeObserverState.callback?.([entry], createObserverMock())
    vi.clearAllMocks()
    testState.contentSizes.clear()

    resizeObserverState.callback?.([entry], createObserverMock())

    expect(testState.reportContentSize).toHaveBeenCalledWith(
      ROOT_GRAPH_ID,
      nodeId,
      {
        width: 240,
        height: 180 - LiteGraph.NODE_TITLE_HEIGHT
      }
    )
    expect(testState.syncSlotOffsets).toHaveBeenCalledWith(nodeId)
  })

  it('defers hidden entries and re-observes connected elements when visible', async () => {
    const nodeId = toNodeId('hidden-node')
    const { entry } = createResizeEntry({ nodeId })
    document.body.append(entry.target)
    seedNodeLayout({ nodeId, left: 100, top: 200, width: 240, height: 180 })
    if (!testState.visibility) throw new Error('visibility ref not initialized')

    resizeObserverState.callback?.([entry], createObserverMock())
    expect(testState.reportContentSize).toHaveBeenCalledTimes(1)
    vi.clearAllMocks()

    testState.visibility.value = 'hidden'
    await nextTick()
    resizeObserverState.callback?.([entry], createObserverMock())

    expect(resizeObserverState.unobserve).toHaveBeenCalledWith(entry.target)
    expect(testState.reportContentSize).not.toHaveBeenCalled()
    expect(testState.syncSlotOffsets).not.toHaveBeenCalled()

    vi.clearAllMocks()
    testState.visibility.value = 'visible'
    await nextTick()

    expect(resizeObserverState.observe).toHaveBeenCalledWith(entry.target)

    vi.clearAllMocks()
    resizeObserverState.callback?.([entry], createObserverMock())
    expect(testState.reportContentSize).toHaveBeenCalledWith(
      ROOT_GRAPH_ID,
      nodeId,
      {
        width: 240,
        height: 180 - LiteGraph.NODE_TITLE_HEIGHT
      }
    )
    expect(testState.syncSlotOffsets).toHaveBeenCalledWith(nodeId)
    entry.target.remove()
  })

  it('observes on mount and removes identity before unobserving on unmount', () => {
    const nodeId = toNodeId('mounted-node')
    const Component = defineComponent({
      setup() {
        useVueElementTracking(nodeId, 'node')
        return () => h('div', { 'data-testid': 'tracked-node' })
      }
    })

    const view = render(Component)
    const element = screen.getByTestId('tracked-node')

    expect(element.dataset.nodeId).toBe(nodeId)
    expect(resizeObserverState.observe).toHaveBeenCalledWith(element)

    view.unmount()

    expect(element.dataset.nodeId).toBeUndefined()
    expect(resizeObserverState.unobserve).toHaveBeenCalledWith(element)

    vi.clearAllMocks()
    const boxSizes = [{ inlineSize: 240, blockSize: 180 }]
    resizeObserverState.callback?.(
      [
        {
          target: element,
          borderBoxSize: boxSizes,
          contentBoxSize: boxSizes,
          devicePixelContentBoxSize: boxSizes,
          contentRect: new DOMRect(0, 0, 240, 180)
        }
      ],
      createObserverMock()
    )
    expect(testState.reportContentSize).not.toHaveBeenCalled()
  })

  it('reports the first measurement and skips repeated entries', () => {
    const nodeId = toNodeId('test-node')
    const width = 240
    const height = 180
    const left = 100
    const top = 200
    const { entry, rectSpy } = createResizeEntry({
      nodeId,
      width,
      height,
      left,
      top
    })

    seedNodeLayout({ nodeId, left, top, width, height })

    resizeObserverState.callback?.([entry], createObserverMock())

    // When layout store already has correct position, getBoundingClientRect
    // is not needed — position is read from the store instead.
    expect(rectSpy).not.toHaveBeenCalled()
    expect(testState.reportContentSize).toHaveBeenCalledWith(
      ROOT_GRAPH_ID,
      nodeId,
      {
        width,
        height: height - LiteGraph.NODE_TITLE_HEIGHT
      }
    )
    testState.reportContentSize.mockReset()

    resizeObserverState.callback?.([entry], createObserverMock())

    expect(rectSpy).not.toHaveBeenCalled()
    expect(testState.reportContentSize).not.toHaveBeenCalled()
  })

  it('reports size without replacing the stored position', () => {
    const nodeId = toNodeId('test-node')
    const width = 240
    const height = 180
    const { entry, rectSpy } = createResizeEntry({
      nodeId,
      width,
      height,
      left: 100,
      top: 200
    })

    seedNodeLayout({
      nodeId,
      left: 90,
      top: 190,
      width,
      height
    })

    resizeObserverState.callback?.([entry], createObserverMock())

    // Position from DOM should NOT override layout store position
    expect(rectSpy).not.toHaveBeenCalled()
    expect(testState.reportContentSize).toHaveBeenCalledWith(
      ROOT_GRAPH_ID,
      nodeId,
      {
        width,
        height: height - LiteGraph.NODE_TITLE_HEIGHT
      }
    )
  })

  it('updates node bounds when size changes', () => {
    const nodeId = toNodeId('test-node')
    const { entry } = createResizeEntry({
      nodeId,
      width: 240,
      height: 180,
      left: 100,
      top: 200
    })
    const titleHeight = LiteGraph.NODE_TITLE_HEIGHT

    seedNodeLayout({
      nodeId,
      left: 100,
      top: 200,
      width: 220,
      height: 140
    })

    resizeObserverState.callback?.([entry], createObserverMock())

    expect(testState.reportContentSize).toHaveBeenCalledWith(
      ROOT_GRAPH_ID,
      nodeId,
      {
        width: 240,
        height: 180 - titleHeight
      }
    )
  })

  it('writes collapsed dimensions through the normal bounds path', () => {
    const nodeId = toNodeId('test-node')
    const collapsedWidth = 200
    const collapsedHeight = 40
    const { entry } = createResizeEntry({
      nodeId,
      width: collapsedWidth,
      height: collapsedHeight,
      left: 100,
      top: 200,
      collapsed: true
    })
    const titleHeight = LiteGraph.NODE_TITLE_HEIGHT

    // Seed with larger expanded size so the collapsed write is a real change
    seedNodeLayout({ nodeId, left: 100, top: 200, width: 240, height: 180 })

    resizeObserverState.callback?.([entry], createObserverMock())

    expect(testState.reportContentSize).toHaveBeenCalledWith(
      ROOT_GRAPH_ID,
      nodeId,
      {
        width: collapsedWidth,
        height: Math.max(0, collapsedHeight - titleHeight)
      }
    )
  })

  it('updates bounds with expanded dimensions on collapse-to-expand transition', () => {
    const nodeId = toNodeId('test-node')

    // Seed with smaller (collapsed) size so expand triggers a real bounds update
    seedNodeLayout({ nodeId, left: 100, top: 200, width: 200, height: 10 })

    const { entry } = createResizeEntry({
      nodeId,
      width: 240,
      height: 180,
      left: 100,
      top: 200
    })
    resizeObserverState.callback?.([entry], createObserverMock())

    expect(testState.reportContentSize).toHaveBeenCalled()
  })

  it('refreshes slot offsets when the widget grid resizes', () => {
    const nodeId = toNodeId('test-node')
    const { entry } = createResizeEntry({ nodeId })
    entry.target.removeAttribute('data-node-id')
    if (entry.target instanceof HTMLElement) {
      entry.target.dataset.widgetsGridNodeId = String(nodeId)
    }

    resizeObserverState.callback?.([entry], createObserverMock())

    expect(testState.syncSlotOffsets).toHaveBeenCalledWith(nodeId)
    expect(testState.reportContentSize).not.toHaveBeenCalled()
  })
})
