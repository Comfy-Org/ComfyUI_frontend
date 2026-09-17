import {
  applyOps,
  linksMap,
  mint,
  nodesMap
} from '@comfyorg/comfy-multi-player'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import * as Y from 'yjs'

import { promoteValueWidgetViaSubgraphInput } from '@/core/graph/subgraph/promotionUtils'
import { LGraph, LGraphNode, LLink } from '@/lib/litegraph/src/litegraph'
import { setupComplexPromotionFixture } from '@/lib/litegraph/src/subgraph/__fixtures__/subgraphHelpers'
// Mirrors the production bridge in AgentPanelRoot.vue, which takes the same
// exemption to drive the real layout store.

import { useLinkStore } from '@/stores/linkStore'
import { useNodeDataStore } from '@/stores/nodeDataStore'
import { useWidgetValueStore } from '@/stores/widgetValueStore'
import { graphScopeOf } from '@/types/graphScopeId'
import { toLinkId } from '@/types/linkId'
import { UNASSIGNED_NODE_ID, toNodeId } from '@/types/nodeId'
import { widgetId } from '@/types/widgetId'

import { reconcileAgentAdapters } from './agentNodeMaterializer'
import { EcsFollowerAdapter } from './ecsFollowerAdapter'
import { FollowerDoc } from './followerDoc'

import {
  CATALOG,
  REMOTE,
  agentOperation,
  remoteMutations,
  setupMaterializerFixtures
} from './__fixtures__/agentNodeMaterializer'

vi.mock(import('@/platform/telemetry/reportError'), () => ({
  reportError: vi.fn()
}))

beforeEach(() => {
  setupMaterializerFixtures()
})

