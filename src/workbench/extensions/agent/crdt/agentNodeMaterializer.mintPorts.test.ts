import { afterEach, assert, beforeEach, describe, expect, it, vi } from 'vitest'

import { addAutogrow } from '@/core/graph/widgets/__fixtures__/dynamicInputHelpers'
import type { LGraphNode } from '@/lib/litegraph/src/litegraph'
import { LGraph, LiteGraph } from '@/lib/litegraph/src/litegraph'

import { reportError } from '@/platform/telemetry/reportError'
// Mirrors the production bridge in AgentPanelRoot.vue, which takes the same
// exemption to drive the real layout store.
// eslint-disable-next-line import-x/no-restricted-paths
import { layoutStore } from '@/renderer/core/layout/store/layoutStore'

import { useNodeDataStore } from '@/stores/nodeDataStore'
import { useWidgetValueStore } from '@/stores/widgetValueStore'
import type { GraphScope } from '@/types/graphScopeId'
import { graphScopeOf } from '@/types/graphScopeId'
import { toNodeId } from '@/types/nodeId'
import { widgetId } from '@/types/widgetId'

import { reconcileAgentAdapters } from './agentNodeMaterializer'
import type { GraphOperation } from './graphOperations'
import { attachMintPortWiring } from './mintPortWiring'
import type { MintPortWiring } from './mintPortWiring'

