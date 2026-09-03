import { createTestingPinia } from '@pinia/testing'
import { setActivePinia } from 'pinia'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import { createGraphMutations } from '@/core/graph/graphMutations'
import { LGraph, LGraphNode, LiteGraph } from '@/lib/litegraph/src/litegraph'
import { reportError } from '@/platform/telemetry/reportError'
// Mirrors the production bridge in AgentPanelRoot.vue, which takes the same
// exemption to drive the real layout store.
// eslint-disable-next-line import-x/no-restricted-paths
import { layoutStore } from '@/renderer/core/layout/store/layoutStore'
// eslint-disable-next-line import-x/no-restricted-paths
import { LayoutSource } from '@/renderer/core/layout/types'
import { useNodeDataStore } from '@/stores/nodeDataStore'
import { useWidgetValueStore } from '@/stores/widgetValueStore'
import type { GraphScope } from '@/types/graphScopeId'
import { graphScopeOf } from '@/types/graphScopeId'
import type { RemoteMutationContext } from '@/types/graphMutationContext'
import { toNodeId } from '@/types/nodeId'
import { widgetId } from '@/types/widgetId'

import { reconcileAgentAdapters } from './agentNodeMaterializer'
import type { GraphOperation } from './graphOperations'
import { attachMintPortWiring } from './mintPortWiring'
import type { MintPortWiring } from './mintPortWiring'

vi.mock('@/platform/telemetry/reportError', () => ({
  reportError: vi.fn()
}))

class DummyNode extends LGraphNode {
  constructor() {
    super('dummy')
  }
}

