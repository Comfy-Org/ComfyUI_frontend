import { beforeEach, describe, expect, it, vi } from 'vitest'

import type { LGraph, LGraphNode } from '@/lib/litegraph/src/litegraph'

const viewport = [0, 0, 900, 700] as const
const canvas = vi.hoisted(() => ({
  graph: undefined as unknown,
  subgraph: undefined as unknown,
  setGraph: vi.fn(),
  animateToBounds: vi.fn()
}))

vi.mock('@/renderer/core/canvas/canvasStore', () => ({
  useCanvasStore: () => ({ canvas })
}))
vi.mock('@/composables/canvas/visibleCanvasViewport', () => ({
  visibleCanvasViewport: () => viewport
}))
vi.mock('@/scripts/app', () => ({ app: { rootGraph: {} } }))

import { useFocusNode } from './useFocusNode'

describe('useFocusNode', () => {
  beforeEach(() => {
    canvas.graph = undefined
    canvas.subgraph = undefined
    canvas.setGraph.mockReset()
    canvas.animateToBounds.mockReset()
    vi.stubGlobal('requestAnimationFrame', (callback: FrameRequestCallback) => {
      callback(0)
      return 0
    })
  })

  it('opens the node graph and frames it inside the visible canvas', async () => {
    const graph = { isRootGraph: false } as LGraph
    const bounds = [10, 20, 30, 40] as const
    const node = { graph, boundingRect: bounds } as unknown as LGraphNode

    await useFocusNode().focusNode('node-1', new Map([['node-1', node]]))

    expect(canvas.subgraph).toBe(graph)
    expect(canvas.setGraph).toHaveBeenCalledWith(graph)
    expect(canvas.animateToBounds).toHaveBeenCalledWith(bounds, {
      viewport
    })
  })

  it('uses the same viewport-aware path for an execution-id lookup', async () => {
    const graph = { isRootGraph: true } as LGraph
    const node = {
      graph,
      boundingRect: [1, 2, 3, 4]
    } as unknown as LGraphNode
    canvas.graph = graph

    await useFocusNode().focusNode('node-1', new Map([['node-1', node]]))

    expect(canvas.setGraph).not.toHaveBeenCalled()
    expect(canvas.animateToBounds).toHaveBeenCalledWith(node.boundingRect, {
      viewport
    })
  })
})
