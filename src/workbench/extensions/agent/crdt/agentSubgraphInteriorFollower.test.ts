import { applyOps, mint } from '@comfyorg/comfy-multi-player'
import type {
  Op,
  WidgetCatalog,
  WorkflowJSON
} from '@comfyorg/comfy-multi-player'
import {
  assert,
  beforeEach,
  describe,
  expect,
  it,
  onTestFinished,
  vi
} from 'vitest'
import * as Y from 'yjs'

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
import { toNodeId } from '@/types/nodeId'

import { AgentCrdtProjection } from './agentCrdtProjection'
import { FollowerDoc } from './followerDoc'
import type { GraphOperation } from './graphOperations'

vi.mock(import('@/platform/telemetry/reportError'))

class InteriorNode extends LGraphNode {
  constructor() {
    super('interior-node')
    const value = this.addInput('value', 'NUMBER')
    value.widget = { name: 'value' }
    const detail = this.addInput('detail', 'NUMBER')
    detail.widget = { name: 'detail' }
    this.addWidget('number', 'value', 1, () => {})
    this.addWidget('number', 'detail', 10, () => {})
    this.serialize_widgets = true
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
    'interior-node': { widget_order: ['value', 'detail'] },
    source: { widget_order: [] }
  }
}

function operation(id: string, version: number, payload: GraphOperation): Op {
  return {
    op_id: id,
    actor: 'agent:test',
    base_version: version,
    stamp: [version, 'agent:test'],
    ...payload
  }
}

interface WorkflowOptions {
  rootIdCollidesWithInterior?: boolean
  secondHost?: boolean
}

function workflow(options: WorkflowOptions = {}): WorkflowJSON {
  const graph = new LGraph()
  const subgraph = createTestSubgraph({
    rootGraph: graph,
    inputs: [{ name: 'value', type: 'NUMBER' }]
  })
  graph.subgraphs.set(subgraph.id, subgraph)
  const interior = LiteGraph.createNode('interior-node')!
  interior.id = toNodeId(7)
  subgraph.add(interior)
  subgraph.inputNode.slots[0].connect(interior.inputs[0], interior)

  const host = createTestSubgraphNode(subgraph, { id: 1 })
  graph.add(host)
  host.widgets[0].value = HOST_INITIAL_VALUE
  if (options.secondHost) {
    const second = createTestSubgraphNode(subgraph, { id: 4 })
    graph.add(second)
    second.widgets[0].value = 5
  }

  const source = LiteGraph.createNode('source')!
  source.id = toNodeId(2)
  graph.add(source)
  const serialized = graph.serialize()
  if (options.rootIdCollidesWithInterior) {
    const sourceNode = serialized.nodes.find((n) => n.id === 2)
    if (sourceNode) sourceNode.id = 7
  }
  return serialized as unknown as WorkflowJSON
}

function startFollower(options: WorkflowOptions = {}) {
  const graph = new LGraph()
  const disable = enableSubgraphNodeCreation(graph)
  const hostDoc = mint(workflow(options), CATALOG)
  const follower = new FollowerDoc()
  const adapter = new AgentCrdtProjection(() => graph)
  adapter.bind('workflow', follower)
  const update = Y.encodeStateAsUpdate(hostDoc)
  follower.applyRemoteUpdate(update)
  expect(
    adapter.applyFrame({ workflowId: 'workflow', seq: 1, update })
  ).toMatchObject({ applied: true })
  const instance = graph.getNodeById(toNodeId(1)) as SubgraphNode
  expect(instance).toBeInstanceOf(SubgraphNode)
  onTestFinished(disable)
  return { graph, hostDoc, follower, adapter, instance }
}

function deliver(
  state: ReturnType<typeof startFollower>,
  payload: GraphOperation,
  seq: number
) {
  const vector = Y.encodeStateVector(state.hostDoc)
  const id = `op-${seq}`
  const result = applyOps(state.hostDoc, [operation(id, seq, payload)], CATALOG)
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
  ).toMatchObject({ applied: true })
}

function forwardDefinitionEdit(
  state: ReturnType<typeof startFollower>,
  widget: string,
  value: unknown,
  seq: number
) {
  const vector = Y.encodeStateVector(state.hostDoc)
  state.hostDoc.transact(() => {
    const definitions = state.hostDoc.getMap<Y.Map<unknown>>('definitions')
    definitions.forEach((definition) => {
      const nodes = definition.get('nodes')
      if (!(nodes instanceof Y.Map)) return
      const interior = nodes.get('7')
      if (!(interior instanceof Y.Map)) return
      const widgets = interior.get('widgets')
      if (widgets instanceof Y.Map) widgets.set(widget, value)
    })
  })
  const update = Y.encodeStateAsUpdate(state.hostDoc, vector)
  state.follower.applyRemoteUpdate(update)
  expect(
    state.adapter.applyFrame({ workflowId: 'workflow', seq: seq + 1, update })
  ).toMatchObject({ applied: true })
}

function interiorOf(state: ReturnType<typeof startFollower>) {
  const node = state.instance.subgraph.nodes[0]
  assert.exists(node)
  return node
}

function interiorWidgets(state: ReturnType<typeof startFollower>) {
  return Object.fromEntries(
    (interiorOf(state).widgets ?? []).map((w) => [w.name, w.value])
  )
}