class WidgetNode extends LGraphNode {
  constructor() {
    super('widget-node')
    this.addWidget('number', 'value', 0, () => {})
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

const REMOTE: RemoteMutationContext = {
  source: 'agent-remote',
  actor: 'agent:test',
  opId: 'op-test'
}

/**
 * Same layout port the agent panel wires in production: remote adds create
 * the layout entry with remote provenance BEFORE any live node exists, so a
 * later `LGraph.add()` adopts it instead of minting a canvas-sourced create.
 * A stubbed port would hide the add_node echo this test suite guards against.
 */
function remoteMutations(scope: GraphScope) {
  return createGraphMutations({
    getScope: () => scope,
    layout: {
      createNode(scope, nodeId, { position, size }, context) {
        layoutStore.applyOperation({
          type: 'createNode',
          graphId: scope.rootGraphId,
          ownerGraphId: scope.owningGraphId,
          nodeId,
          layout: {
            id: nodeId,
            position,
            size,
            bounds: { x: position.x, y: position.y, ...size },
            zIndex: layoutStore.allocateZIndex(),
            visible: true
          },
          source: LayoutSource.AgentRemote,
          actor: context.actor,
          opId: context.opId,
          timestamp: Date.now()
        })
      },
      deleteNodes(scope, nodeIds, context) {
        const timestamp = Date.now()
        layoutStore.applyOperations(
          nodeIds.map((nodeId) => ({
            type: 'deleteNode',
            graphId: scope.rootGraphId,
            ownerGraphId: scope.owningGraphId,
            nodeId,
            source: LayoutSource.AgentRemote,
            actor: context.actor,
            opId: context.opId,
            timestamp
          }))
        )
      }
    }
  })
}

function nodePayload(id: number, type = 'dummy') {
  return {
    id,
    type,
    pos: [0, 0],
    size: [100, 80],
    inputs: [],
    outputs: []
  }
}

/** Commit a remote add to the stores only, the way a follower frame does. */
function seedAgentAddedNode(graph: LGraph, id: number, type = 'dummy') {
  const scope = graphScopeOf(graph)
  remoteMutations(scope).addNode(nodePayload(id, type), {
    ...REMOTE,
    opId: `op-${id}`
  })
  return scope
}

beforeEach(() => {
  setActivePinia(createTestingPinia({ stubActions: false }))
  LiteGraph.registerNodeType('dummy', DummyNode)
  LiteGraph.registerNodeType('widget-node', WidgetNode)
  LiteGraph.registerNodeType('throws-on-added', ThrowsOnAddedNode)
})

describe('reconcileAgentAdapters', () => {
  describe('store record without a live node', () => {
    it('gives the record a live node under its own id', () => {
      const graph = new LGraph()
      seedAgentAddedNode(graph, 1)
      expect(graph._nodes).toHaveLength(0)

      const materialized = reconcileAgentAdapters(graph)

      expect(materialized).toEqual([toNodeId(1)])
      expect(graph._nodes).toHaveLength(1)
      expect(graph.getNodeById(toNodeId(1))?.id).toBe(toNodeId(1))
      // `_nodes` alone does not exercise the save path; a regression in
      // `serialiseStoredNodes()` shows up here.
      expect(graph.serialize().nodes).toHaveLength(1)
      expect(reportError).not.toHaveBeenCalled()
    })

    it('applies the serialised widget values to the new node', () => {
      const graph = new LGraph()
      const scope = graphScopeOf(graph)
      remoteMutations(scope).addNode(
        { ...nodePayload(1, 'widget-node'), widgets_values: { value: 7 } },
        REMOTE
      )

      reconcileAgentAdapters(graph)

      const node = graph.getNodeById(toNodeId(1))
      expect(node?.widgets?.[0].value).toBe(7)
      expect(
        useWidgetValueStore().getWidget(
          widgetId(scope.rootGraphId, toNodeId(1), 'value')
        )?.value
      ).toBe(7)
    })

    it('is idempotent once the node is live', () => {
      const graph = new LGraph()
      const scope = seedAgentAddedNode(graph, 1)
      reconcileAgentAdapters(graph)
      const node = graph.getNodeById(toNodeId(1))
      const state = node?._state

      expect(reconcileAgentAdapters(graph)).toEqual([])
      expect(graph._nodes).toEqual([node])
      expect(node?._state).toBe(state)
      expect(useNodeDataStore().ownsNode(scope, state!)).toBe(true)
    })

    it('leaves a locally added node alone', () => {
      const graph = new LGraph()
      graph.add(new DummyNode())
      const deleteSpy = vi.spyOn(useNodeDataStore(), 'deleteNode')

      expect(reconcileAgentAdapters(graph)).toEqual([])
      expect(deleteSpy).not.toHaveBeenCalled()
      expect(graph._nodes).toHaveLength(1)
    })

    it('builds an error placeholder for an unregistered type', () => {
      const graph = new LGraph()
      seedAgentAddedNode(graph, 1, 'not-a-registered-type')

      expect(reconcileAgentAdapters(graph)).toEqual([toNodeId(1)])
      const node = graph.getNodeById(toNodeId(1))
      expect(node?.has_errors).toBe(true)
      expect(node?.type).toBe('not-a-registered-type')
    })
  })

  describe('remote update of a live node', () => {
    it('keeps the same live node when the record is updated in place', () => {
      const graph = new LGraph()
      const scope = seedAgentAddedNode(graph, 1)
      reconcileAgentAdapters(graph)
      const live = graph.getNodeById(toNodeId(1))

      remoteMutations(scope).batch(REMOTE, (batch) =>
        batch.reconcileNode({ ...nodePayload(1), pos: [10, 20] })
      )

      expect(reconcileAgentAdapters(graph)).toEqual([])
      expect(graph._nodes).toHaveLength(1)
      expect(graph.getNodeById(toNodeId(1))).toBe(live)
    })

    it('replaces a node whose record was re-created under the same id', () => {
      const graph = new LGraph()
      const scope = seedAgentAddedNode(graph, 1)
      reconcileAgentAdapters(graph)
      const stale = graph.getNodeById(toNodeId(1))
      expect(stale).toBeDefined()

      const mutations = remoteMutations(scope)
      mutations.deleteNode(toNodeId(1), [], REMOTE)
      mutations.addNode(nodePayload(1), { ...REMOTE, opId: 'op-1-again' })

      const materialized = reconcileAgentAdapters(graph)

      expect(materialized).toEqual([toNodeId(1)])
      expect(graph._nodes).toHaveLength(1)
      const replacement = graph.getNodeById(toNodeId(1))
      expect(replacement?.id).toBe(toNodeId(1))
      expect(replacement).not.toBe(stale)
      expect(graph._nodes).not.toContain(stale)
      expect(stale?.graph).toBeNull()
      expect(graph.serialize().nodes).toHaveLength(1)
    })
  })

  describe('remote removal of a live node', () => {
    it('detaches the node after a remote delete', () => {
      const graph = new LGraph()
      const scope = seedAgentAddedNode(graph, 1)
      reconcileAgentAdapters(graph)
      const removed = vi.fn()
      graph.events.addEventListener('node:removed', removed)

      remoteMutations(scope).deleteNode(toNodeId(1), [], REMOTE)

      expect(reconcileAgentAdapters(graph)).toEqual([])
      expect(graph._nodes).toHaveLength(0)
      expect(graph.getNodeById(toNodeId(1))).toBeFalsy()
      expect(graph.serialize().nodes).toHaveLength(0)
      expect(removed).toHaveBeenCalledOnce()
    })

    it('detaches every node after a remote clear', () => {
      const graph = new LGraph()
      const scope = seedAgentAddedNode(graph, 1)
      seedAgentAddedNode(graph, 2)
      expect(reconcileAgentAdapters(graph)).toHaveLength(2)

      remoteMutations(scope).clearSemanticGraph(REMOTE)

      expect(reconcileAgentAdapters(graph)).toEqual([])
      expect(graph._nodes).toHaveLength(0)
      expect(graph.serialize().nodes).toHaveLength(0)
    })

    it('detaches nodes dropped by an authoritative snapshot', () => {
      const graph = new LGraph()
      const scope = seedAgentAddedNode(graph, 1)
      seedAgentAddedNode(graph, 2)
      reconcileAgentAdapters(graph)

      remoteMutations(scope).batch(REMOTE, (batch) =>
        batch.removeMissing([toNodeId(2)], [])
      )

      expect(reconcileAgentAdapters(graph)).toEqual([])
      expect(graph._nodes.map((node) => node.id)).toEqual([toNodeId(2)])
    })
  })

  describe('failure handling', () => {
    it('keeps the record when graph.add() throws', () => {
      const graph = new LGraph()
      const scope = seedAgentAddedNode(graph, 1)
      const nodeDataStore = useNodeDataStore()
      vi.spyOn(graph, 'add').mockImplementation(() => {
        throw 'LiteGraph: max number of nodes in a graph reached'
      })

      expect(reconcileAgentAdapters(graph)).toEqual([])
      expect(
        nodeDataStore.getNode(scope.rootGraphId, toNodeId(1))
      ).toBeDefined()
      expect(graph._nodes).toHaveLength(0)
      expect(reportError).toHaveBeenCalledWith(
        'LiteGraph: max number of nodes in a graph reached',
        expect.objectContaining({
          errorType: 'agent_node_materialize_add_failed'
        })
      )
    })

    it('keeps the record widget values when graph.add() throws', () => {
      const graph = new LGraph()
      const scope = graphScopeOf(graph)
      remoteMutations(scope).addNode(
        { ...nodePayload(1, 'widget-node'), widgets_values: { value: 7 } },
        REMOTE
      )
      vi.spyOn(graph, 'add').mockImplementation(() => {
        throw new Error('nope')
      })

      reconcileAgentAdapters(graph)

      expect(
        useWidgetValueStore().getWidget(
          widgetId(scope.rootGraphId, toNodeId(1), 'value')
        )?.value
      ).toBe(7)
    })

    it('removes the partially attached node when onAdded() throws inside graph.add()', () => {
      // `LGraph.add()` attaches the node before calling `onAdded`, so the
      // throw leaves a live node behind unless the rollback takes it out.
      const graph = new LGraph()
      const scope = seedAgentAddedNode(graph, 1, 'throws-on-added')

      expect(reconcileAgentAdapters(graph)).toEqual([])
      expect(
        useNodeDataStore().getNode(scope.rootGraphId, toNodeId(1))
      ).toBeDefined()
      expect(graph._nodes).toHaveLength(0)
      expect(graph.getNodeById(toNodeId(1))).toBeFalsy()
      // The remote layout entry was written before add() ran and the throw
      // happens before `LGraph.add()` attaches its own layout, so rollback
      // must leave it in place for the retry.
      expect(
        layoutStore.getNodeLayout(scope.rootGraphId, toNodeId(1))
      ).toBeDefined()
    })

    it('retries a failed add on the next reconcile', () => {
      const graph = new LGraph()
      seedAgentAddedNode(graph, 1)
      const add = vi.spyOn(graph, 'add').mockImplementationOnce(() => {
        throw new Error('transient')
      })
      expect(reconcileAgentAdapters(graph)).toEqual([])
      add.mockRestore()

      expect(reconcileAgentAdapters(graph)).toEqual([toNodeId(1)])
      expect(graph._nodes).toHaveLength(1)
    })

    it('keeps the attached node when configure() throws', () => {
      const graph = new LGraph()
      const scope = seedAgentAddedNode(graph, 1)
      vi.spyOn(LGraphNode.prototype, 'configure').mockImplementation(() => {
        throw new Error('bad payload')
      })

      expect(reconcileAgentAdapters(graph)).toEqual([toNodeId(1)])
      expect(graph._nodes).toHaveLength(1)
      expect(
        useNodeDataStore().getNode(scope.rootGraphId, toNodeId(1))
      ).toBeDefined()
      expect(reportError).toHaveBeenCalledWith(
        expect.any(Error),
        expect.objectContaining({
          errorType: 'agent_node_materialize_configure_failed'
        })
      )
    })
  })

  describe('with mint ports attached', () => {
    let graph: LGraph
    let minted: GraphOperation[]
    let wiring: MintPortWiring

    beforeEach(() => {
      graph = new LGraph()
      minted = []
      wiring = attachMintPortWiring({
        isEnabled: () => true,
        isDocBound: () => true,
        enqueue: (operations) => minted.push(...operations),
        layoutChanges: (listener) => layoutStore.onChange(listener),
        localActorPrefix: 'user-',
        getGraph: () => graph
      })
    })

    afterEach(() => {
      wiring.detach()
    })

    async function settle(): Promise<void> {
      await Promise.resolve()
      await Promise.resolve()
      await Promise.resolve()
    }

    it('does not echo a remote add back as local operations', async () => {
      const scope = graphScopeOf(graph)
      remoteMutations(scope).addNode(
        { ...nodePayload(1, 'widget-node'), widgets_values: { value: 7 } },
        REMOTE
      )

      expect(reconcileAgentAdapters(graph)).toEqual([toNodeId(1)])
      await settle()

      expect(minted).toEqual([])
    })

    it('does not echo a remote re-create or delete back as local operations', async () => {
      const scope = graphScopeOf(graph)
      const mutations = remoteMutations(scope)
      mutations.addNode(nodePayload(1), REMOTE)
      reconcileAgentAdapters(graph)

      mutations.deleteNode(toNodeId(1), [], REMOTE)
      mutations.addNode(nodePayload(1), { ...REMOTE, opId: 'op-1-again' })
      reconcileAgentAdapters(graph)
      mutations.deleteNode(toNodeId(1), [], REMOTE)
      reconcileAgentAdapters(graph)
      await settle()

      expect(graph._nodes).toHaveLength(0)
      expect(minted).toEqual([])
    })

    it('retries after onAdded() throws without echoing a local add', async () => {
      seedAgentAddedNode(graph, 1, 'throws-on-added')

      expect(reconcileAgentAdapters(graph)).toEqual([])
      vi.spyOn(ThrowsOnAddedNode.prototype, 'onAdded').mockImplementation(
        () => {}
      )
      expect(reconcileAgentAdapters(graph)).toEqual([toNodeId(1)])
      await settle()

      expect(graph._nodes).toHaveLength(1)
      expect(minted).toEqual([])
    })

    it('still mints a later local widget edit on the materialized node', async () => {
      const scope = graphScopeOf(graph)
      remoteMutations(scope).addNode(
        { ...nodePayload(1, 'widget-node'), widgets_values: { value: 7 } },
        REMOTE
      )
      reconcileAgentAdapters(graph)
      await settle()

      const node = graph.getNodeById(toNodeId(1))
      node!.widgets![0].value = 8
      await settle()

      expect(minted).toEqual([
        expect.objectContaining({
          op: 'set_widget',
          node_id: toNodeId(1),
          widget: 'value',
          value: 8,
          old: 7
        })
      ])
    })
  })
})
