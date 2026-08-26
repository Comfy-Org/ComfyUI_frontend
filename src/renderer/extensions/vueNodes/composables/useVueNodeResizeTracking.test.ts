import { render, screen } from '@testing-library/vue'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { defineComponent, nextTick, ref } from 'vue'

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

const testState = vi.hoisted(() => ({
  linearMode: false,
  nodeLayouts: new Map<NodeId, NodeLayout>(),
  reportContentSize: vi.fn(),
  updateNodeSlotOffsets: vi.fn()
}))

vi.mock('@vueuse/core', () => ({
  useDocumentVisibility: () => ref<'visible' | 'hidden'>('visible'),
  createSharedComposable: <T>(fn: T) => fn
}))

vi.mock('@/renderer/core/canvas/canvasStore', () => ({
  useCanvasStore: () => ({
    linearMode: testState.linearMode,
    rootGraphId: ROOT_GRAPH_ID
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
    updateNodeSlotOffsets: testState.updateNodeSlotOffsets,
    getNodeLayout: (_rootGraphId: UUID, rawNodeId: NodeId): NodeLayout | null =>
      testState.nodeLayouts.get(rawNodeId) ?? null
  }
}))

import { useVueElementTracking } from './useVueNodeResizeTracking'

function createResizeEntry(options?: {
  nodeId?: NodeId
  width?: number
  height?: number
  left?: number
  top?: number
  collapsed?: boolean
}) {
  const {
    nodeId = toNodeId('test-node'),
    width = 240,
    height = 180,
    left = 100,
    top = 200,
    collapsed = false
  } = options ?? {}

  const element = document.createElement('div')
  element.dataset.nodeId = String(nodeId)
  document.body.appendChild(element)
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
    testState.nodeLayouts.clear()
  })

  afterEach(() => {
    document.body.replaceChildren()
  })

  it('ignores resize entries emitted after a node is detached', () => {
    const nodeId = toNodeId('test-node')
    const { entry } = createResizeEntry({ nodeId, width: 0, height: 0 })
    seedNodeLayout({
      nodeId,
      left: 100,
      top: 200,
      width: 240,
      height: 180
    })
    entry.target.remove()

    resizeObserverState.callback?.([entry], createObserverMock())

    expect(testState.reportContentSize).not.toHaveBeenCalled()
    expect(testState.updateNodeSlotOffsets).not.toHaveBeenCalled()
  })

  it('observes only while a KeepAlive node is active', async () => {
    const active = ref(true)
    const TrackedNode = defineComponent({
      setup() {
        useVueElementTracking('tracked-node', 'node')
      },
      template: '<div data-testid="tracked-node" />'
    })
    const Parent = defineComponent({
      components: { TrackedNode },
      setup: () => ({ active }),
      template: '<KeepAlive><TrackedNode v-if="active" /></KeepAlive>'
    })
    render(Parent)
    const element = screen.getByTestId('tracked-node')
    await nextTick()

    expect(resizeObserverState.observe).toHaveBeenCalledWith(element)

    active.value = false
    await nextTick()
    expect(resizeObserverState.unobserve).toHaveBeenCalledWith(element)

    active.value = true
    await nextTick()
    expect(resizeObserverState.observe).toHaveBeenCalledTimes(2)
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

    expect(testState.updateNodeSlotOffsets).toHaveBeenCalledWith(
      ROOT_GRAPH_ID,
      nodeId,
      [],
      'expanded'
    )
    expect(testState.reportContentSize).not.toHaveBeenCalled()
  })
})
