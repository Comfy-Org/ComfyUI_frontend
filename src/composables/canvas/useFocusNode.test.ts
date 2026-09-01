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

  const canvasStore: {
    canvas: ReturnType<typeof createCanvas> | undefined
  } = { canvas: createCanvas() }
  return {
    canvasStore,
    createCanvas
  }
})
const navigateToGraph = vi.hoisted(() => vi.fn())
const animationFrame = vi.hoisted(() => vi.fn())

vi.mock('@/renderer/core/canvas/canvasStore', () => ({
  useCanvasStore: () => canvasStore
}))
vi.mock('@/composables/canvas/visibleCanvasViewport', () => ({
  visibleCanvasViewport: () => viewport
}))
vi.mock('@/scripts/app', () => ({ app: { rootGraph: {} } }))
vi.mock('@/stores/subgraphNavigationStore', () => ({
  useSubgraphNavigationStore: () => ({ navigateToGraph })
}))

import { useFocusNode } from './useFocusNode'

describe('useFocusNode', () => {
  let animationFrames: FrameRequestCallback[]

  beforeEach(() => {
    canvasStore.canvas = createCanvas()
    animationFrames = []
    navigateToGraph.mockReset()
    navigateToGraph.mockImplementation(async (graph: LGraph) => {
      canvasStore.canvas!.graph = graph
      return true
    })
    animationFrame.mockReset()
    animationFrame.mockImplementation((callback: FrameRequestCallback) => {
      return animationFrames.push(callback)
    })
    vi.stubGlobal('requestAnimationFrame', animationFrame)
  })

  async function finishNavigationFrames() {
    animationFrames.shift()?.(0)
    await vi.waitFor(() => expect(animationFrames).toHaveLength(1))
    animationFrames.shift()?.(0)
  }

  it('opens the node graph and frames it inside the visible canvas', async () => {
    const graph = { isRootGraph: false, nodes: [] } as unknown as LGraph
    const bounds = [10, 20, 30, 40] as const
    const node = { graph, boundingRect: bounds } as unknown as LGraphNode
    graph.nodes.push(node)
    const focusPromise = useFocusNode().focusNodeInstance(node)

    await vi.waitFor(() => expect(animationFrames).toHaveLength(1))
    await finishNavigationFrames()
    await focusPromise

    expect(navigateToGraph).toHaveBeenCalledWith(graph)
    expect(canvasStore.canvas!.setGraph).not.toHaveBeenCalled()
    expect(canvasStore.canvas!.animateToBounds).toHaveBeenCalledWith(bounds, {
      viewport
    })
  })

  it('does not animate a canvas replaced during navigation', async () => {
    const graph = { isRootGraph: false, nodes: [] } as unknown as LGraph
    const node = {
      graph,
      boundingRect: [10, 20, 30, 40]
    } as unknown as LGraphNode
    graph.nodes.push(node)
    const staleCanvas = canvasStore.canvas!
    const focusPromise = useFocusNode().focusNodeInstance(node)

    await vi.waitFor(() => expect(animationFrames).toHaveLength(1))
    const replacementCanvas = createCanvas()
    replacementCanvas.graph = graph
    canvasStore.canvas = replacementCanvas
    await finishNavigationFrames()
    await focusPromise

    expect(staleCanvas.animateToBounds).not.toHaveBeenCalled()
    expect(replacementCanvas.animateToBounds).toHaveBeenCalledWith(
      node.boundingRect,
      { viewport }
    )
  })

  it('does not animate when the canvas becomes unavailable', async () => {
    const graph = { isRootGraph: false, nodes: [] } as unknown as LGraph
    const node = {
      graph,
      boundingRect: [10, 20, 30, 40]
    } as unknown as LGraphNode
    graph.nodes.push(node)
    const staleCanvas = canvasStore.canvas!
    const focusPromise = useFocusNode().focusNodeInstance(node)

    await vi.waitFor(() => expect(animationFrames).toHaveLength(1))
    canvasStore.canvas = undefined
    await finishNavigationFrames()
    await focusPromise

    expect(staleCanvas.animateToBounds).not.toHaveBeenCalled()
  })

  it('does not animate when a competing navigation changes the graph', async () => {
    const graph = { isRootGraph: false, nodes: [] } as unknown as LGraph
    const competingGraph = { isRootGraph: true } as LGraph
    const node = {
      graph,
      boundingRect: [10, 20, 30, 40]
    } as unknown as LGraphNode
    graph.nodes.push(node)
    const focusPromise = useFocusNode().focusNodeInstance(node)

    await vi.waitFor(() => expect(animationFrames).toHaveLength(1))
    canvasStore.canvas!.graph = competingGraph
    await finishNavigationFrames()
    await focusPromise

    expect(canvasStore.canvas!.animateToBounds).not.toHaveBeenCalled()
  })

  it('uses the same viewport-aware path for an execution-id lookup', async () => {
    const graph = { isRootGraph: true, nodes: [] } as unknown as LGraph
    const node = {
      graph,
      boundingRect: [1, 2, 3, 4]
    } as unknown as LGraphNode
    graph.nodes.push(node)
    canvasStore.canvas!.graph = graph

    await useFocusNode().focusNode('node-1', new Map([['node-1', node]]))

    expect(canvasStore.canvas!.setGraph).not.toHaveBeenCalled()
    expect(canvasStore.canvas!.animateToBounds).toHaveBeenCalledWith(
      node.boundingRect,
      { viewport }
    )
  })

  it('does not frame when navigation is superseded', async () => {
    const graph = { isRootGraph: false, nodes: [] } as unknown as LGraph
    const node = {
      graph,
      boundingRect: [1, 2, 3, 4]
    } as unknown as LGraphNode
    graph.nodes.push(node)
    navigateToGraph.mockImplementation(async () => {
      canvasStore.canvas!.graph = graph
      return false
    })

    await useFocusNode().focusNodeInstance(node)

    expect(canvasStore.canvas!.animateToBounds).not.toHaveBeenCalled()
  })

  it('does not wait for animation frames when the graph is already active', async () => {
    const graph = { isRootGraph: true, nodes: [] } as unknown as LGraph
    const node = {
      graph,
      boundingRect: [1, 2, 3, 4]
    } as unknown as LGraphNode
    graph.nodes.push(node)
    canvasStore.canvas!.graph = graph
    await useFocusNode().focusNodeInstance(node)

    expect(animationFrame).not.toHaveBeenCalled()
    expect(canvasStore.canvas!.animateToBounds).toHaveBeenCalledOnce()
  })

  it('does not frame a node removed while navigation settles', async () => {
    const graph = { isRootGraph: false, nodes: [] } as unknown as LGraph
    const node = {
      graph,
      boundingRect: [1, 2, 3, 4]
    } as unknown as LGraphNode
    graph.nodes.push(node)
    navigateToGraph.mockImplementation(async () => {
      canvasStore.canvas!.graph = graph
      graph.nodes.length = 0
      return true
    })

    await useFocusNode().focusNodeInstance(node)

    expect(canvasStore.canvas!.animateToBounds).not.toHaveBeenCalled()
  })

  it('does not frame when the canvas is torn down during navigation', async () => {
    const graph = { isRootGraph: false, nodes: [] } as unknown as LGraph
    const node = {
      graph,
      boundingRect: [1, 2, 3, 4]
    } as unknown as LGraphNode
    graph.nodes.push(node)
    const staleCanvas = canvasStore.canvas!
    navigateToGraph.mockImplementation(async () => {
      canvasStore.canvas = undefined
      return true
    })
    const focusPromise = useFocusNode().focusNodeInstance(node)

    await vi.waitFor(() => expect(animationFrames).toHaveLength(1))
    await finishNavigationFrames()
    await focusPromise

    expect(staleCanvas.animateToBounds).not.toHaveBeenCalled()
  })

  it('does not frame when navigation settles on another graph', async () => {
    const graph = { isRootGraph: false, nodes: [] } as unknown as LGraph
    const otherGraph = { isRootGraph: false, nodes: [] } as unknown as LGraph
    const node = {
      graph,
      boundingRect: [1, 2, 3, 4]
    } as unknown as LGraphNode
    graph.nodes.push(node)
    navigateToGraph.mockImplementation(async () => {
      canvasStore.canvas!.graph = otherGraph
      return true
    })
    const focusPromise = useFocusNode().focusNodeInstance(node)

    await vi.waitFor(() => expect(animationFrames).toHaveLength(1))
    await finishNavigationFrames()
    await focusPromise

    expect(canvasStore.canvas!.animateToBounds).not.toHaveBeenCalled()
  })
})
