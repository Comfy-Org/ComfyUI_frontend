import { applyOps, mint } from '@comfyorg/comfy-multi-player'
import type {
  Op,
  WidgetCatalog,
  WorkflowJSON
} from '@comfyorg/comfy-multi-player'
import { fromPartial } from '@total-typescript/shoehorn'
import {
  assert,
  beforeEach,
  describe,
  expect,
  it,
  onTestFinished,
  vi
} from 'vitest'
import { ref } from 'vue'
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
import type { ComfyApi } from '@/scripts/api'
import type { ComfyApp } from '@/scripts/app'
import { useLitegraphService } from '@/services/litegraphService'
import { toNodeId } from '@/types/nodeId'

import { AgentCrdtProjection } from './agentCrdtProjection'
import { FollowerDoc } from './followerDoc'
import type { GraphOperation } from './graphOperations'

vi.mock(import('@vueuse/router'), () => ({ useRouteHash: () => ref('') }))
vi.mock(import('@/scripts/app'), () => ({
  app: fromPartial<ComfyApp>({
    nodeOutputs: {},
    nodePreviewImages: {},
    isGraphReady: true,
    canvas: { ds: { scale: 1, offset: [0, 0] } },
    ui: { autoQueueEnabled: false, autoQueueMode: 'instant' }
  })
}))
vi.mock(import('@/scripts/api'), () => ({
  api: fromPartial<ComfyApi>({
    dispatchCustomEvent: vi.fn(),
    addEventListener: vi.fn(),
    removeEventListener: vi.fn()
  })
}))
vi.mock(import('@/platform/telemetry/reportError'))

class DynamicGroupTest extends LGraphNode {
  constructor() {
    super('DynamicGroupTest')
    this.comfyClass = 'DynamicGroupTest'
    this.serialize_widgets = true
    this.addWidget('text', 'before', 'head', () => {})
    useLitegraphService().addNodeInput(this, {
      name: 'rows',
      type: 'COMFY_DYNAMICGROUP_V3',
      isOptional: false,
      min: 0,
      max: 3,
      template: { required: { strength: ['FLOAT', { default: 1 }] } }
    })
    this.addWidget('text', 'after', 'tail', () => {})
  }
}

const CATALOG: WidgetCatalog = {
  types: {
    DynamicGroupTest: {
      widget_order: [
        'before',
        'rows',
        'rows.0.strength',
        'rows.1.strength',
        'rows.2.strength',
        'after'
      ]
    }
  }
}

const INTERIOR_ID = 7

function interiorWrite(seq: number, widget: string, value: unknown): Op {
  return {
    op_id: `op-${seq}`,
    actor: 'agent:test',
    base_version: seq,
    stamp: [seq, 'agent:test'],
    op: 'set_widget',
    node_id: 1,
    widget,
    path: ['1', String(INTERIOR_ID)],
    inner_widget: widget,
    value
  } satisfies GraphOperation & Op
}

function dynamicGroupDefinitionWorkflow(
  instances: number,
  promoteFirstRow = false
): WorkflowJSON {
  const graph = new LGraph()
  const subgraph = createTestSubgraph({
    rootGraph: graph,
    inputs: promoteFirstRow ? [{ name: 'strength', type: 'FLOAT' }] : []
  })
  graph.subgraphs.set(subgraph.id, subgraph)
  const interior = LiteGraph.createNode('DynamicGroupTest')
  assert.exists(interior)
  interior.id = toNodeId(INTERIOR_ID)
  subgraph.add(interior)
  const count = interior.widgets?.find((widget) => widget.name === 'rows')
  assert.exists(count)
  count.value = 1
  const strength = interior.widgets?.find(
    (widget) => widget.name === 'rows.0.strength'
  )
  assert.exists(strength)
  strength.value = 0.5
  if (promoteFirstRow) {
    const input = interior.inputs.find(
      (slot) => slot.name === 'rows.0.strength'
    )
    assert.exists(input)
    subgraph.inputNode.slots[0].connect(input, interior)
  }
  for (let id = 1; id <= instances; id++)
    graph.add(createTestSubgraphNode(subgraph, { id, pos: [id * 400, 0] }))
  return graph.serialize() as unknown as WorkflowJSON
}

