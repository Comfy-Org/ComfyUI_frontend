import { beforeEach, describe, expect, it, vi } from 'vitest'

import type { LGraph, LGraphNode } from '@/lib/litegraph/src/litegraph'

const viewport = [0, 0, 900, 700] as const
const canvas = vi.hoisted(() => ({
  graph: undefined as unknown,
  subgraph: undefined as unknown,
  setGraph: vi.fn(),
  animateToBounds: vi.fn()
}))
const canvasHolder = vi.hoisted(() => ({ current: null as unknown }))

vi.mock('@/renderer/core/canvas/canvasStore', () => ({
  useCanvasStore: () => ({
    get canvas() {
      return canvasHolder.current
    }
  })
}))
vi.mock('@/composables/canvas/visibleCanvasViewport', () => ({
  visibleCanvasViewport: () => viewport
}))
vi.mock('@/scripts/app', () => ({ app: { rootGraph: {} } }))

import { useFocusNode } from './useFocusNode'

describe('useFocusNode', () => {
  beforeEach(() => {
    canvasHolder.current = canvas
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

  it('frames without switching graphs when the node is already current', async () => {
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

  it('exits a subgraph to focus a root-graph node', async () => {
    const rootGraph = { isRootGraph: true } as LGraph
    const subgraph = { isRootGraph: false } as LGraph
    const node = {
      graph: rootGraph,
      boundingRect: [5, 6, 7, 8]
    } as unknown as LGraphNode
    canvas.graph = subgraph
    canvas.subgraph = subgraph

    await useFocusNode().focusNode('node-1', new Map([['node-1', node]]))

    expect(canvas.subgraph).toBeUndefined()
    expect(canvas.setGraph).toHaveBeenCalledWith(rootGraph)
    expect(canvas.animateToBounds).toHaveBeenCalledWith(node.boundingRect, {
      viewport
    })
  })

  it('does nothing when the id misses the execution-id map', async () => {
    await useFocusNode().focusNode('missing', new Map())

    expect(canvas.setGraph).not.toHaveBeenCalled()
    expect(canvas.animateToBounds).not.toHaveBeenCalled()
  })

  it('does not frame when the canvas disappears across the graph switch', async () => {
    const graph = { isRootGraph: false } as LGraph
    const node = {
      graph,
      boundingRect: [1, 2, 3, 4]
    } as unknown as LGraphNode

    const pending = useFocusNode().focusNode(
      'node-1',
      new Map([['node-1', node]])
    )
    // The workflow was torn down while the switch was in flight: the
    // post-await re-read must see the gone canvas and frame nothing.
    canvasHolder.current = null
    await pending

    // The switch itself ran (the path is not vacuous) - only framing stops.
    expect(canvas.setGraph).toHaveBeenCalled()
    expect(canvas.animateToBounds).not.toHaveBeenCalled()
  })
})
