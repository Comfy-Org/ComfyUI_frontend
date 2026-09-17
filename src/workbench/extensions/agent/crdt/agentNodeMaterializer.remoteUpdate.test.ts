import { beforeEach, describe, expect, it, vi } from 'vitest'

import { LGraph, LiteGraph, SubgraphNode } from '@/lib/litegraph/src/litegraph'
import {
  createTestSubgraphData,
  createTestSubgraphNode,
  enableSubgraphNodeCreation
} from '@/lib/litegraph/src/subgraph/__fixtures__/subgraphHelpers'
import { reportError } from '@/platform/telemetry/reportError'
// Mirrors the production bridge in AgentPanelRoot.vue, which takes the same
// exemption to drive the real layout store.
// eslint-disable-next-line import-x/no-restricted-paths
import { layoutStore } from '@/renderer/core/layout/store/layoutStore'

import { useExecutionOrderStore } from '@/stores/executionOrderStore'
import { useNodeDataStore } from '@/stores/nodeDataStore'
import { useWidgetValueStore } from '@/stores/widgetValueStore'
import { graphScopeOf } from '@/types/graphScopeId'
import { toLinkId } from '@/types/linkId'
import { toNodeId } from '@/types/nodeId'
import { widgetId } from '@/types/widgetId'

import { reconcileAgentAdapters } from './agentNodeMaterializer'

import {
  DummyNode,
  REMOTE,
  WidgetNode,
  nodePayload,
  remoteMutations,
  seedAgentAddedNode,
  setupMaterializerFixtures
} from './__fixtures__/agentNodeMaterializer'

vi.mock(import('@/platform/telemetry/reportError'), () => ({
  reportError: vi.fn()
}))

beforeEach(() => {
  setupMaterializerFixtures()
})

