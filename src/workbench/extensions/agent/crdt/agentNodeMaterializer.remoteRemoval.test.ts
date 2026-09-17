import { beforeEach, describe, expect, it, vi } from 'vitest'

import { LGraph, LGraphNode, LLink } from '@/lib/litegraph/src/litegraph'
import {
  createTestSubgraphData,
  createTestSubgraphNode
} from '@/lib/litegraph/src/subgraph/__fixtures__/subgraphHelpers'
// Mirrors the production bridge in AgentPanelRoot.vue, which takes the same
// exemption to drive the real layout store.

import { useExecutionOrderStore } from '@/stores/executionOrderStore'
import { usePreviewExposureStore } from '@/stores/previewExposureStore'
import { graphScopeOf } from '@/types/graphScopeId'
import { toLinkId } from '@/types/linkId'
import { UNASSIGNED_NODE_ID, toNodeId } from '@/types/nodeId'

import { reconcileAgentAdapters } from './agentNodeMaterializer'

import {
  REMOTE,
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
  describe('remote removal of a live node', () => {
    it('runs full removal lifecycle after a remote delete', () => {
      const graph = new LGraph()
      const scope = seedAgentAddedNode(graph, 1)
      reconcileAgentAdapters(graph)
      const node = graph.getNodeById(toNodeId(1))!
      const lifecycle: string[] = []
      graph.events.addEventListener('node:before-removed', () => {
        lifecycle.push('before-removed')
      })
      node.onRemoved = () => lifecycle.push('onRemoved')
      graph.onNodeRemoved = () => lifecycle.push('onNodeRemoved')
      graph.events.addEventListener('node:removed', () => {
        lifecycle.push('node:removed')
      })
      usePreviewExposureStore().addExposure(
        scope.rootGraphId,
        String(node.id),
        { sourceNodeId: node.id, sourcePreviewName: 'preview' }
      )
      useExecutionOrderStore().set(scope, node.id, 7)
      graph.addFloatingLink(
        new LLink(toLinkId(77), '*', node.id, 0, UNASSIGNED_NODE_ID, -1)
      )

      remoteMutations(scope).deleteNode(toNodeId(1), [], REMOTE)

      expect(reconcileAgentAdapters(graph)).toEqual([])
      expect(graph._nodes).toHaveLength(0)
      expect(graph.getNodeById(toNodeId(1))).toBeFalsy()
      expect(graph.serialize().nodes).toHaveLength(0)
      expect(graph.floatingLinks.size).toBe(0)
      expect(
        usePreviewExposureStore().getExposures(
          scope.rootGraphId,
          String(node.id)
        )
      ).toEqual([])
      expect(useExecutionOrderStore().get(scope, node.id)).toBeUndefined()
      expect(lifecycle).toEqual([
        'before-removed',
        'onRemoved',
        'onNodeRemoved',
        'node:removed'
      ])
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

    it('releases an orphaned subgraph definition and its inner lifecycle', () => {
      const graph = new LGraph()
      const subgraph = graph.createSubgraph(createTestSubgraphData())
      const inner = new LGraphNode('inner')
      subgraph.add(inner)
      const host = createTestSubgraphNode(subgraph, { id: 1 })
      graph.add(host)
      const beforeRemoved = vi.fn()
      const onRemoved = vi.fn()
      subgraph.events.addEventListener('node:before-removed', beforeRemoved)
      inner.onRemoved = onRemoved
      expect(graph.subgraphs.has(subgraph.id)).toBe(true)

      remoteMutations(graphScopeOf(graph)).deleteNode(host.id, [], REMOTE)
      reconcileAgentAdapters(graph)

      expect(graph.subgraphs.has(subgraph.id)).toBe(false)
      expect(beforeRemoved).toHaveBeenCalledOnce()
      expect(onRemoved).toHaveBeenCalledOnce()
      expect(inner._graphScope).toBeUndefined()
    })
  })
})