function surfaceWidgets(state: ReturnType<typeof startFollower>) {
  return Object.fromEntries(
    state.instance.widgets.map((w) => [w.name, w.value])
  )
}

function storedSurfaceWidgets(state: ReturnType<typeof startFollower>) {
  return Object.fromEntries(
    useWidgetValueStore()
      .getNodeWidgets(graphScopeOf(state.graph).rootGraphId, toNodeId(1))
      .map((w) => [w.name, w.value])
  )
}

beforeEach(() => {
  LiteGraph.registerNodeType('interior-node', InteriorNode)
  LiteGraph.registerNodeType('source', SourceNode)
})

describe('FE-3468 agent CRDT follower on subgraph definition interiors', () => {
  it('promoted widget edited in the bottom layer updates bottom and surface', () => {
    const state = startFollower()
    deliver(
      state,
      {
        op: 'set_widget',
        node_id: 7,
        widget: 'value',
        value: 42,
        path: ['1', '7'],
        inner_widget: 'value'
      },
      1
    )

    expect(interiorWidgets(state)).toEqual({ value: 42, detail: 10 })
    expect(surfaceWidgets(state)).toEqual({ value: 42 })
    expect(storedSurfaceWidgets(state)).toEqual({ value: 42 })
  })

  it('non-promoted widget edited in the bottom layer updates bottom and leaves surface unchanged', () => {
    const state = startFollower()
    deliver(
      state,
      {
        op: 'set_widget',
        node_id: 7,
        widget: 'detail',
        value: 99,
        path: ['1', '7'],
        inner_widget: 'detail'
      },
      1
    )

    expect(interiorWidgets(state)).toEqual({ value: 1, detail: 99 })
    expect(surfaceWidgets(state)).toEqual({ value: HOST_INITIAL_VALUE })
    expect(storedSurfaceWidgets(state)).toEqual({
      value: HOST_INITIAL_VALUE
    })
  })

  it('promoted widget edited in the surface layer updates only the surface', () => {
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

    expect(surfaceWidgets(state)).toEqual({ value: 42 })
    expect(storedSurfaceWidgets(state)).toEqual({ value: 42 })
    expect(interiorWidgets(state)).toEqual({ value: 1, detail: 10 })
  })

  it('posted canvas carries committed interior values after a bottom-layer edit', () => {
    const state = startFollower()
    deliver(
      state,
      {
        op: 'set_widget',
        node_id: 7,
        widget: 'detail',
        value: 99,
        path: ['1', '7'],
        inner_widget: 'detail'
      },
      1
    )
    deliver(
      state,
      {
        op: 'set_widget',
        node_id: 7,
        widget: 'value',
        value: 42,
        path: ['1', '7'],
        inner_widget: 'value'
      },
      2
    )

    const serialized = state.graph.serialize()
    const definition = serialized.definitions?.subgraphs?.[0]
    expect(definition?.nodes?.[0]?.widgets_values).toEqual([42, 99])
    const host = serialized.nodes.find((n) => n.id === 1)
    expect(host?.widgets_values).toEqual([42])
  })

  it('applies an interior edit when the live interior id was remapped', () => {
    const state = startFollower({ rootIdCollidesWithInterior: true })
    expect(interiorOf(state).id).not.toBe(toNodeId(7))
    deliver(
      state,
      {
        op: 'set_widget',
        node_id: 7,
        widget: 'detail',
        value: 77,
        path: ['1', '7'],
        inner_widget: 'detail'
      },
      1
    )

    expect(interiorWidgets(state)).toEqual({ value: 1, detail: 77 })
  })

  it('applies an interior edit when a fresh applier meets a pre-existing definition', () => {
    const state = startFollower({ rootIdCollidesWithInterior: true })
    const fresh = new AgentCrdtProjection(() => state.graph)
    fresh.bind('workflow', state.follower)
    const vector = Y.encodeStateVector(state.hostDoc)
    const result = applyOps(
      state.hostDoc,
      [
        operation('op-fresh', 9, {
          op: 'set_widget',
          node_id: 7,
          widget: 'detail',
          value: 88,
          path: ['1', '7'],
          inner_widget: 'detail'
        })
      ],
      CATALOG
    )
    expect(result.outcomes).toEqual([{ op_id: 'op-fresh', outcome: 'applied' }])
    const update = Y.encodeStateAsUpdate(state.hostDoc, vector)
    state.follower.applyRemoteUpdate(update)
    expect(
      fresh.applyFrame({ workflowId: 'workflow', seq: 9, update })
    ).toMatchObject({ applied: true })

    expect(interiorWidgets(state)).toEqual({ value: 1, detail: 88 })
  })

  it('updates every host of a shared definition on an interior edit', () => {
    const state = startFollower({ secondHost: true })
    forwardDefinitionEdit(state, 'value', 42, 1)

    const second = state.graph.getNodeById(toNodeId(4)) as SubgraphNode
    expect(interiorWidgets(state)).toEqual({ value: 42, detail: 10 })
    expect(surfaceWidgets(state)).toEqual({ value: 42 })
    expect(second.widgets.map((w) => [w.name, w.value])).toEqual([
      ['value', 42]
    ])
  })
})