import {
  REMOTE,
  ThrowsOnAddedNode,
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

    it('restores a usable spare autogrow input omitted by reconciliation', async () => {
      const node = LiteGraph.createNode('widget-node')
      const upstream = LiteGraph.createNode('dummy')
      if (!node || !upstream) throw new Error('Test node types not registered')
      graph.add(node)
      graph.add(upstream)
      upstream.addOutput('image', 'IMAGE')
      const names = ['image_1', 'image_2', 'image_3']
      const inputNames = names.map((name) => `0.${name}`)
      addAutogrow(node, {
        input: { required: { image: ['IMAGE', {}] } },
        names
      })
      node.addInput('obsolete', 'IMAGE')
      const firstLink = upstream.connect(0, node, 0)
      if (!firstLink) throw new Error('Initial image connection failed')
      const widget = node.widgets?.[0]
      if (!widget) throw new Error('Expected value widget')
      widget.value = 7
      node.serialize_widgets = true
      const configure = vi.spyOn(node, 'configure')
      const serialized = node.serialize()
      expect(serialized.widgets_values).toEqual([7])
      const payload = {
        ...serialized,
        inputs: serialized.inputs?.slice(0, 1)
      }
      const mutations = remoteMutations(graphScopeOf(graph))
      await settle()
      minted.length = 0

      for (let frame = 0; frame < 2; frame++) {
        expect(
          mutations.batch(REMOTE, (batch) => batch.reconcileNode(payload))
        ).toBe(true)
        expect(reconcileAgentAdapters(graph)).toEqual([])
        await settle()

        expect(node.inputs.map(({ name }) => name)).toEqual(
          inputNames.slice(0, 2)
        )
        expect(node.getInputLink(0)).toBe(firstLink)
        expect(node.widgets).toEqual([widget])
        expect(widget.value).toBe(7)
        expect(configure).not.toHaveBeenCalled()
        expect(minted).toEqual([])
      }

      const spare = node.inputs[1]
      reconcileAgentAdapters(graph)
      expect(node.inputs[1]).toBe(spare)
      const secondLink = upstream.connect(0, node, 1)
      if (!secondLink) throw new Error('Restored image connection failed')
      expect(node.inputs.map(({ name }) => name)).toEqual(inputNames)
      expect(node.getInputLink(0)).toBe(firstLink)
      expect(node.getInputLink(1)).toBe(secondLink)
      expect(node.getInputLink(2)).toBeNull()
      expect(widget.value).toBe(7)

      const thirdLink = upstream.connect(0, node, 2)
      if (!thirdLink) throw new Error('Final image connection failed')
      reconcileAgentAdapters(graph)
      reconcileAgentAdapters(graph)
      expect(node.inputs.map(({ name }) => name)).toEqual(inputNames)
      expect(node.getInputLink(2)).toBe(thirdLink)
      await settle()
      minted.length = 0

      expect(
        mutations.batch(REMOTE, (batch) => {
          batch.reconcileNode({ ...payload, inputs: [] })
          batch.removeLinks([firstLink.id, secondLink.id, thirdLink.id])
        })
      ).toBe(true)
      reconcileAgentAdapters(graph)
      await settle()
      expect(node.inputs).toEqual([])
      expect(upstream.isOutputConnected(0)).toBe(false)
      expect(widget.value).toBe(7)
      expect(minted).toEqual([])
    })

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

    const REPLACEMENT_PAYLOAD = {
      ...nodePayload(1, 'replacement-node'),
      properties: { remoteValue: 7 },
      widgets_values: { value: 7 }
    }

    /** A successor whose onAdded and rollback onRemoved both throw until told otherwise. */
    function failingReplacementType() {
      const control = { fails: true, instances: [] as LGraphNode[] }
      class ReplacementNode extends WidgetNode {
        constructor() {
          super()
          control.instances.push(this)
        }

        override onAdded() {
          if (control.fails) throw new Error('replacement add failed')
        }

        override onRemoved() {
          if (control.fails) throw new Error('replacement cleanup failed')
        }
      }
      LiteGraph.registerNodeType('replacement-node', ReplacementNode)
      return control
    }

    async function expectAuthorityRestored(
      scope: GraphScope,
      incumbent: LGraphNode[],
      control: { fails: boolean; instances: LGraphNode[] }
    ) {
      const nodeStore = useNodeDataStore()
      const authoritative = nodeStore.getNode(scope.rootGraphId, toNodeId(1))
      expect(authoritative).toBeDefined()

      // The successor leaves by membership and the incumbent is back at once.
      expect(reconcileAgentAdapters(graph)).toEqual([])
      expect(graph._nodes).toEqual(incumbent)
      for (const node of incumbent) expect(node.graph).toBe(graph)
      // The failed successor is fully detached by the graph, not just dropped
      // from the node lists.
      for (const successor of control.instances) {
        expect(successor.graph).toBeNull()
        expect(successor._graphScope).toBeUndefined()
      }
      expect(nodeStore.getNode(scope.rootGraphId, toNodeId(1))).toBe(
        authoritative
      )
      for (const errorType of [
        'agent_node_materialize_add_failed',
        'agent_node_materialize_rollback_failed'
      ]) {
        expect(reportError).toHaveBeenCalledWith(
          expect.anything(),
          expect.objectContaining({ errorType })
        )
      }

      expect(reconcileAgentAdapters(graph)).toEqual([])
      expect(graph._nodes).toEqual(incumbent)
      expect(
        useWidgetValueStore().getWidget(
          widgetId(scope.rootGraphId, toNodeId(1), 'value')
        )?.value
      ).toBe(7)

      control.fails = false
      expect(reconcileAgentAdapters(graph)).toEqual([toNodeId(1)])
      const restored = graph.getNodeById(toNodeId(1))!
      expect(graph._nodes).toEqual([restored])
      expect(incumbent).not.toContain(restored)
      expect(restored.properties).toEqual(REPLACEMENT_PAYLOAD.properties)
      expect(restored.widgets?.[0].value).toBe(7)
      expect(nodeStore.ownsNode(scope, restored._state)).toBe(true)
      expect(
        layoutStore.getNodeLayout(scope.rootGraphId, restored.id)
      ).toBeDefined()
      expect(reconcileAgentAdapters(graph)).toEqual([])
      expect(graph.getNodeById(restored.id)).toBe(restored)
      await settle()
      expect(minted).toEqual([])
    }

    it('restores add authority after a dual lifecycle failure', async () => {
      const control = failingReplacementType()
      const scope = graphScopeOf(graph)
      remoteMutations(scope).addNode(REPLACEMENT_PAYLOAD, REMOTE)

      await expectAuthorityRestored(scope, [], control)
    })

    it('restores replace authority after a dual lifecycle failure', async () => {
      const control = failingReplacementType()
      const scope = graphScopeOf(graph)
      seedAgentAddedNode(graph, 1, 'widget-node')
      reconcileAgentAdapters(graph)
      const original = graph.getNodeById(toNodeId(1))
      assert(original, 'missing incumbent')
      remoteMutations(scope).batch(REMOTE, (batch) =>
        batch.reconcileNode(REPLACEMENT_PAYLOAD)
      )

      await expectAuthorityRestored(scope, [original], control)
      expect(original.graph).toBeNull()
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
