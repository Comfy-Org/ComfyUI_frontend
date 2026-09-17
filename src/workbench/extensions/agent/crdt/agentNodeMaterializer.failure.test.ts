import { beforeEach, describe, expect, it, vi } from 'vitest'
import { toRaw } from 'vue'

import { LGraph, LGraphNode, LiteGraph } from '@/lib/litegraph/src/litegraph'

import { reportError } from '@/platform/telemetry/reportError'
// Mirrors the production bridge in AgentPanelRoot.vue, which takes the same
// exemption to drive the real layout store.
// eslint-disable-next-line import-x/no-restricted-paths
import { layoutStore } from '@/renderer/core/layout/store/layoutStore'

import { useNodeDataStore } from '@/stores/nodeDataStore'
import { useWidgetValueStore } from '@/stores/widgetValueStore'
import { graphScopeOf } from '@/types/graphScopeId'
import { toNodeId } from '@/types/nodeId';
import type { NodeId } from '@/types/nodeId';
import { widgetId } from '@/types/widgetId'

import { reconcileAgentAdapters } from './agentNodeMaterializer'

import {
  REMOTE,
  ThrowsOnConfigureNode,
  WidgetNode,
  nodePayload,
  remoteMutations,
  seedAgentAddedNode,
  setConfigureShouldThrow,
  setupMaterializerFixtures
} from './__fixtures__/agentNodeMaterializer'

vi.mock(import('@/platform/telemetry/reportError'), () => ({
  reportError: vi.fn()
}))

beforeEach(() => {
  setupMaterializerFixtures()
})

