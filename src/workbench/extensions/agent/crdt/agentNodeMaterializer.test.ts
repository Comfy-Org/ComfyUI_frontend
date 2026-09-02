import { graphScopeOf } from '@/types/graphScopeId'
import { createTestingPinia } from '@pinia/testing'
import { setActivePinia } from 'pinia'
import { beforeEach, describe, expect, it, vi } from 'vitest'

import { createGraphMutations } from '@/core/graph/graphMutations'
import { LGraph, LGraphNode, LiteGraph } from '@/lib/litegraph/src/litegraph'
import { useNodeDataStore } from '@/stores/nodeDataStore'
import { toNodeId } from '@/types/nodeId'

import { materializeMissingAdapters } from './agentNodeMaterializer'

class DummyNode extends LGraphNode {
  constructor() {
    super('dummy')
  }
}

beforeEach(() => {
  setActivePinia(createTestingPinia({ stubActions: false }))
  LiteGraph.registerNodeType('dummy', DummyNode)
})

function seedAgentAddedNode(graph: LGraph, id: number) {
  const scope = graphScopeOf(graph)
  const mutations = createGraphMutations({
    getScope: () => scope,
    layout: { createNode: vi.fn(), deleteNodes: vi.fn() }
  })
  mutations.addNode(
    {
      id,
      type: 'dummy',
      pos: [0, 0],
      size: [100, 80],
      inputs: [],
      outputs: []
    },
    { source: 'agent-remote', actor: 'agent:test', opId: `op-${id}` }
  )
  return scope
}

describe('materializeMissingAdapters', () => {
  it('gives a store-only agent-added node a live LGraph adapter', () => {
    const graph = new LGraph()
    seedAgentAddedNode(graph, 1)

    expect(graph._nodes).toHaveLength(0)

    const materialized = materializeMissingAdapters(graph, ['1'])

    expect(materialized).toEqual(['1'])
    expect(graph._nodes).toHaveLength(1)
    expect(graph.getNodeById(toNodeId(1))).not.toBeNull()
  })

  it('is a no-op for an id that already has a live adapter (getNodeById falsiness fix)', () => {
    // Regression: LGraph.getNodeById returns `undefined`, not `null`, for an
    // absent id (`this._nodes_by_id[id]`), so a strict `!== null` check
    // never skips an already-materialized node and always re-runs the
    // delete/recreate path. This must not touch the store a second time.
    const graph = new LGraph()
    graph.add(new DummyNode())
    const liveId = graph._nodes[0].id
    const nodeDataStore = useNodeDataStore()
    const deleteSpy = vi.spyOn(nodeDataStore, 'deleteNode')

    const materialized = materializeMissingAdapters(graph, [String(liveId)])

    expect(materialized).toEqual([])
    expect(deleteSpy).not.toHaveBeenCalled()
  })

  it('does not delete the store record when graph.add() throws (rollback-safe)', () => {
    const graph = new LGraph()
    const scope = seedAgentAddedNode(graph, 1)
    const nodeDataStore = useNodeDataStore()
    const before = nodeDataStore.getNode(scope.rootGraphId, toNodeId(1))
    expect(before).toBeDefined()

    vi.spyOn(graph, 'add').mockImplementation(() => {
      throw 'LiteGraph: max number of nodes in a graph reached'
    })

    const materialized = materializeMissingAdapters(graph, ['1'])

    expect(materialized).toEqual([])
    // The authoritative record must survive the failed add — this is the
    // DrJKL data-loss report: deleting before the fallible steps loses the
    // node from every future save when `graph.add()` throws.
    expect(nodeDataStore.getNode(scope.rootGraphId, toNodeId(1))).toBeDefined()
    expect(graph._nodes).toHaveLength(0)
  })

  it('does not delete the store record when node.configure() throws', () => {
    const graph = new LGraph()
    const scope = seedAgentAddedNode(graph, 1)
    const nodeDataStore = useNodeDataStore()

    const configureSpy = vi
      .spyOn(LGraphNode.prototype, 'configure')
      .mockImplementation(() => {
        throw new Error('bad payload')
      })

    const materialized = materializeMissingAdapters(graph, ['1'])

    expect(materialized).toEqual([])
    expect(nodeDataStore.getNode(scope.rootGraphId, toNodeId(1))).toBeDefined()
    configureSpy.mockRestore()
  })
})
