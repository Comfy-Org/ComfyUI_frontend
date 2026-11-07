import { fromPartial } from '@total-typescript/shoehorn'
import { beforeEach, describe, expect, it, vi } from 'vitest'

import { LGraph, LGraphNode } from '@/lib/litegraph/src/litegraph'
import type { LGraphCanvas } from '@/lib/litegraph/src/litegraph'
import { useCanvasStore } from '@/renderer/core/canvas/canvasStore'
import { useSubgraphNavigationStore } from '@/stores/subgraphNavigationStore'

const viewport = [0, 0, 900, 700] as const
const routeHash = await vi.hoisted(async () => {
  const { ref } = await import('vue')
  return ref('')
})
function createCanvas() {
  const canvas = fromPartial<LGraphCanvas>({
    graph: null,
    subgraph: undefined,
    setGraph: vi.fn(),
    animateToBounds: vi.fn()
  })
  vi.mocked(canvas.setGraph).mockImplementation((graph) => {
    canvas.graph = graph
  })
  return canvas
}
let canvasStore: ReturnType<typeof useCanvasStore>
let navigationStore: ReturnType<typeof useSubgraphNavigationStore>
const animationFrame = vi.hoisted(() => vi.fn())

vi.mock(import('@/composables/canvas/visibleCanvasViewport'), () => ({
  visibleCanvasViewport: () => viewport
}))
vi.mock(import('@/scripts/app'))
vi.mock(import('@vueuse/router'), () => ({ useRouteHash: () => routeHash }))
vi.mock<unknown>(import('vue-router'), () => ({
  NavigationFailureType: { cancelled: 8, duplicated: 16 },
  isNavigationFailure: vi.fn(() => false),
  useRouter: () => ({
    push: vi.fn(),
    replace: vi.fn(),
    options: { history: { state: {} } }
  })
}))

import { useFocusNode } from './useFocusNode'

function createNode(bounds: readonly [number, number, number, number]) {
  const graph = new LGraph()
  const node = new LGraphNode('Test')
  node.pos = [bounds[0], bounds[1]]
  node.size = [bounds[2], bounds[3]]
  node.updateArea()
  graph.add(node)
  return { graph, node }
}

describe('useFocusNode', () => {
  let animationFrames: FrameRequestCallback[]

  beforeEach(() => {
    canvasStore = useCanvasStore()
    canvasStore.canvas = createCanvas()
    navigationStore = useSubgraphNavigationStore()
    animationFrames = []
    vi.mocked(navigationStore.navigateToGraph).mockReset()
    vi.mocked(navigationStore.navigateToGraph).mockImplementation(
      async (graph: LGraph) => {
        canvasStore.canvas!.graph = graph
        return true
      }
    )
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
    const { graph, node } = createNode([10, 20, 30, 40])
    const focusPromise = useFocusNode().focusNodeInstance(node)

    await vi.waitFor(() => expect(animationFrames).toHaveLength(1))
    await finishNavigationFrames()
    await focusPromise

    expect(navigationStore.navigateToGraph).toHaveBeenCalledWith(graph)
    expect(canvasStore.canvas!.setGraph).not.toHaveBeenCalled()
    expect(canvasStore.canvas!.animateToBounds).toHaveBeenCalledWith(
      node.boundingRect,
      { viewport }
    )
  })

  it('does not animate a canvas replaced during navigation', async () => {
    const { graph, node } = createNode([10, 20, 30, 40])
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
    const { node } = createNode([10, 20, 30, 40])
    const staleCanvas = canvasStore.canvas!
    const focusPromise = useFocusNode().focusNodeInstance(node)

    await vi.waitFor(() => expect(animationFrames).toHaveLength(1))
    canvasStore.canvas = null
    await finishNavigationFrames()
    await focusPromise

    expect(staleCanvas.animateToBounds).not.toHaveBeenCalled()
  })

  it('does not animate when a competing navigation changes the graph', async () => {
    const { node } = createNode([10, 20, 30, 40])
    const competingGraph = new LGraph()
    const focusPromise = useFocusNode().focusNodeInstance(node)

    await vi.waitFor(() => expect(animationFrames).toHaveLength(1))
    canvasStore.canvas!.graph = competingGraph
    await finishNavigationFrames()
    await focusPromise

    expect(canvasStore.canvas!.animateToBounds).not.toHaveBeenCalled()
  })

  it('uses the same viewport-aware path for an execution-id lookup', async () => {
    const { graph, node } = createNode([1, 2, 3, 4])
    canvasStore.canvas!.graph = graph

    await useFocusNode().focusNode('node-1', new Map([['node-1', node]]))

    expect(canvasStore.canvas!.setGraph).not.toHaveBeenCalled()
    expect(canvasStore.canvas!.animateToBounds).toHaveBeenCalledWith(
      node.boundingRect,
      { viewport }
    )
  })

  it('does not frame when navigation is superseded', async () => {
    const { graph, node } = createNode([1, 2, 3, 4])
    vi.mocked(navigationStore.navigateToGraph).mockImplementation(async () => {
      canvasStore.canvas!.graph = graph
      return false
    })

    await useFocusNode().focusNodeInstance(node)

    expect(canvasStore.canvas!.animateToBounds).not.toHaveBeenCalled()
  })

  it('does not wait for animation frames when the graph is already active', async () => {
    const { graph, node } = createNode([1, 2, 3, 4])
    canvasStore.canvas!.graph = graph
    await useFocusNode().focusNodeInstance(node)

    expect(animationFrame).not.toHaveBeenCalled()
    expect(canvasStore.canvas!.animateToBounds).toHaveBeenCalledOnce()
  })

  it('does not frame a node removed while navigation settles', async () => {
    const { graph, node } = createNode([1, 2, 3, 4])
    vi.mocked(navigationStore.navigateToGraph).mockImplementation(async () => {
      canvasStore.canvas!.graph = graph
      graph.remove(node)
      return true
    })

    await useFocusNode().focusNodeInstance(node)

    expect(canvasStore.canvas!.animateToBounds).not.toHaveBeenCalled()
  })

  it('does not frame when the canvas is torn down during navigation', async () => {
    const { node } = createNode([1, 2, 3, 4])
    const staleCanvas = canvasStore.canvas!
    vi.mocked(navigationStore.navigateToGraph).mockImplementation(async () => {
      canvasStore.canvas = null
      return true
    })
    const focusPromise = useFocusNode().focusNodeInstance(node)

    await vi.waitFor(() => expect(animationFrames).toHaveLength(1))
    await finishNavigationFrames()
    await focusPromise

    expect(staleCanvas.animateToBounds).not.toHaveBeenCalled()
  })

  it('does not frame when navigation settles on another graph', async () => {
    const { node } = createNode([1, 2, 3, 4])
    const otherGraph = new LGraph()
    vi.mocked(navigationStore.navigateToGraph).mockImplementation(async () => {
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