describe('reconcileAgentAdapters', () => {
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

    it('retries add after a transient failure', () => {
      const graph = new LGraph()
      seedAgentAddedNode(graph, 1)
      const add = vi.spyOn(graph, 'add').mockImplementationOnce(() => {
        throw new Error('transient')
      })
      expect(reconcileAgentAdapters(graph)).toEqual([])
      expect(graph._nodes).toHaveLength(0)
      expect(graph.getNodeById(toNodeId(1))).toBeFalsy()
      add.mockRestore()

      expect(reconcileAgentAdapters(graph)).toEqual([toNodeId(1)])
      expect(graph._nodes).toHaveLength(1)
    })

    it('restores the incumbent when the successor fails to attach, then retries', () => {
      const graph = new LGraph()
      const scope = seedAgentAddedNode(graph, 1)
      reconcileAgentAdapters(graph)
      const incumbent = graph.getNodeById(toNodeId(1))
      remoteMutations(scope).batch(REMOTE, (batch) =>
        batch.reconcileNode(nodePayload(1, 'widget-node'))
      )
      const add = vi.spyOn(graph, 'add').mockImplementationOnce(() => {
        throw new Error('transient')
      })

      expect(reconcileAgentAdapters(graph)).toEqual([])
      expect(graph._nodes).toEqual([incumbent])
      expect(graph.getNodeById(toNodeId(1))).toBe(incumbent)
      expect(incumbent?.graph).toBe(graph)
      expect(
        useNodeDataStore().getNode(scope.rootGraphId, toNodeId(1))?.type
      ).toBe('widget-node')
      add.mockRestore()

      expect(reconcileAgentAdapters(graph)).toEqual([toNodeId(1)])
      expect(graph._nodes).toHaveLength(1)
      expect(graph.getNodeById(toNodeId(1))).toBeInstanceOf(WidgetNode)
    })

    it('restores the incumbent when the successor throws in onAdded()', () => {
      const graph = new LGraph()
      const scope = seedAgentAddedNode(graph, 1)
      reconcileAgentAdapters(graph)
      const incumbent = graph.getNodeById(toNodeId(1))
      remoteMutations(scope).batch(REMOTE, (batch) =>
        batch.reconcileNode(nodePayload(1, 'throws-on-added'))
      )

      expect(reconcileAgentAdapters(graph)).toEqual([])
      expect(graph._nodes).toEqual([incumbent])
      expect(graph.getNodeById(toNodeId(1))).toBe(incumbent)
      expect(
        useNodeDataStore().getNode(scope.rootGraphId, toNodeId(1))?.type
      ).toBe('throws-on-added')
      expect(
        layoutStore.getNodeLayout(scope.rootGraphId, toNodeId(1))
      ).toBeDefined()
      expect(reportError).toHaveBeenCalledWith(
        expect.any(Error),
        expect.objectContaining({
          errorType: 'agent_node_materialize_add_failed'
        })
      )
      expect(reportError).not.toHaveBeenCalledWith(
        expect.anything(),
        expect.objectContaining({
          errorType: 'agent_node_materialize_rollback_failed'
        })
      )
    })

    it('applies a stored undefined value over the snapshot value', () => {
      const graph = new LGraph()
      const scope = graphScopeOf(graph)
      remoteMutations(scope).addNode(
        { ...nodePayload(1, 'widget-node'), widgets_values: { value: 7 } },
        REMOTE
      )
      const id = widgetId(scope.rootGraphId, toNodeId(1), 'value')
      expect(useWidgetValueStore().setValue(id, undefined)).toBe(true)

      expect(reconcileAgentAdapters(graph)).toEqual([toNodeId(1)])
      const widget = graph.getNodeById(toNodeId(1))?.widgets?.[0]
      expect(widget?.name).toBe('value')
      expect(widget?.value).toBeUndefined()
      expect(useWidgetValueStore().getWidget(id)?.value).toBeUndefined()
    })

    it('rolls the adoption back when configure() throws', () => {
      const graph = new LGraph()
      const scope = seedAgentAddedNode(graph, 1, 'widget-node')
      const record = useNodeDataStore().getNode(scope.rootGraphId, toNodeId(1))
      const versionBefore = graph._version
      vi.spyOn(LGraphNode.prototype, 'configure').mockImplementation(() => {
        throw new Error('bad payload')
      })

      expect(reconcileAgentAdapters(graph)).toEqual([])
      expect(graph._nodes).toHaveLength(0)
      expect(graph.getNodeById(toNodeId(1))).toBeNull()
      // The canonical record survives the failed adoption by identity.
      expect(
        toRaw(useNodeDataStore().getNode(scope.rootGraphId, toNodeId(1)))
      ).toBe(toRaw(record))
      // The successor's widget registrations do not outlive it.
      expect(
        useWidgetValueStore().getNodeWidgets(scope.rootGraphId, toNodeId(1))
      ).toEqual([])
      expect(graph._version).toBe(versionBefore)
      expect(reportError).toHaveBeenCalledWith(
        expect.any(Error),
        expect.objectContaining({
          errorType: 'agent_node_materialize_configure_failed'
        })
      )
      expect(reportError).not.toHaveBeenCalledWith(
        expect.anything(),
        expect.objectContaining({
          errorType: 'agent_node_materialize_rollback_failed'
        })
      )
    })

    it('restores the incumbent when the successor throws in configure()', () => {
      const graph = new LGraph()
      const scope = seedAgentAddedNode(graph, 1)
      reconcileAgentAdapters(graph)
      const incumbent = graph.getNodeById(toNodeId(1))
      const incumbentState = toRaw(incumbent?._state)
      // A type change replaces the record; the incumbent keeps its old state
      // and is no longer the record owner.
      remoteMutations(scope).batch(REMOTE, (batch) =>
        batch.reconcileNode(nodePayload(1, 'throws-on-configure'))
      )
      const record = useNodeDataStore().getNode(scope.rootGraphId, toNodeId(1))
      expect(toRaw(record)).not.toBe(incumbentState)
      setConfigureShouldThrow(true)
      const versionBefore = graph._version

      expect(reconcileAgentAdapters(graph)).toEqual([])
      expect(graph._nodes).toEqual([incumbent])
      expect(graph.getNodeById(toNodeId(1))).toBe(incumbent)
      expect(incumbent?.graph).toBe(graph)
      expect(toRaw(incumbent?._state)).toBe(incumbentState)
      expect(
        toRaw(useNodeDataStore().getNode(scope.rootGraphId, toNodeId(1)))
      ).toBe(toRaw(record))
      expect(record?.type).toBe('throws-on-configure')
      expect(graph._version).toBe(versionBefore)
      expect(reportError).toHaveBeenCalledWith(
        expect.any(Error),
        expect.objectContaining({
          errorType: 'agent_node_materialize_configure_failed'
        })
      )

      setConfigureShouldThrow(false)
      expect(reconcileAgentAdapters(graph)).toEqual([toNodeId(1)])
      expect(graph.getNodeById(toNodeId(1))).toBeInstanceOf(
        ThrowsOnConfigureNode
      )
    })

    it('disposes the successor it built when a lifecycle hook re-enters reconciliation', () => {
      let reentrantResult: NodeId[] | undefined
      class ReentersOnAddedNode extends LGraphNode {
        constructor() {
          super('reenters-on-added')
        }

        override onAdded(graph: LGraph): void {
          reentrantResult = reconcileAgentAdapters(graph)
        }
      }
      LiteGraph.registerNodeType('reenters-on-added', ReentersOnAddedNode)
      const graph = new LGraph()
      seedAgentAddedNode(graph, 1, 'reenters-on-added')
      seedAgentAddedNode(graph, 2, 'throws-on-configure')
      const onRemoved = vi.spyOn(ThrowsOnConfigureNode.prototype, 'onRemoved')

      expect(reconcileAgentAdapters(graph)).toEqual([toNodeId(1), toNodeId(2)])

      // The inner pass built a successor for record 2 that the graph refused
      // to adopt; nobody else holds it, so the materializer must dispose it.
      // The outer pass then attaches a fresh one, which must stay untouched.
      expect(reentrantResult).toEqual([])
      expect(graph.getNodeById(toNodeId(2))).toBeInstanceOf(
        ThrowsOnConfigureNode
      )
      expect(onRemoved).toHaveBeenCalledTimes(1)
      expect(reportError).toHaveBeenCalledWith(
        'reconcileAgentAdapters re-entered from a node lifecycle hook',
        expect.objectContaining({
          errorType: 'agent_node_materialize_reentrant',
          context: { graphId: graph.id, nodeId: '2' }
        })
      )
    })
  })
})
