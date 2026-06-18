import { beforeEach, describe, expect, it, vi } from 'vitest'

import type { LGraphCanvas } from '@/lib/litegraph/src/litegraph'
import {
  LGraph,
  LGraphNode,
  LiteGraph,
  asNodeId
} from '@/lib/litegraph/src/litegraph'
import { createTestSubgraph } from '@/lib/litegraph/src/subgraph/__fixtures__/subgraphHelpers'
import type { WidgetId } from '@/types/widgetId'
import { widgetId } from '@/types/widgetId'

import { createNode, getWidgetIdForNode, resolveNode } from './litegraphUtil'

const mockBringNodeToFront = vi.fn()

vi.mock('@/renderer/extensions/vueNodes/composables/useNodeZIndex', () => ({
  useNodeZIndex: () => ({ bringNodeToFront: mockBringNodeToFront })
}))

vi.mock('@/platform/updates/common/toastStore', () => ({
  useToastStore: () => ({ addAlert: vi.fn() })
}))

describe('resolveNode', () => {
  it('returns undefined when graph is null', () => {
    expect(resolveNode(asNodeId(1), null)).toBeUndefined()
  })

  it('returns undefined when graph is undefined', () => {
    expect(resolveNode(asNodeId(1), undefined)).toBeUndefined()
  })

  it('finds a node in the root graph', () => {
    const graph = new LGraph()
    const node = new LGraphNode('TestNode')
    graph.add(node)

    expect(resolveNode(node.id, graph)).toBe(node)
  })

  it('returns undefined when node does not exist anywhere', () => {
    const graph = new LGraph()

    expect(resolveNode(asNodeId(999), graph)).toBeUndefined()
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
    const spy = vi.spyOn(LiteGraph, 'createNode').mockReturnValue(newNode)
    const graph = new LGraph()

    const result = await createNode(makeCanvas(graph), 'LoadImage')

    expect(result).toBe(newNode)
    expect(Array.from(newNode.pos)).toEqual([100, 200])
    spy.mockRestore()
  })

  it('brings the new node to front so it renders above existing nodes', async () => {
    const newNode = new LGraphNode('LoadImage')
    const spy = vi.spyOn(LiteGraph, 'createNode').mockReturnValue(newNode)
    const graph = new LGraph()

    const result = await createNode(makeCanvas(graph), 'LoadImage')

    expect(result).toBe(newNode)
    expect(mockBringNodeToFront).toHaveBeenCalledTimes(1)
    expect(mockBringNodeToFront).toHaveBeenCalledWith(newNode.id)
    spy.mockRestore()
  })

  it('does not bring node to front when LiteGraph.createNode returns null', async () => {
    const spy = vi.spyOn(LiteGraph, 'createNode').mockReturnValue(null)
    await createNode(makeCanvas(new LGraph()), 'NonexistentNode')
    expect(mockBringNodeToFront).not.toHaveBeenCalled()
    spy.mockRestore()
  })

  it('does not bring node to front when graph.add returns null', async () => {
    const newNode = new LGraphNode('LoadImage')
    const spy = vi.spyOn(LiteGraph, 'createNode').mockReturnValue(newNode)
    const graph = new LGraph()
    vi.spyOn(graph, 'add').mockReturnValue(null as unknown as LGraphNode)

    await createNode(makeCanvas(graph), 'LoadImage')

    expect(mockBringNodeToFront).not.toHaveBeenCalled()
    spy.mockRestore()
  })
})

describe('getWidgetIdForNode', () => {
  const graphId = 'a1b2c3d4-e5f6-7890-abcd-ef1234567890'

  function fakeNode(id: number, opts: { detached?: boolean } = {}): LGraphNode {
    return {
      id,
      graph: opts.detached ? undefined : { rootGraph: { id: graphId } }
    } as unknown as LGraphNode
  }

  it('returns widget.widgetId when present', () => {
    const node = fakeNode(7)
    const widget = {
      name: 'seed',
      widgetId: 'precomputed:7:seed' as WidgetId
    }
    expect(getWidgetIdForNode(node, widget)).toBe('precomputed:7:seed')
  })

  it('derives an widgetId for plain POJO widgets bound to a node', () => {
    const node = fakeNode(42)
    expect(getWidgetIdForNode(node, { name: 'legacy_widget' })).toBe(
      widgetId(graphId, asNodeId(42), 'legacy_widget')
    )
  })

  it('can distinguish duplicate widget names on one node without changing the displayed name', () => {
    const node = fakeNode(42)
    expect(getWidgetIdForNode(node, { name: 'UNKNOWN' }, 1)).toBe(
      widgetId(graphId, asNodeId(42), 'UNKNOWN#1')
    )
  })

  it('returns undefined when the node has no graph', () => {
    const node = fakeNode(1, { detached: true })
    expect(getWidgetIdForNode(node, { name: 'x' })).toBeUndefined()
  })

  it('returns undefined for placeholder node id (-1)', () => {
    const node = fakeNode(-1)
    expect(getWidgetIdForNode(node, { name: 'x' })).toBeUndefined()
  })
})
