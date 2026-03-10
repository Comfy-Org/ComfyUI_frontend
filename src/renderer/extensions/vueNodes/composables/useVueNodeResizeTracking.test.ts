import { beforeEach, describe, expect, it, vi } from 'vitest'
import { ref } from 'vue'

import { LiteGraph } from '@/lib/litegraph/src/litegraph'
import { LayoutSource } from '@/renderer/core/layout/types'

const resizeObserverState = vi.hoisted(() => {
  const state = {
    callback: null as ResizeObserverCallback | null,
    observe: vi.fn(),
    unobserve: vi.fn(),
    disconnect: vi.fn()
  }

  class MockResizeObserver {
    observe = state.observe
    unobserve = state.unobserve
    disconnect = state.disconnect

    constructor(callback: ResizeObserverCallback) {
      state.callback = callback
    }
  }

  globalThis.ResizeObserver =
    MockResizeObserver as unknown as typeof ResizeObserver

  return state
})

const testState = vi.hoisted(() => ({
  linearMode: false,
  nodeLayouts: new Map<
    string,
    {
      id: string
      position: { x: number; y: number }
      size: { width: number; height: number }
      zIndex: number
      visible: boolean
      bounds: { x: number; y: number; width: number; height: number }
    }
  >(),
  batchUpdateNodeBounds: vi.fn(),
  setSource: vi.fn(),
  syncNodeSlotLayoutsFromDOM: vi.fn()
}))

vi.mock('@vueuse/core', () => ({
  useDocumentVisibility: () => ref<'visible' | 'hidden'>('visible')
}))

vi.mock('@/renderer/core/canvas/canvasStore', () => ({
  useCanvasStore: () => ({
    linearMode: testState.linearMode
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
    setSource: testState.setSource,
    getNodeLayoutRef: (nodeId: string) => ref(testState.nodeLayouts.get(nodeId))
  }
}))

vi.mock('./useSlotElementTracking', () => ({
  syncNodeSlotLayoutsFromDOM: testState.syncNodeSlotLayoutsFromDOM
}))

import './useVueNodeResizeTracking'

function createResizeEntry(options?: {
  nodeId?: string
  width?: number
  height?: number
  left?: number
  top?: number
}) {
  const {
    nodeId = 'test-node',
    width = 240,
    height = 180,
    left = 100,
    top = 200
  } = options ?? {}

  const element = document.createElement('div')
  element.dataset.nodeId = nodeId
  element.getBoundingClientRect = vi.fn(
    () =>
      ({
        x: left,
        y: top,
        left,
        top,
        right: left + width,
        bottom: top + height,
        width,
        height,
        toJSON: () => ({})
      }) as DOMRect
  )

  return {
    target: element,
    borderBoxSize: [
      {
        inlineSize: width,
        blockSize: height
      }
    ],
    contentRect: {
      width,
      height
    }
  } as unknown as ResizeObserverEntry
}

describe('useVueNodeResizeTracking', () => {
  beforeEach(() => {
    testState.linearMode = false
    testState.nodeLayouts.clear()
    testState.batchUpdateNodeBounds.mockReset()
    testState.setSource.mockReset()
    testState.syncNodeSlotLayoutsFromDOM.mockReset()
  })

  it('skips node bounds + slot resync for no-op resize entries', () => {
    const nodeId = 'test-node'
    const width = 240
    const height = 180
    const left = 100
    const top = 200
    const titleHeight = LiteGraph.NODE_TITLE_HEIGHT

    testState.nodeLayouts.set(nodeId, {
      id: nodeId,
      position: { x: left, y: top + titleHeight },
      size: { width, height: height - titleHeight },
      zIndex: 0,
      visible: true,
      bounds: {
        x: left,
        y: top + titleHeight,
        width,
        height: height - titleHeight
      }
    })

    resizeObserverState.callback?.(
      [createResizeEntry({ nodeId })],
      {} as ResizeObserver
    )

    expect(testState.setSource).not.toHaveBeenCalled()
    expect(testState.batchUpdateNodeBounds).not.toHaveBeenCalled()
    expect(testState.syncNodeSlotLayoutsFromDOM).not.toHaveBeenCalled()
  })

  it('updates node bounds + slot layouts when geometry changes', () => {
    const nodeId = 'test-node'
    const titleHeight = LiteGraph.NODE_TITLE_HEIGHT

    testState.nodeLayouts.set(nodeId, {
      id: nodeId,
      position: { x: 100, y: 200 + titleHeight },
      size: { width: 220, height: 140 - titleHeight },
      zIndex: 0,
      visible: true,
      bounds: {
        x: 100,
        y: 200 + titleHeight,
        width: 220,
        height: 140 - titleHeight
      }
    })

    resizeObserverState.callback?.(
      [
        createResizeEntry({
          nodeId,
          width: 240,
          height: 180,
          left: 100,
          top: 200
        })
      ],
      {} as ResizeObserver
    )

    expect(testState.setSource).toHaveBeenCalledWith(LayoutSource.DOM)
    expect(testState.batchUpdateNodeBounds).toHaveBeenCalledWith([
      {
        nodeId,
        bounds: {
          x: 100,
          y: 200 + titleHeight,
          width: 240,
          height: 180
        }
      }
    ])
    expect(testState.syncNodeSlotLayoutsFromDOM).toHaveBeenCalledWith(nodeId)
  })
})
