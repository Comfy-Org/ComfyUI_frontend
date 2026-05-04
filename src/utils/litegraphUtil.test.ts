import { createTestingPinia } from '@pinia/testing'
import { setActivePinia } from 'pinia'
import { beforeEach, describe, expect, it, vi } from 'vitest'

import { isPromotedWidgetView } from '@/core/graph/subgraph/promotedWidgetTypes'
import { LGraph, LGraphNode } from '@/lib/litegraph/src/litegraph'
import {
  createTestSubgraph,
  createTestSubgraphNode,
  resetSubgraphFixtureState
} from '@/lib/litegraph/src/subgraph/__fixtures__/subgraphHelpers'
import { usePromotionStore } from '@/stores/promotionStore'

import { resolveNode, resolveNodeWidget } from './litegraphUtil'

vi.mock('@/renderer/core/canvas/canvasStore', () => ({
  useCanvasStore: () => ({})
}))
vi.mock('@/stores/domWidgetStore', () => ({
  useDomWidgetStore: () => ({
    widgetStates: new Map(),
    setPositionOverride: vi.fn(),
    clearPositionOverride: vi.fn()
  })
}))
vi.mock('@/services/litegraphService', () => ({
  useLitegraphService: () => ({ updatePreviews: () => ({}) })
}))

function createPromotedWidgetFixture(hostId: number) {
  const subgraph = createTestSubgraph({
    inputs: [{ name: 'value', type: '*' }]
  })
  const inner = new LGraphNode('Inner')
  const input = inner.addInput('value', '*')
  inner.addWidget('text', 'value', 'a', () => {})
  input.widget = { name: 'value' }
  subgraph.add(inner)
  subgraph.inputNode.slots[0].connect(input, inner)

  const host = createTestSubgraphNode(subgraph, { id: hostId })
  host._internalConfigureAfterSlots()
  host.graph!.add(host)

  usePromotionStore().setPromotions(host.rootGraph.id, host.id, [
    { sourceNodeId: String(inner.id), sourceWidgetName: 'value' }
  ])

  const promoted = host.widgets.find(isPromotedWidgetView)
  if (!promoted) throw new Error('Expected promoted widget view')

  return { host, promoted }
}

describe('resolveNode', () => {
  beforeEach(() => {
    setActivePinia(createTestingPinia({ stubActions: false }))
    resetSubgraphFixtureState()
  })

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

  it('resolves promoted widget by host node id and storeName', () => {
    const { host, promoted } = createPromotedWidgetFixture(501)

    const [resolvedNode, resolvedWidget] = resolveNodeWidget(
      host.id,
      promoted.storeName,
      host.graph!
    )

    expect(resolvedNode).toBe(host)
    expect(resolvedWidget).toBe(promoted)
  })

  it('keeps legacy fallback for saved promoted widget source tuples', () => {
    const { host, promoted } = createPromotedWidgetFixture(502)

    const [resolvedNode, resolvedWidget] = resolveNodeWidget(
      promoted.sourceNodeId,
      promoted.sourceWidgetName,
      host.graph!
    )

    expect(resolvedNode).toBe(host)
    expect(resolvedWidget).toBe(promoted)
  })

  it('keeps legacy fallback for saved promoted widget source tuples with numeric node ids', () => {
    const { host, promoted } = createPromotedWidgetFixture(503)

    const [resolvedNode, resolvedWidget] = resolveNodeWidget(
      Number(promoted.sourceNodeId),
      promoted.sourceWidgetName,
      host.graph!
    )

    expect(resolvedNode).toBe(host)
    expect(resolvedWidget).toBe(promoted)
  })
})
