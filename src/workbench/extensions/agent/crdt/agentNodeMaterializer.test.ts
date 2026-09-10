import {
  applyOps,
  linksMap,
  mint,
  nodesMap
} from '@comfyorg/comfy-multi-player'
import type { WidgetCatalog } from '@comfyorg/comfy-multi-player'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import * as Y from 'yjs'

import { createGraphMutations } from '@/core/graph/graphMutations'
import { promoteValueWidgetViaSubgraphInput } from '@/core/graph/subgraph/promotionUtils'
import { addAutogrow } from '@/core/graph/widgets/__fixtures__/dynamicInputHelpers'
import {
  LGraph,
  LGraphNode,
  LiteGraph,
  LLink,
  SubgraphNode
} from '@/lib/litegraph/src/litegraph'
import {
  createTestSubgraphData,
  createTestSubgraphNode,
  enableSubgraphNodeCreation,
  setupComplexPromotionFixture
} from '@/lib/litegraph/src/subgraph/__fixtures__/subgraphHelpers'
import { reportError } from '@/platform/telemetry/reportError'
// Mirrors the production bridge in AgentPanelRoot.vue, which takes the same
// exemption to drive the real layout store.
// eslint-disable-next-line import-x/no-restricted-paths
import { layoutStore } from '@/renderer/core/layout/store/layoutStore'
// eslint-disable-next-line import-x/no-restricted-paths
import { LayoutSource } from '@/renderer/core/layout/types'
import { useExecutionOrderStore } from '@/stores/executionOrderStore'
import { useLinkStore } from '@/stores/linkStore'
import { useNodeDataStore } from '@/stores/nodeDataStore'
import { usePreviewExposureStore } from '@/stores/previewExposureStore'
import { useWidgetValueStore } from '@/stores/widgetValueStore'
import type { GraphScope } from '@/types/graphScopeId'
import { graphScopeOf } from '@/types/graphScopeId'
import type { RemoteMutationContext } from '@/types/graphMutationContext'
import { toLinkId } from '@/types/linkId'
import { UNASSIGNED_NODE_ID, toNodeId } from '@/types/nodeId'
import { widgetId } from '@/types/widgetId'

import { reconcileAgentAdapters } from './agentNodeMaterializer'
import { readSubgraphDefinitions } from './agentSubgraphDefinitions'
import { EcsFollowerAdapter } from './ecsFollowerAdapter'
import { FollowerDoc } from './followerDoc'
import type { GraphOperation } from './graphOperations'
import { attachMintPortWiring } from './mintPortWiring'
import type { MintPortWiring } from './mintPortWiring'

