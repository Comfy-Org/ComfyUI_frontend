import { beforeEach, describe, expect, it, vi } from 'vitest'
import { nextTick, ref } from 'vue'
import type { Ref } from 'vue'

import { LiteGraph } from '@/lib/litegraph/src/litegraph'
import { LayoutSource } from '@/renderer/core/layout/types'
import type { NodeId, NodeLayout } from '@/renderer/core/layout/types'
import { toNodeId } from '@/types/nodeId'
import type { UUID } from '@/utils/uuid'

const ROOT_GRAPH_ID = 'root-graph' as UUID

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

const testState = vi.hoisted(() => ({
  linearMode: false,
  rootGraphId: null as string | null,
  nodeLayouts: new Map<NodeId, NodeLayout>(),
  batchUpdateNodeBounds: vi.fn(),
  syncSlotOffsets: vi.fn()
}))

const visibilityState = vi.hoisted(() => ({
  ref: null as Ref<'visible' | 'hidden'> | null
}))

vi.mock('@vueuse/core', async () => {
  const { ref: vueRef } = await import('vue')
  visibilityState.ref = vueRef<'visible' | 'hidden'>('visible')
  return {
    useDocumentVisibility: () => visibilityState.ref,
    createSharedComposable: <T>(fn: T) => fn
  }
})

vi.mock('@/renderer/core/canvas/canvasStore', () => ({
  useCanvasStore: () => ({
    linearMode: testState.linearMode,
    rootGraphId: testState.rootGraphId
  })
}))

vi.mock('@/composables/element/useCanvasPositionConversion', () => ({
  useSharedCanvasPositionConversion: () => ({
    clientPosToCanvasPos: ([x, y]: [number, number]) => [x, y]
  })
}))

vi.mock('@/renderer/core/layout/store/layoutStore', () => ({
  layoutStore: {
    batchUpdateNodeBounds: testState.batchUpdateNodeBounds,
    getNodeLayoutRef: (
      _rootGraphId: UUID,
      nodeId: NodeId
    ): Ref<NodeLayout | null> =>
      ref<NodeLayout | null>(testState.nodeLayouts.get(nodeId) ?? null)
  }
}))

vi.mock('@/renderer/core/layout/slots/syncSlotOffsets', () => ({
  syncSlotOffsets: (
    _element: HTMLElement,
    _rootGraphId: UUID,
    nodeId: NodeId
  ) => testState.syncSlotOffsets(nodeId)
}))

const rafBatchState = vi.hoisted(() => ({
  pending: null as (() => void) | null,
  flush: () => {}
}))

vi.mock('@/utils/rafBatch', () => ({
  createRafBatch: (run: () => void) => {
    rafBatchState.flush = () => {
      if (!rafBatchState.pending) return
      rafBatchState.pending = null
      run()
    }
    return {
      schedule: () => {
        rafBatchState.pending = run
      },
      cancel: () => {
        rafBatchState.pending = null
      },
      flush: rafBatchState.flush,
      isScheduled: () => rafBatchState.pending != null
    }
  }
}))