describe('reconcileAgentAdapters', () => {
  it.for([false, true])(
    'retains promoted controls after reconciling a live subgraph (empty values: %s)',
    (emptyValues) => {
      const { graph, subgraph, hostNode } = setupComplexPromotionFixture()
      const settings = new LGraphNode('Settings')
      subgraph.add(settings)
      const steps = settings.addWidget('number', 'steps', 8, () => {}, {
        min: 1,
        max: 100
      })
      settings.addInput('steps', 'INT').widget = { name: 'steps' }
      expect(
        promoteValueWidgetViaSubgraphInput(hostNode, settings, steps).ok
      ).toBe(true)
      useWidgetValueStore().setValue(
        widgetId(graph.id, hostNode.id, 'steps'),
        12
      )
      expect(hostNode.widgets.find(({ name }) => name === 'steps')?.value).toBe(
        12
      )
      const widgets = hostNode.widgets.map(({ name, value, type }) => ({
        name,
        value,
        type
      }))
      expect(widgets.length).toBeGreaterThan(0)
      const inputs = hostNode.inputs.map((input) => input.widgetId)
      const serialized = hostNode.serialize()
      const floating = new LLink(
        toLinkId(98),
        'INT',
        UNASSIGNED_NODE_ID,
        -1,
        hostNode.id,
        1
      )
      graph.addFloatingLink(floating)
      hostNode.inputs[0].boundingRect = [10, 20, 30, 40]

      expect(
        remoteMutations(graphScopeOf(graph)).batch(REMOTE, (batch) =>
          batch.reconcileNode({
            ...serialized,
            widgets_values: emptyValues ? [] : serialized.widgets_values,
            inputs: emptyValues
              ? serialized.inputs?.slice(0, 1)
              : serialized.inputs,
            properties: emptyValues
              ? {
                  ...serialized.properties,
                  proxyWidgets: [[String(settings.id), 'steps']]
                }
              : serialized.properties
          })
        )
      ).toBe(true)
      reconcileAgentAdapters(graph)

      expect(graph.getNodeById(hostNode.id)).toBe(hostNode)
      expect(
        hostNode.widgets.map(({ name, value, type }) => ({ name, value, type }))
      ).toEqual(widgets)
      expect(hostNode.inputs.map((input) => input.widgetId)).toEqual(inputs)
      expect(graph.floatingLinks.get(floating.id)).toBe(floating)
      expect(hostNode.inputs[0].boundingRect).toEqual([10, 20, 30, 40])
      expect(hostNode.serialize().widgets_values).toEqual(
        serialized.widgets_values
      )

      const upstream = new LGraphNode('Upstream')
      upstream.addOutput('text', 'STRING')
      graph.add(upstream)
      expect(
        remoteMutations(graphScopeOf(graph)).connect(
          {
            id: 99,
            originNodeId: upstream.id,
            originSlot: 0,
            targetNodeId: hostNode.id,
            targetSlot: 0,
            type: 'STRING',
            targetInputs: serialized.inputs?.map((input, index) => ({
              ...input,
              link: index === 0 ? 99 : input.link
            }))
          },
          REMOTE
        )
      ).toBe(true)
      reconcileAgentAdapters(graph)
      expect(hostNode.inputs[0].link).toBe(toLinkId(99))
      expect(graph.floatingLinks.get(floating.id)).toBe(floating)
      expect(hostNode.inputs[0].boundingRect).toEqual([10, 20, 30, 40])
      expect(hostNode.widgets.map(({ value }) => value)).toEqual(
        widgets.map(({ value }) => value)
      )
    }
  )

  it('converges create, connect, save/reload, readback, and delete across every graph surface', () => {
    const graph = new LGraph()
    const scope = graphScopeOf(graph)
    const host = mint({ nodes: [], links: [] }, CATALOG)
    const follower = new FollowerDoc()
    const adapter = new EcsFollowerAdapter(remoteMutations(scope))
    adapter.bind('workflow', follower)

    let sequence = 0
    let initialFrame = true
    const deliver = (payload: object) => {
      const stateVector = Y.encodeStateVector(host)
      const opId = `agent-op-${++sequence}`
      const result = applyOps(
        host,
        [agentOperation(opId, sequence, payload)] as Parameters<
          typeof applyOps
        >[1],
        CATALOG
      )
      expect(result.outcomes).toEqual([{ op_id: opId, outcome: 'applied' }])

      const update = initialFrame
        ? Y.encodeStateAsUpdate(host)
        : Y.encodeStateAsUpdate(host, stateVector)
      initialFrame = false
      follower.applyRemoteUpdate(update)
      expect(
        adapter.applyFrame({
          workflowId: 'workflow',
          seq: sequence,
          update,
          actor: 'agent:test',
          opIds: [opId]
        })
      ).toBe(true)
      reconcileAgentAdapters(graph)
    }

    deliver({
      op: 'add_node',
      node_id: 1,
      class_type: 'dummy',
      pos: [10, 20],
      node: {
        id: 1,
        type: 'dummy',
        pos: [10, 20],
        size: [100, 80],
        inputs: [],
        outputs: [{ name: 'image', type: 'IMAGE', links: [] }]
      }
    })
    deliver({
      op: 'add_node',
      node_id: 2,
      class_type: 'dummy',
      pos: [300, 20],
      node: {
        id: 2,
        type: 'dummy',
        pos: [300, 20],
        size: [100, 80],
        inputs: [{ name: 'image', type: 'IMAGE', link: null }],
        outputs: []
      }
    })
    deliver({
      op: 'connect',
      link_id: 9,
      from_node: 1,
      from_slot: 0,
      to_node: 2,
      to_slot: 0,
      link_type: 'IMAGE'
    })

    const source = graph.getNodeById(toNodeId(1))
    const target = graph.getNodeById(toNodeId(2))
    expect(source).toBeTruthy()
    expect(target).toBeTruthy()
    target?.updateArea()
    expect(graph.getNodeOnPos(350, 60)).toBe(target)
    expect(
      useNodeDataStore()
        .getGraphNodesFor(scope.rootGraphId, scope.owningGraphId)
        .map(({ id }) => id)
    ).toEqual(graph._nodes.map(({ id }) => id))

    const topology = useLinkStore().getInputSlotLink(scope, toNodeId(2), 0)
    expect(topology?.id).toBe(toLinkId(9))
    expect(graph.getLink(toLinkId(9))).toMatchObject({
      origin_id: toNodeId(1),
      target_id: toNodeId(2)
    })
    expect(nodesMap(follower.doc).has('2')).toBe(true)
    expect(linksMap(follower.doc).has('9')).toBe(true)

    const saved = structuredClone(graph.asSerialisable({ sortNodes: true }))
    expect(saved.nodes.map(({ id }) => id)).toEqual([1, 2])
    expect(saved.links?.map(({ id }) => id)).toEqual([toLinkId(9)])

    graph.configure(saved)
    expect(graph.getNodeById(toNodeId(1))).toBeTruthy()
    expect(graph.getNodeById(toNodeId(2))).toBeTruthy()
    expect(graph.getLink(toLinkId(9))).toBeTruthy()

    deliver({ op: 'delete_node', node_id: 2, removed_links: [9] })

    expect(nodesMap(follower.doc).has('2')).toBe(false)
    expect(linksMap(follower.doc).has('9')).toBe(false)
    expect(graph.getNodeById(toNodeId(1))).toBeTruthy()
    expect(graph.getNodeById(toNodeId(2))).toBeFalsy()
    expect(graph.getLink(toLinkId(9))).toBeUndefined()
    expect(
      useNodeDataStore()
        .getGraphNodesFor(scope.rootGraphId, scope.owningGraphId)
        .map(({ id }) => id)
    ).toEqual(graph._nodes.map(({ id }) => id))
    expect(graph.asSerialisable().nodes.map(({ id }) => id)).toEqual([1])
    expect(graph.asSerialisable().links).toBeUndefined()

    adapter.destroy()
    follower.destroy()
    host.destroy()
  })
})
