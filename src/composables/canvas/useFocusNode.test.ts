import { fromAny } from '@total-typescript/shoehorn'
import { beforeEach, describe, expect, it, vi } from 'vitest'

import { useFocusNode } from '@/composables/canvas/useFocusNode'
import type { LGraphNode } from '@/lib/litegraph/src/litegraph'

type Graph = {
  isRootGraph: boolean
}

type FocusableNode = {
  graph?: Graph
  boundingRect: DOMRect
}

const { appState, canvasStore, getNodeByExecutionId } = vi.hoisted(() => ({
  appState: {
    rootGraph: { isRootGraph: true }
  },
  canvasStore: {
    canvas: undefined as
      | undefined
      | {
          graph: Graph
          subgraph?: Graph
          setGraph: ReturnType<typeof vi.fn>
          animateToBounds: ReturnType<typeof vi.fn>
        }
  },
  getNodeByExecutionId: vi.fn()
}))

vi.mock('@/renderer/core/canvas/canvasStore', () => ({
  useCanvasStore: () => canvasStore
}))

vi.mock('@/scripts/app', () => ({
  app: appState
}))

vi.mock('@/utils/graphTraversalUtil', () => ({
  getNodeByExecutionId
}))

beforeEach(() => {
  getNodeByExecutionId.mockReset()
  vi.stubGlobal(
    'requestAnimationFrame',
    (callback: FrameRequestCallback): number => {
      callback(0)
      return 1
    }
  )
  canvasStore.canvas = {
    graph: appState.rootGraph,
    setGraph: vi.fn(),
    animateToBounds: vi.fn()
  }
})

describe('useFocusNode', () => {
  it('does nothing when there is no canvas or matching graph node', async () => {
    canvasStore.canvas = undefined
    await useFocusNode().focusNode('node-1')

    expect(getNodeByExecutionId).not.toHaveBeenCalled()

    canvasStore.canvas = {
      graph: appState.rootGraph,
      setGraph: vi.fn(),
      animateToBounds: vi.fn()
    }
    getNodeByExecutionId.mockReturnValue({ boundingRect: new DOMRect() })

    await useFocusNode().focusNode('node-1')

    expect(canvasStore.canvas.animateToBounds).not.toHaveBeenCalled()
  })

  it('navigates to the node graph before focusing its bounds', async () => {
    const subgraph = { isRootGraph: false }
    const bounds = new DOMRect(1, 2, 3, 4)
    getNodeByExecutionId.mockReturnValue({
      graph: subgraph,
      boundingRect: bounds
    } satisfies FocusableNode)

    await useFocusNode().focusNode('node-1')

    expect(getNodeByExecutionId).toHaveBeenCalledWith(
      appState.rootGraph,
      'node-1'
    )
    expect(canvasStore.canvas?.subgraph).toBe(subgraph)
    expect(canvasStore.canvas?.setGraph).toHaveBeenCalledWith(subgraph)
    expect(canvasStore.canvas?.animateToBounds).toHaveBeenCalledWith(bounds)
  })

  it('uses an execution id map and skips graph navigation when already there', async () => {
    const graph = { isRootGraph: true }
    const bounds = new DOMRect(5, 6, 7, 8)
    canvasStore.canvas = {
      graph,
      setGraph: vi.fn(),
      animateToBounds: vi.fn()
    }
    const node = { graph, boundingRect: bounds } satisfies FocusableNode

    await useFocusNode().focusNode(
      'node-1',
      new Map([['node-1', fromAny<LGraphNode, unknown>(node)]])
    )

    expect(getNodeByExecutionId).not.toHaveBeenCalled()
    expect(canvasStore.canvas.setGraph).not.toHaveBeenCalled()
    expect(canvasStore.canvas.animateToBounds).toHaveBeenCalledWith(bounds)
  })
})