import './useVueNodeResizeTracking'

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
  element.dataset.nodeId = nodeId
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
    testState.nodeLayouts.clear()
    testState.batchUpdateNodeBounds.mockReset()
    testState.syncSlotOffsets.mockReset()
    resizeObserverState.observe.mockReset()
    resizeObserverState.unobserve.mockReset()
    resizeObserverState.disconnect.mockReset()
    rafBatchState.pending = null
    if (visibilityState.ref) visibilityState.ref.value = 'visible'
  })

  it('skips repeated no-op resize entries after first measurement', () => {
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
    rafBatchState.flush()

    // When layout store already has correct position, getBoundingClientRect
    // is not needed — position is read from the store instead.
    expect(rectSpy).not.toHaveBeenCalled()
    expect(testState.batchUpdateNodeBounds).not.toHaveBeenCalled()
    expect(testState.syncSlotOffsets).not.toHaveBeenCalled()

    testState.batchUpdateNodeBounds.mockReset()
    testState.syncSlotOffsets.mockReset()

    resizeObserverState.callback?.([entry], createObserverMock())
    rafBatchState.flush()

    expect(rectSpy).not.toHaveBeenCalled()
    expect(testState.batchUpdateNodeBounds).not.toHaveBeenCalled()
    expect(testState.syncSlotOffsets).not.toHaveBeenCalled()
  })

  it('preserves layout store position when size matches but DOM position differs', () => {
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
    rafBatchState.flush()

    // Position from DOM should NOT override layout store position
    expect(rectSpy).not.toHaveBeenCalled()
    expect(testState.batchUpdateNodeBounds).not.toHaveBeenCalled()
  })

  it('updates node bounds + slot layouts when size changes', () => {
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
    rafBatchState.flush()

    expect(testState.batchUpdateNodeBounds).toHaveBeenCalledWith(
      ROOT_GRAPH_ID,
      [
        {
          nodeId,
          bounds: {
            x: 100,
            y: 200 + titleHeight,
            width: 240,
            height: 180
          }
        }
      ],
      { source: LayoutSource.Vue }
    )
    expect(testState.syncSlotOffsets).toHaveBeenCalledWith(nodeId)
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
    rafBatchState.flush()

    expect(testState.batchUpdateNodeBounds).toHaveBeenCalledWith(
      ROOT_GRAPH_ID,
      [
        {
          nodeId,
          bounds: {
            x: 100,
            y: 200 + titleHeight,
            width: collapsedWidth,
            height: collapsedHeight
          }
        }
      ],
      { source: LayoutSource.Vue }
    )
    expect(testState.syncSlotOffsets).toHaveBeenCalledWith(nodeId)
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
    rafBatchState.flush()

    expect(testState.batchUpdateNodeBounds).toHaveBeenCalled()
  })

  it('widgets-grid resize is observed as a signal only, without writing node bounds', () => {
    const parentNodeId: NodeId = toNodeId('parent-node')
    const element = document.createElement('div')
    element.dataset.widgetsGridNodeId = parentNodeId
    const boxSizes = [{ inlineSize: 200, blockSize: 80 }]
    const entry = {
      target: element,
      borderBoxSize: boxSizes,
      contentBoxSize: boxSizes,
      devicePixelContentBoxSize: boxSizes,
      contentRect: new DOMRect(0, 0, 200, 80)
    } satisfies ResizeEntryLike

    resizeObserverState.callback?.([entry], createObserverMock())
    rafBatchState.flush()

    // WidgetGrid.vue owns its own slot resync via its layoutKey watch; this
    // RO firing only keeps the element tracked, no downstream write happens.
    expect(testState.batchUpdateNodeBounds).not.toHaveBeenCalled()
    expect(testState.syncSlotOffsets).not.toHaveBeenCalled()
  })

  it('defers layoutStore writes until the next animation frame', () => {
    const nodeId = toNodeId('test-node')
    const { entry } = createResizeEntry({
      nodeId,
      width: 300,
      height: 200,
      left: 100,
      top: 200
    })
    seedNodeLayout({ nodeId, left: 100, top: 200, width: 220, height: 140 })

    resizeObserverState.callback?.([entry], createObserverMock())

    expect(testState.batchUpdateNodeBounds).not.toHaveBeenCalled()

    rafBatchState.flush()

    expect(testState.batchUpdateNodeBounds).toHaveBeenCalledTimes(1)
  })

  it('coalesces successive resizes for the same node into one write per frame', () => {
    const nodeId = toNodeId('test-node')
    const titleHeight = LiteGraph.NODE_TITLE_HEIGHT
    seedNodeLayout({ nodeId, left: 100, top: 200, width: 220, height: 140 })

    const intermediate = createResizeEntry({
      nodeId,
      width: 240,
      height: 160,
      left: 100,
      top: 200
    })
    const final = createResizeEntry({
      nodeId,
      width: 260,
      height: 180,
      left: 100,
      top: 200
    })
    final.entry.target = intermediate.entry.target

    resizeObserverState.callback?.([intermediate.entry], createObserverMock())
    resizeObserverState.callback?.([final.entry], createObserverMock())

    expect(testState.batchUpdateNodeBounds).not.toHaveBeenCalled()

    rafBatchState.flush()

    expect(testState.batchUpdateNodeBounds).toHaveBeenCalledTimes(1)
    expect(testState.batchUpdateNodeBounds).toHaveBeenCalledWith(
      ROOT_GRAPH_ID,
      [
        {
          nodeId,
          bounds: {
            x: 100,
            y: 200 + titleHeight,
            width: 260,
            height: 180
          }
        }
      ],
      { source: LayoutSource.Vue }
    )
    expect(testState.syncSlotOffsets).toHaveBeenCalledTimes(1)
  })

  it('re-defers pending measurements when the tab becomes hidden before flush', async () => {
    const nodeId = toNodeId('test-node')
    const { entry } = createResizeEntry({
      nodeId,
      width: 300,
      height: 200,
      left: 100,
      top: 200
    })
    document.body.appendChild(entry.target)
    seedNodeLayout({ nodeId, left: 100, top: 200, width: 220, height: 140 })

    try {
      resizeObserverState.callback?.([entry], createObserverMock())
      expect(testState.batchUpdateNodeBounds).not.toHaveBeenCalled()

      visibilityState.ref!.value = 'hidden'
      await nextTick()

      rafBatchState.flush()
      expect(testState.batchUpdateNodeBounds).not.toHaveBeenCalled()
      expect(resizeObserverState.unobserve).toHaveBeenCalledWith(entry.target)

      visibilityState.ref!.value = 'visible'
      await nextTick()

      expect(resizeObserverState.observe).toHaveBeenCalledWith(entry.target)
    } finally {
      entry.target.remove()
    }
  })
})