vi.mock(import('@/platform/telemetry/reportError'), () => ({
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

/** Widget values observed by `onConfigure`, in configure order. */
const configuredWidgetValues: unknown[] = []

class ConfigureCapturingWidgetNode extends WidgetNode {
  override onConfigure(): void {
    configuredWidgetValues.push(this.widgets?.[0]?.value)
  }
}

/** Toggled per test; a definition holding this type fails to instantiate. */
let configureShouldThrow = false

class ThrowsOnConfigureNode extends LGraphNode {
  constructor() {
    super('throws-on-configure')
  }

  override onConfigure(): void {
    if (configureShouldThrow) throw new Error('interior node rejected')
  }

  override onRemoved(): void {}
}

class ThrowsOnAddedNode extends LGraphNode {
  constructor() {
    super('throws-on-added')
  }

  override onAdded(): void {
    throw new Error('extension code blew up in onAdded')
  }

  // Declared (as a no-op) so a test can make the rollback's own cleanup throw.
  // `LGraphNode.onRemoved` is optional, so it is absent from the prototype and
  // cannot be spied on otherwise.
  override onRemoved(): void {}
}

const REMOTE: RemoteMutationContext = {
  source: 'agent-remote',
  actor: 'agent:test',
  opId: 'op-test'
}
const CATALOG: WidgetCatalog = {
  types: {
    dummy: { widget_order: [] },
    'widget-node': { widget_order: ['value'] },
    'configure-capture': { widget_order: ['value'] },
    'throws-on-configure': { widget_order: [] }
  }
}

function agentOperation(id: string, version: number, payload: object) {
  return {
    op_id: id,
    actor: 'agent:test',
    base_version: version,
    stamp: [version, 'agent:test', id],
    ...payload
  }
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
  LiteGraph.registerNodeType('dummy', DummyNode)
  LiteGraph.registerNodeType('widget-node', WidgetNode)
  LiteGraph.registerNodeType('configure-capture', ConfigureCapturingWidgetNode)
  LiteGraph.registerNodeType('throws-on-configure', ThrowsOnConfigureNode)
  LiteGraph.registerNodeType('throws-on-added', ThrowsOnAddedNode)
  configuredWidgetValues.length = 0
  configureShouldThrow = false
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

    it('restores named combo and text values before onConfigure', () => {
      const observed: unknown[] = []
      class NamedWidgetNode extends LGraphNode {
        constructor() {
          super('named-widgets')
          this.addWidget('combo', 'model', 'default', () => {}, {
            values: ['default', 'chosen']
          })
          this.addWidget('text', 'prompt', '', () => {})
        }
        override onConfigure() {
          observed.push(this.widgets?.map(({ value }) => value))
        }
      }
      LiteGraph.registerNodeType('named-widgets', NamedWidgetNode)
      const previous = LiteGraph.namedValuesRestore
      LiteGraph.namedValuesRestore = false
      try {
        const graph = new LGraph()
        remoteMutations(graphScopeOf(graph)).addNode(
          {
            ...nodePayload(1, 'named-widgets'),
            widgets_values: { model: 'chosen', prompt: 'Preserve this prompt' }
          },
          REMOTE
        )

        reconcileAgentAdapters(graph)

        expect(observed).toEqual([['chosen', 'Preserve this prompt']])
        expect(
          graph.getNodeById(toNodeId(1))?.widgets?.map(({ value }) => value)
        ).toEqual(['chosen', 'Preserve this prompt'])
        expect(LiteGraph.namedValuesRestore).toBe(false)
      } finally {
        LiteGraph.namedValuesRestore = previous
        LiteGraph.unregisterNodeType('named-widgets')
      }
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
      mutations.batch(REMOTE, (batch) =>
        batch.reconcileNode({
          ...nodePayload(1, 'replacement-node'),
          outputs: [{ name: 'value', type: '*', links: [9] }],
          widgets_values: { value: 7 }
        })
      )

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

    it.for([false, true])(
      'retries a failed add (replacement: %s)',
      (replacement) => {
        const graph = new LGraph()
        const scope = seedAgentAddedNode(graph, 1)
        if (replacement) {
          reconcileAgentAdapters(graph)
          remoteMutations(scope).batch(REMOTE, (batch) =>
            batch.reconcileNode(nodePayload(1, 'widget-node'))
          )
        }
        const add = vi.spyOn(graph, 'add').mockImplementationOnce(() => {
          throw new Error('transient')
        })
        expect(reconcileAgentAdapters(graph)).toEqual([])
        expect(graph._nodes).toHaveLength(0)
        expect(graph.getNodeById(toNodeId(1))).toBeFalsy()
        add.mockRestore()

        expect(reconcileAgentAdapters(graph)).toEqual([toNodeId(1)])
        expect(graph._nodes).toHaveLength(1)
      }
    )

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

    it('restores a usable spare autogrow input omitted by reconciliation', async () => {
      const node = LiteGraph.createNode('widget-node')
      const upstream = LiteGraph.createNode('dummy')
      if (!node || !upstream) throw new Error('Test node types not registered')
      graph.add(node)
      graph.add(upstream)
      upstream.addOutput('image', 'IMAGE')
      addAutogrow(node, {
        input: { required: { image: ['IMAGE', {}] } },
        names: ['image_1', 'image_2', 'image_3']
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

        expect(node.inputs.map(({ name }) => name)).toEqual([
          '0.image_1',
          '0.image_2'
        ])
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
      expect(node.inputs.map(({ name }) => name)).toEqual([
        '0.image_1',
        '0.image_2',
        '0.image_3'
      ])
      expect(node.getInputLink(0)).toBe(firstLink)
      expect(node.getInputLink(1)).toBe(secondLink)
      expect(node.getInputLink(2)).toBeNull()
      expect(widget.value).toBe(7)

      const thirdLink = upstream.connect(0, node, 2)
      if (!thirdLink) throw new Error('Final image connection failed')
      reconcileAgentAdapters(graph)
      reconcileAgentAdapters(graph)
      expect(node.inputs.map(({ name }) => name)).toEqual([
        '0.image_1',
        '0.image_2',
        '0.image_3'
      ])
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

    it.for([false, true])(
      'restores authority and retries after repeated cleanup failures (replacement: %s)',
      async (replacement) => {
        let fails = true
        class ReplacementNode extends WidgetNode {
          override onAdded() {
            if (fails) throw new Error('replacement add failed')
          }

          override onRemoved() {
            if (fails) throw new Error('replacement cleanup failed')
          }
        }
        LiteGraph.registerNodeType('replacement-node', ReplacementNode)
        const scope = graphScopeOf(graph)
        if (replacement) {
          seedAgentAddedNode(graph, 1, 'widget-node')
          reconcileAgentAdapters(graph)
        }
        const original = graph.getNodeById(toNodeId(1))
        const payload = {
          ...nodePayload(1, 'replacement-node'),
          properties: { remoteValue: 7 },
          widgets_values: { value: 7 }
        }
        const mutations = remoteMutations(scope)
        if (replacement) {
          mutations.batch(REMOTE, (batch) => batch.reconcileNode(payload))
        } else {
          mutations.addNode(payload, REMOTE)
        }
        const nodeStore = useNodeDataStore()
        const authoritative = nodeStore.getNode(scope.rootGraphId, toNodeId(1))
        expect(authoritative).toBeDefined()

        expect(reconcileAgentAdapters(graph)).toEqual([])
        const partial = graph.getNodeById(toNodeId(1))!
        if (replacement) expect(original?.graph).toBeNull()
        expect(partial).not.toBe(original)
        expect(nodeStore.getNode(scope.rootGraphId, partial.id)).toBe(
          authoritative
        )
        expect(nodeStore.ownsNode(scope, partial._state)).toBe(false)
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
        expect(nodeStore.getNode(scope.rootGraphId, partial.id)).toBe(
          authoritative
        )
        expect(nodeStore.ownsNode(scope, partial._state)).toBe(false)
        expect(graph._nodes).toEqual([partial])
        expect(
          useWidgetValueStore().getWidget(
            widgetId(scope.rootGraphId, partial.id, 'value')
          )?.value
        ).toBe(7)

        fails = false
        expect(reconcileAgentAdapters(graph)).toEqual([partial.id])
        const restored = graph.getNodeById(partial.id)!
        expect(partial.graph).toBeNull()
        expect(graph._nodes).toEqual([restored])
        expect(restored).not.toBe(partial)
        expect(restored.properties).toEqual(payload.properties)
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
    )

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

  describe('subgraph definitions', () => {
    /**
     * Deliver a full-document frame minted from `workflow` to a fresh follower
     * bound to `graph`, the way the first frame of a session (or a reseed
     * after `doc_reset`) arrives.
     */
    function seedDocument(graph: LGraph, workflow: Parameters<typeof mint>[0]) {
      const host = mint(workflow, CATALOG)
      const follower = new FollowerDoc()
      const adapter = new EcsFollowerAdapter(
        remoteMutations(graphScopeOf(graph))
      )
      adapter.bind('workflow', follower)
      const update = Y.encodeStateAsUpdate(host)
      follower.applyRemoteUpdate(update)
      expect(
        adapter.applyFrame({
          workflowId: 'workflow',
          seq: 1,
          update,
          actor: 'agent:test',
          opIds: []
        })
      ).toBe(true)
      return { host, follower, adapter }
    }

    let disableSubgraphNodeCreation: () => void
    let graph: LGraph
    let created: ReturnType<typeof vi.fn<(event: Event) => void>>

    beforeEach(() => {
      graph = new LGraph()
      // Unit-test analog of the `subgraph-created` handler in `app.ts` that
      // registers each new subgraph as a node type.
      disableSubgraphNodeCreation = enableSubgraphNodeCreation(graph)
      created = vi.fn<(event: Event) => void>()
      graph.events.addEventListener('subgraph-created', created)
    })

    afterEach(() => {
      disableSubgraphNodeCreation()
    })

    /**
     * Regression: an agent-seeded workflow carrying `definitions.subgraphs`
     * materialized its subgraph instance as a `has_errors` "missing node"
     * placeholder because the follower only read the root `nodes`/`links`
     * maps. The definition never reached `LGraph.createSubgraphs`, so
     * `subgraph-created` never fired and no `SubgraphNode` type was registered.
     */
    it('regression: materializes an agent-added subgraph instance as a SubgraphNode via the subgraph-created lifecycle', () => {
      const definition = createTestSubgraphData({
        nodes: [nodePayload(7)] as never
      })
      const { follower } = seedDocument(graph, {
        nodes: [nodePayload(1, definition.id)],
        links: [],
        definitions: { subgraphs: [definition] }
      })

      expect(
        reconcileAgentAdapters(graph, readSubgraphDefinitions(follower.doc))
      ).toEqual([toNodeId(1)])

      expect(graph.subgraphs.has(definition.id)).toBe(true)
      expect(created).toHaveBeenCalledOnce()
      const instance = graph.getNodeById(toNodeId(1))
      expect(instance).toBeInstanceOf(SubgraphNode)
      expect(instance?.has_errors).toBeFalsy()
      expect((instance as SubgraphNode).subgraph.nodes).toHaveLength(1)
      // Interior nodes belong to the subgraph, never to the root scope.
      expect(graph._nodes).toHaveLength(1)
      expect(reportError).not.toHaveBeenCalled()
    })

    it('registers a definition once across repeated reconciles', () => {
      const definition = createTestSubgraphData({
        nodes: [nodePayload(7)] as never
      })
      const { follower } = seedDocument(graph, {
        nodes: [nodePayload(1, definition.id)],
        links: [],
        definitions: { subgraphs: [definition] }
      })
      const definitions = readSubgraphDefinitions(follower.doc)

      reconcileAgentAdapters(graph, definitions)
      const subgraph = graph.subgraphs.get(definition.id)
      const instance = graph.getNodeById(toNodeId(1))

      // Every applied frame reconciles again with the same definitions.
      expect(reconcileAgentAdapters(graph, definitions)).toEqual([])

      expect(created).toHaveBeenCalledOnce()
      expect(graph.subgraphs.get(definition.id)).toBe(subgraph)
      expect(graph.getNodeById(toNodeId(1))).toBe(instance)
      expect(reportError).not.toHaveBeenCalled()
    })

    it('does not treat a definition payload as an edit to an existing subgraph', () => {
      const definition = createTestSubgraphData({
        nodes: [nodePayload(7)] as never
      })
      const { follower } = seedDocument(graph, {
        nodes: [nodePayload(1, definition.id)],
        links: [],
        definitions: { subgraphs: [definition] }
      })

      reconcileAgentAdapters(graph, readSubgraphDefinitions(follower.doc))
      const registered = graph.subgraphs.get(definition.id)

      reconcileAgentAdapters(graph, [
        {
          ...definition,
          name: 'replacement must not apply',
          nodes: [nodePayload(8)] as never
        }
      ])

      expect(graph.subgraphs.get(definition.id)).toBe(registered)
      expect(registered?.nodes.map((node) => node.id)).toEqual([toNodeId(7)])
      expect(created).toHaveBeenCalledOnce()
      expect(reportError).not.toHaveBeenCalled()
    })

    it('carries interior widget values into the instantiated subgraph', () => {
      const definition = createTestSubgraphData({
        nodes: [
          { ...nodePayload(7, 'widget-node'), widgets_values: [42] }
        ] as never
      })
      const { follower } = seedDocument(graph, {
        nodes: [nodePayload(1, definition.id)],
        links: [],
        definitions: { subgraphs: [definition] }
      })

      reconcileAgentAdapters(graph, readSubgraphDefinitions(follower.doc))

      const instance = graph.getNodeById(toNodeId(1)) as SubgraphNode
      const interior = instance.subgraph.getNodeById(toNodeId(7))
      expect(interior?.widgets?.[0]?.value).toBe(42)
    })

    it('matches widget values to definitions by id when one definition nests another', () => {
      // createSubgraphs hoists nested definitions into its return value, so
      // the created subgraphs outnumber the definitions handed in.
      const inner = createTestSubgraphData({
        nodes: [
          { ...nodePayload(30, 'widget-node'), widgets_values: [1] }
        ] as never
      })
      const outer = createTestSubgraphData({
        nodes: [
          { ...nodePayload(20, 'widget-node'), widgets_values: [2] },
          nodePayload(21, inner.id)
        ] as never,
        definitions: { subgraphs: [inner] }
      })
      const sibling = createTestSubgraphData({
        nodes: [
          { ...nodePayload(10, 'widget-node'), widgets_values: [3] }
        ] as never
      })
      const { follower } = seedDocument(graph, {
        nodes: [nodePayload(1, outer.id), nodePayload(2, sibling.id)],
        links: [],
        definitions: { subgraphs: [outer, sibling] }
      })

      reconcileAgentAdapters(graph, readSubgraphDefinitions(follower.doc))

      const widgetValue = (definitionId: string, nodeId: number) =>
        graph.subgraphs.get(definitionId)?.getNodeById(toNodeId(nodeId))
          ?.widgets?.[0]?.value
      expect(widgetValue(inner.id, 30)).toBe(1)
      expect(widgetValue(outer.id, 20)).toBe(2)
      expect(widgetValue(sibling.id, 10)).toBe(3)
      expect(reportError).not.toHaveBeenCalled()
    })

    it('keeps a registered definition when a later frame nests a copy of it', () => {
      const inner = createTestSubgraphData({
        nodes: [nodePayload(30, 'widget-node')] as never
      })
      const outer = createTestSubgraphData({
        nodes: [nodePayload(21, inner.id)] as never,
        definitions: { subgraphs: [inner] }
      })
      const first = seedDocument(graph, {
        nodes: [nodePayload(1, inner.id)],
        links: [],
        definitions: { subgraphs: [inner] }
      })
      reconcileAgentAdapters(graph, readSubgraphDefinitions(first.follower.doc))
      const registered = graph.subgraphs.get(inner.id)
      const instance = graph.getNodeById(toNodeId(1)) as SubgraphNode
      expect(instance.subgraph).toBe(registered)

      const second = seedDocument(graph, {
        nodes: [nodePayload(1, inner.id), nodePayload(2, outer.id)],
        links: [],
        definitions: { subgraphs: [inner, outer] }
      })
      reconcileAgentAdapters(
        graph,
        readSubgraphDefinitions(second.follower.doc)
      )

      expect(graph.subgraphs.get(inner.id)).toBe(registered)
      expect(graph.subgraphs.has(outer.id)).toBe(true)
      expect(created).toHaveBeenCalledTimes(2)
      expect(graph.getNodeById(toNodeId(2))).toBeInstanceOf(SubgraphNode)
      expect(reportError).not.toHaveBeenCalled()
    })

    it('registers the missing child of an already registered parent', () => {
      const inner = createTestSubgraphData({
        nodes: [nodePayload(30, 'widget-node')] as never
      })
      const outer = createTestSubgraphData({
        nodes: [nodePayload(21, 'widget-node')] as never
      })
      const first = seedDocument(graph, {
        nodes: [nodePayload(1, outer.id)],
        links: [],
        definitions: { subgraphs: [outer] }
      })
      reconcileAgentAdapters(graph, readSubgraphDefinitions(first.follower.doc))
      const registered = graph.subgraphs.get(outer.id)

      const second = seedDocument(graph, {
        nodes: [nodePayload(1, outer.id), nodePayload(2, inner.id)],
        links: [],
        definitions: {
          subgraphs: [{ ...outer, definitions: { subgraphs: [inner] } }]
        }
      })
      reconcileAgentAdapters(
        graph,
        readSubgraphDefinitions(second.follower.doc)
      )

      expect(graph.subgraphs.get(outer.id)).toBe(registered)
      expect(graph.subgraphs.has(inner.id)).toBe(true)
      expect(created).toHaveBeenCalledTimes(2)
      expect(graph.getNodeById(toNodeId(2))).toBeInstanceOf(SubgraphNode)
      expect(reportError).not.toHaveBeenCalled()
    })

    it('restores interior widget values inside configure(), before onConfigure runs', () => {
      const definition = createTestSubgraphData({
        nodes: [
          { ...nodePayload(7, 'configure-capture'), widgets_values: [42] }
        ] as never
      })
      const { follower } = seedDocument(graph, {
        nodes: [nodePayload(1, definition.id)],
        links: [],
        definitions: { subgraphs: [definition] }
      })
      expect(LiteGraph.namedValuesRestore).toBe(false)

      reconcileAgentAdapters(graph, readSubgraphDefinitions(follower.doc))

      // A custom node's onConfigure must see the seeded value, the same as it
      // does on the human load path, not the widget default.
      expect(configuredWidgetValues).toEqual([42])
      // The named-restore switch is scoped to registration, not left on.
      expect(LiteGraph.namedValuesRestore).toBe(false)
    })

    it('leaves the named-restore switch as it found it when registration throws', () => {
      configureShouldThrow = true
      const definition = createTestSubgraphData({
        nodes: [nodePayload(7, 'throws-on-configure')] as never
      })
      const { follower } = seedDocument(graph, {
        nodes: [nodePayload(1, definition.id)],
        links: [],
        definitions: { subgraphs: [definition] }
      })

      reconcileAgentAdapters(graph, readSubgraphDefinitions(follower.doc))

      expect(reportError).toHaveBeenCalledOnce()
      expect(LiteGraph.namedValuesRestore).toBe(false)
    })

    it('reports a definition that fails to register and still reconciles the other root nodes', () => {
      configureShouldThrow = true
      const definition = createTestSubgraphData({
        nodes: [nodePayload(7, 'throws-on-configure')] as never
      })
      const { follower } = seedDocument(graph, {
        nodes: [nodePayload(1, definition.id), nodePayload(2)],
        links: [],
        definitions: { subgraphs: [definition] }
      })

      const materialized = reconcileAgentAdapters(
        graph,
        readSubgraphDefinitions(follower.doc)
      )

      expect(reportError).toHaveBeenCalledExactlyOnceWith(
        expect.objectContaining({ message: 'interior node rejected' }),
        {
          errorType: 'agent_subgraph_definitions_failed',
          context: { graphId: graph.id, definitionId: definition.id }
        }
      )
      // createSubgraphs registers a definition before configuring it. A
      // failed one is rolled back so the map only holds definitions that
      // finished the lifecycle.
      expect(graph.subgraphs.has(definition.id)).toBe(false)
      // The plain node still materializes. The instance waits for its
      // definition instead of binding to the half-configured attempt.
      expect(materialized).toEqual([toNodeId(2)])
      expect(graph.getNodeById(toNodeId(2))).toBeInstanceOf(DummyNode)
      expect(graph.getNodeById(toNodeId(1))).toBeNull()
    })

    it('still reconciles root nodes when definition rollback lifecycle cleanup throws', () => {
      configureShouldThrow = true
      vi.spyOn(ThrowsOnConfigureNode.prototype, 'onRemoved').mockImplementation(
        () => {
          throw new Error('extension cleanup failed')
        }
      )
      const definition = createTestSubgraphData({
        nodes: [nodePayload(7, 'throws-on-configure')] as never
      })
      const { follower } = seedDocument(graph, {
        nodes: [nodePayload(1, definition.id), nodePayload(2)],
        links: [],
        definitions: { subgraphs: [definition] }
      })

      expect(() =>
        reconcileAgentAdapters(graph, readSubgraphDefinitions(follower.doc))
      ).not.toThrow()
      expect(graph.subgraphs.has(definition.id)).toBe(false)
      expect(graph.getNodeById(toNodeId(2))).toBeInstanceOf(DummyNode)
      expect(reportError).toHaveBeenCalledExactlyOnceWith(
        expect.any(AggregateError),
        {
          errorType: 'agent_subgraph_definitions_failed',
          context: { graphId: graph.id, definitionId: definition.id }
        }
      )
    })

    it('retries a failed definition on the next reconcile and reports it once', () => {
      configureShouldThrow = true
      const definition = createTestSubgraphData({
        nodes: [nodePayload(7, 'throws-on-configure')] as never
      })
      const { follower } = seedDocument(graph, {
        nodes: [nodePayload(1, definition.id)],
        links: [],
        definitions: { subgraphs: [definition] }
      })
      const definitions = readSubgraphDefinitions(follower.doc)

      expect(reconcileAgentAdapters(graph, definitions)).toEqual([])
      expect(reconcileAgentAdapters(graph, definitions)).toEqual([])
      // Same definition, same failure: one report, not one per frame.
      expect(reportError).toHaveBeenCalledOnce()

      configureShouldThrow = false
      expect(reconcileAgentAdapters(graph, definitions)).toEqual([toNodeId(1)])

      expect(graph.subgraphs.has(definition.id)).toBe(true)
      const instance = graph.getNodeById(toNodeId(1))
      expect(instance).toBeInstanceOf(SubgraphNode)
      expect(instance?.has_errors).toBeFalsy()
      expect((instance as SubgraphNode).subgraph).toBe(
        graph.subgraphs.get(definition.id)
      )
    })

    it('registers a valid sibling when another definition in the same frame fails', () => {
      configureShouldThrow = true
      const bad = createTestSubgraphData({
        nodes: [nodePayload(7, 'throws-on-configure')] as never
      })
      const good = createTestSubgraphData({
        nodes: [nodePayload(8)] as never
      })
      const { follower } = seedDocument(graph, {
        nodes: [nodePayload(1, bad.id), nodePayload(2, good.id)],
        links: [],
        definitions: { subgraphs: [bad, good] }
      })

      const materialized = reconcileAgentAdapters(
        graph,
        readSubgraphDefinitions(follower.doc)
      )

      expect(materialized).toEqual([toNodeId(2)])
      expect(graph.subgraphs.has(bad.id)).toBe(false)
      expect(graph.subgraphs.has(good.id)).toBe(true)
      expect(graph.getNodeById(toNodeId(2))).toBeInstanceOf(SubgraphNode)
      expect(reportError).toHaveBeenCalledExactlyOnceWith(expect.anything(), {
        errorType: 'agent_subgraph_definitions_failed',
        context: { graphId: graph.id, definitionId: bad.id }
      })
    })

    it('keeps a live nested definition and registers a missing one under an existing outer', () => {
      const inner = createTestSubgraphData({
        nodes: [nodePayload(30)] as never
      })
      const outer = createTestSubgraphData({
        nodes: [nodePayload(21, inner.id)] as never,
        definitions: { subgraphs: [inner] }
      })
      const { follower } = seedDocument(graph, {
        nodes: [nodePayload(1, outer.id)],
        links: [],
        definitions: { subgraphs: [outer] }
      })
      const definitions = readSubgraphDefinitions(follower.doc)

      // The user (or an earlier frame) already has the inner definition live.
      const liveInner = graph.createSubgraph(inner)
      reconcileAgentAdapters(graph, definitions)
      expect(graph.subgraphs.get(inner.id)).toBe(liveInner)
      expect(graph.subgraphs.has(outer.id)).toBe(true)

      // And the mirror: the outer is live but its nested definition is not.
      const graph2 = new LGraph()
      const disable2 = enableSubgraphNodeCreation(graph2)
      try {
        graph2.createSubgraph({ ...outer, definitions: undefined })
        expect(graph2.subgraphs.has(inner.id)).toBe(false)
        reconcileAgentAdapters(graph2, definitions)
        expect(graph2.subgraphs.has(inner.id)).toBe(true)
      } finally {
        disable2()
      }
      expect(reportError).not.toHaveBeenCalled()
    })

    it('reports and skips a definition whose id is not a UUID instead of remapping it', () => {
      const definition = {
        ...createTestSubgraphData({ nodes: [nodePayload(7)] as never }),
        id: 'legacy-subgraph'
      }
      const { follower } = seedDocument(graph, {
        nodes: [nodePayload(1, definition.id)],
        links: [],
        definitions: { subgraphs: [definition] }
      })

      reconcileAgentAdapters(graph, readSubgraphDefinitions(follower.doc))

      // createSubgraphs would silently mint a UUID for it, leaving the root
      // node's `type` pointing at an id the doc never registered.
      expect(graph.subgraphs.size).toBe(0)
      expect(created).not.toHaveBeenCalled()
      expect(reportError).toHaveBeenCalledExactlyOnceWith(expect.anything(), {
        errorType: 'agent_subgraph_definitions_failed',
        context: { graphId: graph.id, definitionId: 'legacy-subgraph' }
      })
    })
  })
})
