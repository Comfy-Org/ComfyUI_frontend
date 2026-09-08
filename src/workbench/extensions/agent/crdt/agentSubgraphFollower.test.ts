import { applyOps, mint } from '@comfyorg/comfy-multi-player'
import type { WidgetCatalog, WorkflowJSON } from '@comfyorg/comfy-multi-player'
import { createTestingPinia } from '@pinia/testing'
import { setActivePinia } from 'pinia'
import { beforeEach, describe, expect, it } from 'vitest'
import * as Y from 'yjs'

import { createGraphMutations } from '@/core/graph/graphMutations'
import {
  LGraph,
  LGraphNode,
  LiteGraph,
  SubgraphNode
} from '@/lib/litegraph/src/litegraph'
import {
  createTestSubgraph,
  createTestSubgraphNode,
  enableSubgraphNodeCreation
} from '@/lib/litegraph/src/subgraph/__fixtures__/subgraphHelpers'
import { useWidgetValueStore } from '@/stores/widgetValueStore'
import { graphScopeOf } from '@/types/graphScopeId'
import { toLinkId } from '@/types/linkId'
import { toNodeId } from '@/types/nodeId'

import { reconcileAgentAdapters } from './agentNodeMaterializer'
import { readSubgraphDefinitions } from './agentSubgraphDefinitions'
import { EcsFollowerAdapter } from './ecsFollowerAdapter'
import { FollowerDoc } from './followerDoc'

class PromotedWidgetNode extends LGraphNode {
  constructor() {
    super('promoted-widget')
    const input = this.addInput('value', 'NUMBER')
    input.widget = { name: 'value' }
    this.addWidget('number', 'value', 1, () => {})
  }
}

class SourceNode extends LGraphNode {
  constructor() {
    super('source')
    this.addOutput('value', 'NUMBER')
  }
}

const HOST_INITIAL_VALUE = 3

const CATALOG: WidgetCatalog = {
  types: {
    'promoted-widget': { widget_order: ['value'] },
    source: { widget_order: [] }
  }
}

function operation(id: string, version: number, payload: object) {
  return {
    op_id: id,
    actor: 'agent:test',
    base_version: version,
    stamp: [version, 'agent:test', id],
    ...payload
  }
}

interface FixtureOptions {
  /** Declare a second input `extra` ahead of `value` in the definition. */
  extraInput?: boolean
  /** Strip the host instance's serialized inputs (cmp claimPromotedInput premise). */
  stripHostInputs?: boolean
}

function promotedWorkflow(options: FixtureOptions = {}): WorkflowJSON {
  const graph = new LGraph()
  const subgraph = createTestSubgraph({
    rootGraph: graph,
    inputs: options.extraInput
      ? [
          { name: 'extra', type: 'NUMBER' },
          { name: 'value', type: 'NUMBER' }
        ]
      : [{ name: 'value', type: 'NUMBER' }]
  })
  // createTestSubgraph never registers on the root; serialize() only emits
  // definitions for subgraphs present in graph.subgraphs (LGraph.ts ~2761).
  graph.subgraphs.set(subgraph.id, subgraph)
  // `new PromotedWidgetNode()` leaves `type` unset; only `createNode` stamps
  // it, and cmp's mint drops nodes whose serialized `type` is empty.
  const interior = LiteGraph.createNode('promoted-widget')!
  interior.id = toNodeId(7)
  subgraph.add(interior)
  const valueSlot = subgraph.inputNode.slots[options.extraInput ? 1 : 0]
  valueSlot.connect(interior.inputs[0], interior)

  const host = createTestSubgraphNode(subgraph, { id: 1 })
  graph.add(host)
  // Host value differs from the interior default (1) so an initial load that
  // silently falls back to the definition's default is caught.
  host.widgets[0].value = HOST_INITIAL_VALUE

  const source = LiteGraph.createNode('source')!
  source.id = toNodeId(2)
  graph.add(source)
  const serialized = graph.serialize()
  if (options.stripHostInputs) {
    const hostNode = serialized.nodes.find((n) => n.id === 1)
    if (hostNode) hostNode.inputs = []
  }
  // Same cast the production path takes: serialized litegraph JSON is the
  // workflow shape cmp mints from.
  return serialized as unknown as WorkflowJSON
}