describe('reconcileAgentAdapters', () => {
  describe('remote update of a live node', () => {
    it('retains a subgraph needed by another replacement in the same batch', () => {
      const graph = new LGraph()
      const disable = enableSubgraphNodeCreation(graph)
      try {
        const subgraph = graph.createSubgraph(createTestSubgraphData())
        const inner = new DummyNode()
        inner.id = toNodeId(3)
        subgraph.add(inner)
        graph.add(createTestSubgraphNode(subgraph, { id: 1 }))
        const scope = seedAgentAddedNode(graph, 2)
        reconcileAgentAdapters(graph)
        remoteMutations(scope).batch(REMOTE, (batch) => {
          batch.reconcileNode(nodePayload(1))
          batch.reconcileNode(nodePayload(2, subgraph.id))
        })

        expect(reconcileAgentAdapters(graph)).toEqual([
          toNodeId(1),
          toNodeId(2)
        ])
        expect(graph.subgraphs.get(subgraph.id)).toBe(subgraph)
        expect(subgraph.nodes).toEqual([inner])
        expect(graph.getNodeById(toNodeId(2))).toBeInstanceOf(SubgraphNode)
      } finally {
        disable()
      }
    })

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

    it('runs stale-node lifecycle without clearing successor-owned state', () => {
      const graph = new LGraph()
      const scope = graphScopeOf(graph)
      const mutations = remoteMutations(scope)
      mutations.batch(REMOTE, (batch) => {
        batch.addNode({
          ...nodePayload(1, 'widget-node'),
          outputs: [{ name: 'value', type: '*', links: [] }],
          widgets_values: { value: 7 }
        })
        batch.addNode({
          ...nodePayload(2),
          inputs: [{ name: 'value', type: '*', link: null }]
        })
        batch.connect({
          id: 9,
          originNodeId: 1,
          originSlot: 0,
          targetNodeId: 2,
          targetSlot: 0,
          type: '*'
        })
      })
      reconcileAgentAdapters(graph)

      const stale = graph.getNodeById(toNodeId(1))!
      const lifecycle: string[] = []
      const resources = new Map([[stale.id, stale]])
      graph.events.addEventListener('node:before-removed', (event) => {
        if (event.detail.node === stale) lifecycle.push('before-removed')
      })
      stale.onRemoved = () => {
        lifecycle.push('onRemoved')
        resources.delete(stale.id)
      }
      class ReplacementNode extends WidgetNode {
        override onAdded() {
          lifecycle.push('onAdded')
          expect(graph._nodes).not.toContain(stale)
          resources.set(this.id, this)
        }

        override onConfigure() {
          lifecycle.push('onConfigure')
        }
      }
      LiteGraph.registerNodeType('replacement-node', ReplacementNode)
      mutations.batch(REMOTE, (batch) => {
        batch.reconcileNode({
          ...nodePayload(1, 'replacement-node'),
          outputs: [{ name: 'value', type: '*', links: [] }],
          widgets_values: { value: 7 }
        })
        batch.connect({
          id: 9,
          originNodeId: 1,
          originSlot: 0,
          targetNodeId: 2,
          targetSlot: 0,
          type: '*'
        })
      })

      expect(reconcileAgentAdapters(graph)).toEqual([toNodeId(1)])

      const replacement = graph.getNodeById(toNodeId(1))!
      expect(lifecycle).toEqual([
        'before-removed',
        'onRemoved',
        'onAdded',
        'onConfigure'
      ])
      expect(replacement).not.toBe(stale)
      expect(resources.get(stale.id)).toBe(replacement)
      expect(graph._nodes).not.toContain(stale)
      expect(graph.getLink(toLinkId(9))).toMatchObject({
        origin_id: toNodeId(1),
        target_id: toNodeId(2)
      })
      expect(
        useWidgetValueStore().getWidget(
          widgetId(scope.rootGraphId, toNodeId(1), 'value')
        )?.value
      ).toBe(7)
      expect(
        layoutStore.getNodeLayout(scope.rootGraphId, toNodeId(1))
      ).toBeDefined()
      expect(useExecutionOrderStore().get(scope, toNodeId(1))).toBeDefined()
    })

    it('keeps the incumbent when successor creation throws, and can retry', () => {
      const graph = new LGraph()
      const scope = seedAgentAddedNode(graph, 1)
      reconcileAgentAdapters(graph)
      const stale = graph.getNodeById(toNodeId(1))!
      const onRemoved = vi.fn()
      stale.onRemoved = onRemoved
      const failure = new Error('extension creation failed')
      let creationFails = true
      class ReplacementNode extends WidgetNode {
        override onNodeCreated() {
          if (creationFails) throw failure
        }
      }
      LiteGraph.registerNodeType('replacement-node', ReplacementNode)
      remoteMutations(scope).batch(REMOTE, (batch) =>
        batch.reconcileNode({
          ...nodePayload(1, 'replacement-node'),
          widgets_values: { value: 7 }
        })
      )

      expect.soft(() => reconcileAgentAdapters(graph)).not.toThrow()
      expect(graph._nodes).toHaveLength(1)
      expect(graph.getNodeById(stale.id)).toBe(stale)
      expect(stale.graph).toBe(graph)
      expect(onRemoved).not.toHaveBeenCalled()
      expect(reportError).toHaveBeenCalledWith(failure, {
        errorType: 'agent_node_materialize_create_failed',
        context: { graphId: graph.id, nodeId: '1' }
      })

      creationFails = false
      expect(reconcileAgentAdapters(graph)).toEqual([stale.id])
      expect(graph._nodes).toHaveLength(1)
      expect(graph.getNodeById(stale.id)).not.toBe(stale)
      expect(graph.getNodeById(stale.id)?.widgets?.[0].value).toBe(7)
      expect(onRemoved).toHaveBeenCalledOnce()
      expect(stale.graph).toBeNull()
    })

    it('cleans up the unused successor when incumbent removal throws, and can retry', () => {
      const graph = new LGraph()
      const scope = seedAgentAddedNode(graph, 1)
      reconcileAgentAdapters(graph)
      const stale = graph.getNodeById(toNodeId(1))!
      const resources = new Map([[stale.id, stale]])
      const failure = new Error('extension cleanup failed')
      stale.onRemoved = () => {
        throw failure
      }
      const events = new EventTarget()
      let handled = 0
      class ReplacementNode extends WidgetNode {
        listener = () => handled++

        constructor() {
          super()
          events.addEventListener('probe', this.listener)
        }

        override onRemoved() {
          events.removeEventListener('probe', this.listener)
          resources.delete(this.id)
        }

        override onAdded() {
          resources.set(this.id, this)
        }
      }
      LiteGraph.registerNodeType('replacement-node', ReplacementNode)
      remoteMutations(scope).batch(REMOTE, (batch) =>
        batch.reconcileNode({
          ...nodePayload(1, 'replacement-node'),
          widgets_values: { value: 7 }
        })
      )

      expect(reconcileAgentAdapters(graph)).toEqual([])
      events.dispatchEvent(new Event('probe'))
      expect(handled).toBe(0)
      expect(resources.get(stale.id)).toBe(stale)
      expect(graph._nodes).toEqual([stale])
      expect(graph.getNodeById(stale.id)).toBe(stale)
      expect(
        useNodeDataStore().getNode(scope.rootGraphId, stale.id)?.type
      ).toBe('replacement-node')
      expect(
        layoutStore.getNodeLayout(scope.rootGraphId, stale.id)
      ).toBeDefined()
      expect(reportError).toHaveBeenCalledWith(failure, {
        errorType: 'agent_node_materialize_remove_failed',
        context: { graphId: graph.id, nodeId: '1' }
      })

      stale.onRemoved = undefined
      expect(reconcileAgentAdapters(graph)).toEqual([stale.id])
      expect(graph._nodes).toHaveLength(1)
      events.dispatchEvent(new Event('probe'))
      expect(handled).toBe(1)
      expect(resources.get(stale.id)).toBe(graph.getNodeById(stale.id))
      expect(graph.getNodeById(stale.id)?.widgets?.[0].value).toBe(7)
      expect(stale.graph).toBeNull()
    })
  })
})
