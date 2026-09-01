import { beforeEach, describe, expect, it, vi } from 'vitest'

import type { LGraph, LGraphNode } from '@/lib/litegraph/src/litegraph'

const viewport = [0, 0, 900, 700] as const
const { canvasStore, createCanvas } = vi.hoisted(() => {
  function createCanvas() {
    const canvas = {
      graph: undefined as unknown,
      subgraph: undefined as unknown,
      setGraph: vi.fn(),
      animateToBounds: vi.fn()
    }
    canvas.setGraph.mockImplementation((graph) => {
      canvas.graph = graph
    })
    return canvas
  }

  return {
    canvasStore: {
      canvas: createCanvas() as ReturnType<typeof createCanvas> | undefined
    },
    createCanvas
  }
})

vi.mock('@/renderer/core/canvas/canvasStore', () => ({
  useCanvasStore: () => canvasStore
}))
vi.mock('@/composables/canvas/visibleCanvasViewport', () => ({
  visibleCanvasViewport: () => viewport
}))
vi.mock('@/scripts/app', () => ({ app: { rootGraph: {} } }))

import { useFocusNode } from './useFocusNode'

describe('useFocusNode', () => {
  let animationFrames: FrameRequestCallback[]

  beforeEach(() => {
    canvasStore.canvas = createCanvas()
    animationFrames = []
    vi.stubGlobal('requestAnimationFrame', (callback: FrameRequestCallback) => {
      return animationFrames.push(callback)
    })
  })

  function finishNavigationFrames() {
    animationFrames.shift()?.(0)
    animationFrames.shift()?.(0)
  }

  it('opens the node graph and frames it inside the visible canvas', async () => {
    const graph = { isRootGraph: false } as LGraph
    const bounds = [10, 20, 30, 40] as const
    const node = { graph, boundingRect: bounds } as unknown as LGraphNode
    const focusPromise = useFocusNode().focusNodeInstance(node)

    await vi.waitFor(() => expect(animationFrames).toHaveLength(1))
    finishNavigationFrames()
    await focusPromise

    expect(canvasStore.canvas!.subgraph).toBe(graph)
    expect(canvasStore.canvas!.setGraph).toHaveBeenCalledWith(graph)
    expect(canvasStore.canvas!.animateToBounds).toHaveBeenCalledWith(bounds, {
      viewport
    })
  })

  it('does not animate a canvas replaced during navigation', async () => {
    const graph = { isRootGraph: false } as LGraph
    const node = {
      graph,
      boundingRect: [10, 20, 30, 40]
    } as unknown as LGraphNode
    const staleCanvas = canvasStore.canvas!
    const focusPromise = useFocusNode().focusNodeInstance(node)

    await vi.waitFor(() => expect(animationFrames).toHaveLength(1))
    const replacementCanvas = createCanvas()
    replacementCanvas.graph = graph
    canvasStore.canvas = replacementCanvas
    finishNavigationFrames()
    await focusPromise

    expect(staleCanvas.animateToBounds).not.toHaveBeenCalled()
    expect(replacementCanvas.animateToBounds).toHaveBeenCalledWith(
      node.boundingRect,
      { viewport }
    )
  })

  it('does not animate when the canvas becomes unavailable', async () => {
    const graph = { isRootGraph: false } as LGraph
    const node = {
      graph,
      boundingRect: [10, 20, 30, 40]
    } as unknown as LGraphNode
    const staleCanvas = canvasStore.canvas!
    const focusPromise = useFocusNode().focusNodeInstance(node)

    await vi.waitFor(() => expect(animationFrames).toHaveLength(1))
    canvasStore.canvas = undefined
    finishNavigationFrames()
    await focusPromise

    expect(staleCanvas.animateToBounds).not.toHaveBeenCalled()
  })

  it('does not animate when a competing navigation changes the graph', async () => {
    const graph = { isRootGraph: false } as LGraph
    const competingGraph = { isRootGraph: true } as LGraph
    const node = {
      graph,
      boundingRect: [10, 20, 30, 40]
    } as unknown as LGraphNode
    const focusPromise = useFocusNode().focusNodeInstance(node)

    await vi.waitFor(() => expect(animationFrames).toHaveLength(1))
    canvasStore.canvas!.graph = competingGraph
    finishNavigationFrames()
    await focusPromise

    expect(canvasStore.canvas!.animateToBounds).not.toHaveBeenCalled()
  })

  it('uses the same viewport-aware path for an execution-id lookup', async () => {
    const graph = { isRootGraph: true } as LGraph
    const node = {
      graph,
      boundingRect: [1, 2, 3, 4]
    } as unknown as LGraphNode
    canvasStore.canvas!.graph = graph

    await useFocusNode().focusNode('node-1', new Map([['node-1', node]]))

    expect(canvasStore.canvas!.setGraph).not.toHaveBeenCalled()
    expect(canvasStore.canvas!.animateToBounds).toHaveBeenCalledWith(
      node.boundingRect,
      { viewport }
    )
  })
})