function startFollower(instances: number, promoteFirstRow = false) {
  const graph = new LGraph()
  onTestFinished(enableSubgraphNodeCreation(graph))
  const hostDoc = mint(
    dynamicGroupDefinitionWorkflow(instances, promoteFirstRow),
    CATALOG
  )
  const follower = new FollowerDoc()
  const adapter = new AgentCrdtProjection(() => graph)
  adapter.bind('workflow', follower)
  const update = Y.encodeStateAsUpdate(hostDoc)
  follower.applyRemoteUpdate(update)
  expect(
    adapter.applyFrame({ workflowId: 'workflow', seq: 1, update })
  ).toMatchObject({ applied: true })
  return { graph, hostDoc, follower, adapter }
}

function deliver(state: ReturnType<typeof startFollower>, ops: Op[]) {
  const vector = Y.encodeStateVector(state.hostDoc)
  const result = applyOps(state.hostDoc, ops, CATALOG)
  expect(result.outcomes.map(({ outcome }) => outcome)).toEqual(
    ops.map(() => 'applied')
  )
  const update = Y.encodeStateAsUpdate(state.hostDoc, vector)
  state.follower.applyRemoteUpdate(update)
  expect(
    state.adapter.applyFrame({
      workflowId: 'workflow',
      seq: 2,
      update,
      actor: 'agent:test',
      opIds: ops.map(({ op_id }) => op_id)
    })
  ).toMatchObject({ applied: true })
}

function interiorValues(graph: LGraph, instanceId: number) {
  const instance = graph.getNodeById(toNodeId(instanceId))
  assert.instanceOf(instance, SubgraphNode)
  const interior = instance.subgraph.getNodeById(toNodeId(INTERIOR_ID))
  assert.exists(interior)
  return interior.serialize().widgets_values
}

beforeEach(() => {
  LiteGraph.registerNodeType('DynamicGroupTest', DynamicGroupTest)
})

describe('agent CRDT follower on a DynamicGroup inside a subgraph', () => {
  it('restores interior DynamicGroup rows from the catch-up frame on every instance', () => {
    const { graph } = startFollower(2)

    expect(interiorValues(graph, 1)).toEqual(['head', 1, 0.5, 'tail'])
    expect(interiorValues(graph, 2)).toEqual(['head', 1, 0.5, 'tail'])
  })

  it('shows an agent write to a promoted DynamicGroup row field on the host', () => {
    const state = startFollower(1, true)
    const host = state.graph.getNodeById(toNodeId(1))
    assert.instanceOf(host, SubgraphNode)
    expect(host.widgets.map((widget) => widget.value)).toEqual([0.5])

    deliver(state, [
      {
        op_id: 'op-2',
        actor: 'agent:test',
        base_version: 2,
        stamp: [2, 'agent:test'],
        op: 'set_widget',
        node_id: 1,
        widget: 'strength',
        value: 0.9,
        promoted: {
          instance_path: [1],
          value_index: 0,
          host_widgets_values: [0.5]
        }
      }
    ])

    expect(host.widgets.map((widget) => widget.value)).toEqual([0.9])
  })

  it('refuses an interior DynamicGroup resize on a definition shared by several instances', () => {
    const state = startFollower(2)
    const before = Y.encodeStateAsUpdate(state.hostDoc)

    const result = applyOps(
      state.hostDoc,
      [interiorWrite(2, 'rows', 2)],
      CATALOG
    )

    expect(result.outcomes).toEqual([
      expect.objectContaining({
        outcome: 'rejected',
        reason: expect.objectContaining({ code: 'shared_definition_unforked' })
      })
    ])
    expect(Y.encodeStateAsUpdate(state.hostDoc)).toEqual(before)
  })
})
