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

class ThrowsOnAddedNode extends LGraphNode {
  constructor() {
    super('throws-on-added')
  }

  override onAdded(): void {
    throw new Error('extension code blew up in onAdded')
  }
}

beforeEach(() => {
  setActivePinia(createTestingPinia({ stubActions: false }))
  LiteGraph.registerNodeType('dummy', DummyNode)
  LiteGraph.registerNodeType('throws-on-added', ThrowsOnAddedNode)
})

function seedAgentAddedNode(graph: LGraph, id: number, type = 'dummy') {
  const scope = graphScopeOf(graph)
  const mutations = createGraphMutations({
    getScope: () => scope,
    layout: { createNode: vi.fn(), deleteNodes: vi.fn() }
  })
  mutations.addNode(
    {
      id,
      type,
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
    // `graph._nodes` alone doesn't exercise `LGraph.serialize()` — assert the
    // actual save path a regression in `serialiseStoredNodes()` would break.
    expect(graph.serialize().nodes).toHaveLength(1)
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

  it('removes the partially attached adapter when node.onAdded() throws inside graph.add()', () => {
    // Regression for the CodeRabbit Major follow-up
    // (https://github.com/Comfy-Org/ComfyUI_frontend/pull/16652#discussion_r3921409323):
    // `LGraph.add()` pushes the node into `_nodes`/`_nodes_by_id` and runs
    // `attachNodeToStores` BEFORE calling `node.onAdded?.(this)`, so an
    // `onAdded` throw propagates out of `add()` after the node is already
    // partially attached, not before. The add()-failure branch must remove
    // that partial adapter, not just restore the store record, or the graph
    // and store diverge (adapter live but store also has its own record).
    const graph = new LGraph()
    const scope = seedAgentAddedNode(graph, 1, 'throws-on-added')
    const nodeDataStore = useNodeDataStore()

    const materialized = materializeMissingAdapters(graph, ['1'])

    expect(materialized).toEqual([])
    expect(nodeDataStore.getNode(scope.rootGraphId, toNodeId(1))).toBeDefined()
    // No live adapter must remain bound to the graph after the rollback.
    expect(graph._nodes).toHaveLength(0)
    expect(graph.getNodeById(toNodeId(1))).toBeFalsy()
  })

  it('does not delete the store record when node.configure() throws', () => {
    const graph = new LGraph()
    const scope = seedAgentAddedNode(graph, 1)
    const nodeDataStore = useNodeDataStore()

    // Not restored explicitly: root `vitest.config` sets `restoreMocks: true`,
    // so vitest already restores every mock between tests
    // (https://github.com/Comfy-Org/ComfyUI_frontend/pull/16652#discussion_r3920899113).
    vi.spyOn(LGraphNode.prototype, 'configure').mockImplementation(() => {
      throw new Error('bad payload')
    })

    const materialized = materializeMissingAdapters(graph, ['1'])

    expect(materialized).toEqual([])
    expect(nodeDataStore.getNode(scope.rootGraphId, toNodeId(1))).toBeDefined()
  })

  it('materializes under the CRDT id, not a reminted one, on the reconcile path (DrJKL P1)', () => {
    // Regression for
    // https://github.com/Comfy-Org/ComfyUI_frontend/pull/16652#discussion_r3921406436
    // and https://github.com/Comfy-Org/ComfyUI_frontend/pull/16652#discussion_r3921409323:
    // `graph.add()` internally calls `attachNodeToStores`/`registerNodeState`,
    // which mints and assigns a NEW id whenever it finds an incumbent store
    // record still occupying the target id. On the reconcile path (an id
    // that already has a live adapter, e.g. a remote `update`), the store
    // record must be cleared BEFORE `graph.add()` runs, or the CRDT id gets
    // silently reminted and `graph.getNodeById(toNodeId(1))` goes right back
    // to having no live adapter — the exact bug this module exists to fix.
    const graph = new LGraph()
    const scope = seedAgentAddedNode(graph, 1)
    materializeMissingAdapters(graph, ['1']) // first materialization

    expect(graph.getNodeById(toNodeId(1))).not.toBeNull()

    // Simulate a remote `update`: the op layer reconciles the store record
    // for the same id with fresh serialised state (same shape
    // `ecsFollowerAdapter.ts` uses), then reports the id through the same
    // `lastAddedNodeIds` channel again.
    const mutations = createGraphMutations({
      getScope: () => scope,
      layout: { createNode: vi.fn(), deleteNodes: vi.fn() }
    })
    mutations.batch(
      { source: 'agent-remote', actor: 'agent:test', opId: 'op-1-update' },
      (batch) =>
        batch.reconcileNode({
          id: 1,
          type: 'dummy',
          pos: [10, 20],
          size: [100, 80],
          inputs: [],
          outputs: []
        })
    )

    const nodeDataStore = useNodeDataStore()
    expect(
      nodeDataStore.getNode(scope.rootGraphId, toNodeId(1))?.lastSerialization
    ).toBeDefined()

    const materialized = materializeMissingAdapters(graph, ['1'])

    expect(materialized).toEqual(['1'])
    // The live adapter must still be reachable under the ORIGINAL CRDT id —
    // not undefined because `attachNodeToStores` reminted it.
    const node = graph.getNodeById(toNodeId(1))
    expect(node).not.toBeNull()
    expect(node?.id).toBe(toNodeId(1))
    expect(graph._nodes).toHaveLength(1)
    expect(graph.serialize().nodes).toHaveLength(1)
  })
})