function startFollower(options: FixtureOptions = {}) {
  const graph = new LGraph()
  const disableSubgraphNodeCreation = enableSubgraphNodeCreation(graph)
  const hostDoc = mint(promotedWorkflow(options), CATALOG)
  const follower = new FollowerDoc()
  const adapter = new EcsFollowerAdapter(
    createGraphMutations({
      getScope: () => graphScopeOf(graph),
      layout: { createNode: () => {}, deleteNodes: () => {} }
    })
  )
  adapter.bind('workflow', follower)
  const update = Y.encodeStateAsUpdate(hostDoc)
  follower.applyRemoteUpdate(update)
  expect(adapter.applyFrame({ workflowId: 'workflow', seq: 1, update })).toBe(
    true
  )
  reconcileAgentAdapters(graph, readSubgraphDefinitions(follower.doc))
  const instance = graph.getNodeById(toNodeId(1)) as SubgraphNode
  expect(instance).toBeInstanceOf(SubgraphNode)
  expect(instance.widgets[0]?.value).toBe(HOST_INITIAL_VALUE)
  expect(instance.inputs.map((i) => i.name)).toEqual(
    options.extraInput ? ['extra', 'value'] : ['value']
  )
  return {
    graph,
    hostDoc,
    follower,
    adapter,
    instance,
    disableSubgraphNodeCreation
  }
}

function deliver(
  state: ReturnType<typeof startFollower>,
  payload: object,
  seq: number
) {
  const vector = Y.encodeStateVector(state.hostDoc)
  const id = `op-${seq}`
  const result = applyOps(
    state.hostDoc,
    [operation(id, seq, payload)] as Parameters<typeof applyOps>[1],
    CATALOG
  )
  expect(result.outcomes).toEqual([{ op_id: id, outcome: 'applied' }])
  const update = Y.encodeStateAsUpdate(state.hostDoc, vector)
  state.follower.applyRemoteUpdate(update)
  expect(
    state.adapter.applyFrame({
      workflowId: 'workflow',
      seq: seq + 1,
      update,
      actor: 'agent:test',
      opIds: [id]
    })
  ).toBe(true)
  reconcileAgentAdapters(
    state.graph,
    readSubgraphDefinitions(state.follower.doc)
  )
}

beforeEach(() => {
  setActivePinia(createTestingPinia({ stubActions: false }))
  LiteGraph.registerNodeType('promoted-widget', PromotedWidgetNode)
  LiteGraph.registerNodeType('source', SourceNode)
})

describe('agent CRDT follower on a SubgraphNode with promoted widgets', () => {
  it('S1 reflects a promoted host widgets_values write on the surface widget', () => {
    const state = startFollower()
    deliver(
      state,
      {
        op: 'set_widget',
        node_id: 1,
        widget: 'value',
        value: 42,
        promoted: {
          instance_path: [1],
          value_index: 0,
          host_widgets_values: [HOST_INITIAL_VALUE]
        }
      },
      1
    )

    // The host owns the promoted value (ADR-SUBGRAPH-PROMOTION-0009):
    // execution reads it from the widget value store, not from the interior
    // node's widget, so the interior default is intentionally untouched.
    const widgetId = state.instance.inputs[0]?.widgetId
    expect(widgetId).toBeDefined()
    expect(state.instance.widgets[0]?.value).toBe(42)
    expect(useWidgetValueStore().getWidget(widgetId!)?.value).toBe(42)
  })

  it('S2 materializes and connects a declared promoted host input', () => {
    const state = startFollower()
    deliver(
      state,
      {
        op: 'connect',
        link_id: 9,
        from_node: 2,
        from_slot: 0,
        to_node: 1,
        link_type: 'NUMBER',
        grow: {
          side: 'input',
          slot: 'value',
          name: 'value',
          type: 'NUMBER',
          promoted: true
        }
      },
      1
    )

    expect(state.graph.links.has(toLinkId(9))).toBe(true)
    expect(state.instance.inputs[0]?.link).toBe(9)
    expect(state.graph.getNodeById(toNodeId(2))?.outputs[0]?.links).toContain(9)
  })

  it('S2b wires the promoted input by declared name when the doc host carries no slots', () => {
    const state = startFollower({ extraInput: true, stripHostInputs: true })
    deliver(
      state,
      {
        op: 'connect',
        link_id: 9,
        from_node: 2,
        from_slot: 0,
        to_node: 1,
        link_type: 'NUMBER',
        grow: {
          side: 'input',
          slot: 'value',
          name: 'value',
          type: 'NUMBER',
          promoted: true
        }
      },
      1
    )

    const valueInput = state.instance.inputs.find((i) => i.name === 'value')
    const extraInput = state.instance.inputs.find((i) => i.name === 'extra')
    expect(state.graph.links.has(toLinkId(9))).toBe(true)
    expect({
      target_slot: state.graph.links.get(toLinkId(9))?.target_slot,
      valueLink: valueInput?.link ?? null,
      extraLink: extraInput?.link ?? null
    }).toEqual({
      target_slot: state.instance.inputs.indexOf(valueInput!),
      valueLink: 9,
      extraLink: null
    })
  })
})
