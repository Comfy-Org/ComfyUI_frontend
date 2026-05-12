import { beforeEach, describe, expect, it, vi } from 'vitest'

import type { LGraphCanvas } from '@/lib/litegraph/src/litegraph'
import { LGraph, LGraphNode, LiteGraph } from '@/lib/litegraph/src/litegraph'
import { createTestSubgraph } from '@/lib/litegraph/src/subgraph/__fixtures__/subgraphHelpers'

import { createNode, resolveNode } from './litegraphUtil'

const mockBringNodeToFront = vi.fn()

vi.mock('@/renderer/extensions/vueNodes/composables/useNodeZIndex', () => ({
  useNodeZIndex: () => ({ bringNodeToFront: mockBringNodeToFront })
}))

vi.mock('@/platform/updates/common/toastStore', () => ({
  useToastStore: () => ({ addAlert: vi.fn() })
}))

describe('resolveNode', () => {
  it('returns undefined when graph is null', () => {
    expect(resolveNode(1, null)).toBeUndefined()
  })

  it('returns undefined when graph is undefined', () => {
    expect(resolveNode(1, undefined)).toBeUndefined()
  })

  it('finds a node in the root graph', () => {
    const graph = new LGraph()
    const node = new LGraphNode('TestNode')
    graph.add(node)

    expect(resolveNode(node.id, graph)).toBe(node)
  })

  it('returns undefined when node does not exist anywhere', () => {
    const graph = new LGraph()

    expect(resolveNode(999, graph)).toBeUndefined()
  })

  it('finds a node inside a subgraph', () => {
    const subgraph = createTestSubgraph({ nodeCount: 1 })
    const rootGraph = subgraph.rootGraph
    rootGraph._subgraphs.set(subgraph.id, subgraph)
    const subgraphNode = subgraph._nodes[0]

    // Node should NOT be found directly on root graph
    expect(rootGraph.getNodeById(subgraphNode.id)).toBeFalsy()

    // But resolveNode should find it via subgraph search
    expect(resolveNode(subgraphNode.id, rootGraph)).toBe(subgraphNode)
  })

  it('prefers root graph node over subgraph node with same id', () => {
    const subgraph = createTestSubgraph()
    const rootGraph = subgraph.rootGraph

    const rootNode = new LGraphNode('RootNode')
    rootGraph.add(rootNode)

    // Add a different node to the subgraph
    const sgNode = new LGraphNode('SubgraphNode')
    subgraph.add(sgNode)

    // resolveNode should return the root graph node first
    expect(resolveNode(rootNode.id, rootGraph)).toBe(rootNode)
  })

  it('searches across multiple subgraphs', () => {
    const sg1 = createTestSubgraph({ name: 'SG1' })
    const rootGraph = sg1.rootGraph
    const sg2 = createTestSubgraph({ name: 'SG2', nodeCount: 1 })

    // Put sg2 under the same root graph
    rootGraph._subgraphs.set(sg2.id, sg2)

    const targetNode = sg2._nodes[0]
    expect(resolveNode(targetNode.id, rootGraph)).toBe(targetNode)
  })
})

describe('createNode', () => {
  function makeCanvas(graph: LGraph): LGraphCanvas {
    return {
      graph,
      graph_mouse: [100, 200] as [number, number]
    } as Partial<LGraphCanvas> as LGraphCanvas
  }

  beforeEach(() => {
    mockBringNodeToFront.mockClear()
  })

  it('returns null when name is empty', async () => {
    const result = await createNode(makeCanvas(new LGraph()), '')
    expect(result).toBeNull()
    expect(mockBringNodeToFront).not.toHaveBeenCalled()
  })

  it('places the new node at the canvas graph_mouse position', async () => {
    const newNode = new LGraphNode('LoadImage')
    const createNodeSpy = vi
      .spyOn(LiteGraph, 'createNode')
      .mockReturnValue(newNode)
    const graph = new LGraph()

    const result = await createNode(makeCanvas(graph), 'LoadImage')

    expect(result).toBe(newNode)
    expect(Array.from(newNode.pos)).toEqual([100, 200])
    createNodeSpy.mockRestore()
  })

  it('brings the newly created node to the front via useNodeZIndex', async () => {
    const newNode = new LGraphNode('LoadImage')
    const createNodeSpy = vi
      .spyOn(LiteGraph, 'createNode')
      .mockReturnValue(newNode)
    const graph = new LGraph()

    const result = await createNode(makeCanvas(graph), 'LoadImage')

    expect(result).toBe(newNode)
    expect(mockBringNodeToFront).toHaveBeenCalledTimes(1)
    expect(mockBringNodeToFront).toHaveBeenCalledWith(newNode.id)
    createNodeSpy.mockRestore()
  })

  it('brings the new node to the front AFTER it has been added to the graph', async () => {
    const newNode = new LGraphNode('LoadImage')
    const createNodeSpy = vi
      .spyOn(LiteGraph, 'createNode')
      .mockReturnValue(newNode)
    const graph = new LGraph()

    const callOrder: string[] = []
    const originalAdd = graph.add.bind(graph)
    graph.add = vi.fn((...args: Parameters<typeof originalAdd>) => {
      callOrder.push('graph.add')
      return originalAdd(...args)
    }) as typeof graph.add
    mockBringNodeToFront.mockImplementation(() => {
      callOrder.push('bringNodeToFront')
    })

    await createNode(makeCanvas(graph), 'LoadImage')

    expect(callOrder).toEqual(['graph.add', 'bringNodeToFront'])
    createNodeSpy.mockRestore()
  })

  it('does not call bringNodeToFront when LiteGraph fails to create the node', async () => {
    const createNodeSpy = vi
      .spyOn(LiteGraph, 'createNode')
      .mockReturnValue(null)
    const graph = new LGraph()

    const result = await createNode(makeCanvas(graph), 'NonExistentNode')

    expect(result).toBeNull()
    expect(mockBringNodeToFront).not.toHaveBeenCalled()
    createNodeSpy.mockRestore()
  })

  it('does not call bringNodeToFront when the canvas has no graph', async () => {
    const newNode = new LGraphNode('LoadImage')
    const createNodeSpy = vi
      .spyOn(LiteGraph, 'createNode')
      .mockReturnValue(newNode)
    const canvas = {
      graph: null,
      graph_mouse: [0, 0] as [number, number]
    } as Partial<LGraphCanvas> as LGraphCanvas

    const result = await createNode(canvas, 'LoadImage')

    expect(result).toBeNull()
    expect(mockBringNodeToFront).not.toHaveBeenCalled()
    createNodeSpy.mockRestore()
  })

  it('does not call bringNodeToFront when graph.add fails to attach the node', async () => {
    const newNode = new LGraphNode('LoadImage')
    const createNodeSpy = vi
      .spyOn(LiteGraph, 'createNode')
      .mockReturnValue(newNode)
    const graph = new LGraph()
    graph.add = vi.fn(() => null) as unknown as typeof graph.add

    await createNode(makeCanvas(graph), 'LoadImage')

    expect(mockBringNodeToFront).not.toHaveBeenCalled()
    createNodeSpy.mockRestore()
  })
})
