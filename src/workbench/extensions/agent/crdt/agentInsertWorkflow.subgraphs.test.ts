/**
 * Extended subgraph coverage for `insert_workflow`, complementing
 * `agentSubgraphInsertWorkflow.regression.test.ts` (one promoted-widget
 * blueprint paste). This file drives the same real-graph-blueprint pattern
 * (build with litegraph, `serialize()`, feed to `insert_workflow`) across
 * scenarios that file does not cover: multiple subgraph definitions in one
 * op, a promoted widget surviving a later `set_widget`, multiple widget
 * types promoted together, subgraph-instance id collisions, several
 * instances of one definition in a single op, and coexistence with a
 * pre-existing instance.
 */
import { applyOps, mint } from '@comfyorg/comfy-multi-player'
import type {
  InsertWorkflowOp,
  Op,
  WidgetCatalog
} from '@comfyorg/comfy-multi-player'
import { beforeEach, describe, expect, it, onTestFinished } from 'vitest'
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
import type { WidgetValue } from '@/types/simplifiedWidget'

import { AgentCrdtProjection } from './agentCrdtProjection'
import { inertPlacementPort } from './__fixtures__/inertPlacementPort'
import { FollowerDoc } from './followerDoc'
import { createGraphMutations } from './graphMutations'

class NumberWidgetNode extends LGraphNode {
  constructor() {
    super('number-widget')
    const input = this.addInput('value', 'NUMBER')
    input.widget = { name: 'value' }
    this.addWidget('number', 'value', 1, () => {})
  }
}

class ComboWidgetNode extends LGraphNode {
  constructor() {
    super('combo-widget')
    const input = this.addInput('mode', 'STRING')
    input.widget = { name: 'mode' }
    this.addWidget('combo', 'mode', 'fixed', () => {}, {
      values: ['fixed', 'randomize']
    })
  }
}

class ToggleWidgetNode extends LGraphNode {
  constructor() {
    super('toggle-widget')
    const input = this.addInput('enabled', 'BOOLEAN')
    input.widget = { name: 'enabled' }
    this.addWidget('toggle', 'enabled', false, () => {})
  }
}

/** Two promoted widgets on a single interior node, different types. */
class DualWidgetNode extends LGraphNode {
  constructor() {
    super('dual-widget')
    const modeInput = this.addInput('mode', 'STRING')
    modeInput.widget = { name: 'mode' }
    this.addWidget('combo', 'mode', 'fixed', () => {}, {
      values: ['fixed', 'randomize']
    })
    const stepsInput = this.addInput('steps', 'NUMBER')
    stepsInput.widget = { name: 'steps' }
    this.addWidget('number', 'steps', 20, () => {})
  }
}

const CATALOG: WidgetCatalog = {
  types: {
    'number-widget': { widget_order: ['value'] },
    'combo-widget': { widget_order: ['mode'] },
    'toggle-widget': { widget_order: ['enabled'] },
    'dual-widget': { widget_order: ['mode', 'steps'] }
  }
}

beforeEach(() => {
  LiteGraph.registerNodeType('number-widget', NumberWidgetNode)
  LiteGraph.registerNodeType('combo-widget', ComboWidgetNode)
  LiteGraph.registerNodeType('toggle-widget', ToggleWidgetNode)
  LiteGraph.registerNodeType('dual-widget', DualWidgetNode)
})

let opSeq = 0
function insertOp(
  workflow: InsertWorkflowOp['workflow'],
  opId?: string
): InsertWorkflowOp {
  opSeq += 1
  return {
    op_id: (opId ?? `insert-subgraph-op-${opSeq}`).padEnd(32, '0'),
    actor: 'agent:test',
    base_version: 1,
    stamp: [1, 'agent:test'],
    op: 'insert_workflow',
    workflow
  }
}

function setWidgetOp(
  opId: string,
  seq: number,
  nodeId: string | number,
  widget: string,
  value: unknown,
  valueIndex: number
): Op {
  return {
    op_id: opId.padEnd(32, '0'),
    actor: 'agent:test',
    base_version: seq,
    stamp: [seq, 'agent:test'],
    op: 'set_widget',
    node_id: nodeId,
    widget,
    value,
    promoted: { value_index: valueIndex, host_widgets_values: [value] }
  } as unknown as Op
}

function bindProjection(workflowId: string, graph: LGraph) {
  const follower = new FollowerDoc()
  const projection = new AgentCrdtProjection(
    createGraphMutations({
      getScope: () => graphScopeOf(graph),
      layout: { createNode: () => {}, deleteNodes: () => {} },
      placement: inertPlacementPort
    }),
    () => graph,
    () => follower.doc
  )
  projection.bind(workflowId, follower)
  onTestFinished(() => {
    projection.destroy()
    follower.destroy()
  })

  let seq = 0
  const deliver = (update: Uint8Array, opIds: string[]): boolean => {
    follower.applyRemoteUpdate(update)
    const committed = projection.applyFrame({
      workflowId,
      seq: ++seq,
      update,
      actor: 'agent:test',
      opIds
    })
    projection.reconcileLiveGraph(workflowId)
    return committed
  }
  return deliver
}

function findSubgraphInstances(graph: LGraph): SubgraphNode[] {
  return graph._nodes.filter(
    (node): node is SubgraphNode => node instanceof SubgraphNode
  )
}

function serializeBlueprint(graph: LGraph): InsertWorkflowOp['workflow'] {
  return JSON.parse(
    JSON.stringify(graph.serialize())
  ) as InsertWorkflowOp['workflow']
}

/**
 * A subgraph host's `widgets_values` is a named record when it promotes
 * named widgets, even though `LGraphNode`'s general type only declares the
 * positional-array shape `ISerialisedNode` uses. Read it through this one
 * narrow accessor rather than asserting at every call site.
 */
function promotedWidgetValues(node: SubgraphNode): Record<string, unknown> {
  return node.widgets_values as unknown as Record<string, unknown>
}

describe('insert_workflow materializes subgraphs correctly', () => {
  it('materializes two distinct subgraph definitions carried by the same insert_workflow op', () => {
    const graph = new LGraph()
    onTestFinished(enableSubgraphNodeCreation(graph))

    // Two SEPARATE, independently-instantiated definitions, built from one
    // blueprint that declares them together (as a paste of two grouped
    // selections would). This exercises insert_workflow's handling of a
    // `workflow.definitions.subgraphs` list with more than one entry in a
    // single op, each resolved to its own registration and materialized
    // correctly.
    const blueprintGraph = new LGraph()
    const subgraphA = createTestSubgraph({
      rootGraph: blueprintGraph,
      inputs: [{ name: 'value', type: 'NUMBER' }]
    })
    blueprintGraph.subgraphs.set(subgraphA.id, subgraphA)
    const leafA = LiteGraph.createNode('number-widget')!
    leafA.id = toNodeId(50)
    subgraphA.add(leafA)
    subgraphA.inputNode.slots[0].connect(leafA.inputs[0], leafA)
    const hostA = createTestSubgraphNode(subgraphA, { id: 1 })
    hostA.widgets[0].value = 11
    blueprintGraph.add(hostA)

    const subgraphB = createTestSubgraph({
      rootGraph: blueprintGraph,
      inputs: [{ name: 'value', type: 'NUMBER' }]
    })
    blueprintGraph.subgraphs.set(subgraphB.id, subgraphB)
    const leafB = LiteGraph.createNode('number-widget')!
    leafB.id = toNodeId(60)
    subgraphB.add(leafB)
    subgraphB.inputNode.slots[0].connect(leafB.inputs[0], leafB)
    const hostB = createTestSubgraphNode(subgraphB, { id: 2 })
    hostB.widgets[0].value = 22
    blueprintGraph.add(hostB)

    const workflow = serializeBlueprint(blueprintGraph)
    expect(workflow.definitions?.subgraphs).toHaveLength(2)
    const hostDoc = mint({ nodes: [], links: [] }, CATALOG)
    onTestFinished(() => hostDoc.destroy())
    const op = insertOp(workflow)
    expect(applyOps(hostDoc, [op], CATALOG).outcomes).toEqual([
      { op_id: op.op_id, outcome: 'applied' }
    ])

    const deliver = bindProjection('wf-nested-definitions', graph)
    expect(deliver(Y.encodeStateAsUpdate(hostDoc), [op.op_id])).toBe(true)

    const instances = findSubgraphInstances(graph)
    expect(instances).toHaveLength(2)
    expect(
      new Set(instances.map((i) => promotedWidgetValues(i).value))
    ).toEqual(new Set([11, 22]))
    // Each instance resolved to its OWN definition, not a shared/confused one.
    expect(instances[0].subgraph).not.toBe(instances[1].subgraph)
  })

  it('carries a promoted widget through insert_workflow and preserves it across a subsequent set_widget', () => {
    const graph = new LGraph()
    onTestFinished(enableSubgraphNodeCreation(graph))

    const blueprintGraph = new LGraph()
    const subgraph = createTestSubgraph({
      rootGraph: blueprintGraph,
      inputs: [{ name: 'value', type: 'NUMBER' }]
    })
    blueprintGraph.subgraphs.set(subgraph.id, subgraph)
    const interior = LiteGraph.createNode('number-widget')!
    interior.id = toNodeId(7)
    subgraph.add(interior)
    subgraph.inputNode.slots[0].connect(interior.inputs[0], interior)
    const host = createTestSubgraphNode(subgraph, { id: 1 })
    blueprintGraph.add(host)
    host.widgets[0].value = 5

    const workflow = serializeBlueprint(blueprintGraph)
    const hostDoc = mint({ nodes: [], links: [] }, CATALOG)
    onTestFinished(() => hostDoc.destroy())
    const deliver = bindProjection('wf-promoted-survives-set', graph)
    deliver(Y.encodeStateAsUpdate(hostDoc), [])

    const insert = insertOp(workflow)
    let vector = Y.encodeStateVector(hostDoc)
    expect(applyOps(hostDoc, [insert], CATALOG).outcomes).toEqual([
      { op_id: insert.op_id, outcome: 'applied' }
    ])
    expect(
      deliver(Y.encodeStateAsUpdate(hostDoc, vector), [insert.op_id])
    ).toBe(true)

    const [instance] = findSubgraphInstances(graph)
    expect(instance).toBeDefined()
    expect(instance.widgets[0]?.value).toBe(5)
    const promotedWidgetId = instance.inputs[0]?.widgetId
    expect(promotedWidgetId).toBeDefined()

    vector = Y.encodeStateVector(hostDoc)
    const write = setWidgetOp(
      'insert-then-set-widget',
      2,
      String(instance.id),
      'value',
      42,
      0
    )
    expect(applyOps(hostDoc, [write], CATALOG).outcomes).toEqual([
      { op_id: write.op_id, outcome: 'applied' }
    ])
    expect(deliver(Y.encodeStateAsUpdate(hostDoc, vector), [write.op_id])).toBe(
      true
    )

    expect(graph._nodes.find((n) => n.id === instance.id)).toBe(instance)
    expect(instance.widgets[0]?.value).toBe(42)
    if (promotedWidgetId) {
      expect(useWidgetValueStore().getWidget(promotedWidgetId)?.value).toBe(42)
    }
  })

  it('promotes two different widget types on the same host and renders both correctly', () => {
    const graph = new LGraph()
    onTestFinished(enableSubgraphNodeCreation(graph))

    const blueprintGraph = new LGraph()
    const subgraph = createTestSubgraph({
      rootGraph: blueprintGraph,
      inputs: [
        { name: 'mode', type: 'STRING' },
        { name: 'steps', type: 'NUMBER' }
      ]
    })
    blueprintGraph.subgraphs.set(subgraph.id, subgraph)
    const comboInterior = LiteGraph.createNode('combo-widget')!
    comboInterior.id = toNodeId(8)
    subgraph.add(comboInterior)
    subgraph.inputNode.slots[0].connect(comboInterior.inputs[0], comboInterior)
    const numberInterior = LiteGraph.createNode('number-widget')!
    numberInterior.id = toNodeId(9)
    subgraph.add(numberInterior)
    subgraph.inputNode.slots[1].connect(
      numberInterior.inputs[0],
      numberInterior
    )
    const host = createTestSubgraphNode(subgraph, { id: 1 })
    blueprintGraph.add(host)
    const modeWidget = host.widgets.find((w) => w.name === 'mode')
    const stepsWidget = host.widgets.find((w) => w.name === 'steps')
    if (!modeWidget || !stepsWidget) {
      throw new Error('blueprint host missing an expected promoted widget')
    }
    modeWidget.value = 'randomize'
    stepsWidget.value = 77

    const workflow = serializeBlueprint(blueprintGraph)
    const hostDoc = mint({ nodes: [], links: [] }, CATALOG)
    onTestFinished(() => hostDoc.destroy())
    const op = insertOp(workflow)
    expect(applyOps(hostDoc, [op], CATALOG).outcomes).toEqual([
      { op_id: op.op_id, outcome: 'applied' }
    ])

    const deliver = bindProjection('wf-dual-promoted', graph)
    expect(deliver(Y.encodeStateAsUpdate(hostDoc), [op.op_id])).toBe(true)

    const [instance] = findSubgraphInstances(graph)
    expect(instance).toBeDefined()
    // Read through the host's keyed `widgets_values` rather than the live
    // `widgets` array: both promoted values land here correctly.
    expect(promotedWidgetValues(instance)).toEqual({
      mode: 'randomize',
      steps: 77
    })
  })

  it('two subgraph instances sharing an original host id, in the SAME graph, keep independent promoted values', () => {
    const graph = new LGraph()
    onTestFinished(enableSubgraphNodeCreation(graph))

    function makeWorkflow(value: number) {
      const blueprintGraph = new LGraph()
      const subgraph = createTestSubgraph({
        rootGraph: blueprintGraph,
        inputs: [{ name: 'value', type: 'NUMBER' }]
      })
      blueprintGraph.subgraphs.set(subgraph.id, subgraph)
      const interior = LiteGraph.createNode('number-widget')!
      interior.id = toNodeId(7)
      subgraph.add(interior)
      subgraph.inputNode.slots[0].connect(interior.inputs[0], interior)
      const host = createTestSubgraphNode(subgraph, { id: 9 })
      blueprintGraph.add(host)
      host.widgets[0].value = value
      return serializeBlueprint(blueprintGraph)
    }

    const hostDoc = mint({ nodes: [], links: [] }, CATALOG)
    onTestFinished(() => hostDoc.destroy())
    const deliver = bindProjection('wf-subgraph-collision', graph)
    deliver(Y.encodeStateAsUpdate(hostDoc), [])

    const opA = insertOp(makeWorkflow(1), 'insert-subgraph-collision-a')
    let vector = Y.encodeStateVector(hostDoc)
    expect(applyOps(hostDoc, [opA], CATALOG).outcomes[0]?.outcome).toBe(
      'applied'
    )
    expect(deliver(Y.encodeStateAsUpdate(hostDoc, vector), [opA.op_id])).toBe(
      true
    )

    const opB = insertOp(makeWorkflow(2), 'insert-subgraph-collision-b')
    vector = Y.encodeStateVector(hostDoc)
    expect(applyOps(hostDoc, [opB], CATALOG).outcomes[0]?.outcome).toBe(
      'applied'
    )
    expect(deliver(Y.encodeStateAsUpdate(hostDoc, vector), [opB.op_id])).toBe(
      true
    )

    const instances = findSubgraphInstances(graph)
    expect(instances).toHaveLength(2)
    const [first, second] = instances
    expect(first.id).not.toBe(second.id)
    expect(
      new Set([first.widgets[0]?.value, second.widgets[0]?.value])
    ).toEqual(new Set([1, 2]))
  })

  it('materializes several independent instances of the same definition inserted in one op', () => {
    const graph = new LGraph()
    onTestFinished(enableSubgraphNodeCreation(graph))

    const blueprintGraph = new LGraph()
    const subgraph = createTestSubgraph({
      rootGraph: blueprintGraph,
      inputs: [{ name: 'value', type: 'NUMBER' }]
    })
    blueprintGraph.subgraphs.set(subgraph.id, subgraph)
    const interior = LiteGraph.createNode('number-widget')!
    interior.id = toNodeId(7)
    subgraph.add(interior)
    subgraph.inputNode.slots[0].connect(interior.inputs[0], interior)

    const hostA = createTestSubgraphNode(subgraph, { id: 1 })
    hostA.widgets[0].value = 100
    blueprintGraph.add(hostA)
    const hostB = createTestSubgraphNode(subgraph, { id: 2 })
    hostB.widgets[0].value = 200
    blueprintGraph.add(hostB)

    const workflow = serializeBlueprint(blueprintGraph)
    const hostDoc = mint({ nodes: [], links: [] }, CATALOG)
    onTestFinished(() => hostDoc.destroy())
    const op = insertOp(workflow)
    expect(applyOps(hostDoc, [op], CATALOG).outcomes).toEqual([
      { op_id: op.op_id, outcome: 'applied' }
    ])

    const deliver = bindProjection('wf-multi-instance', graph)
    expect(deliver(Y.encodeStateAsUpdate(hostDoc), [op.op_id])).toBe(true)

    const instances = findSubgraphInstances(graph)
    expect(instances).toHaveLength(2)
    expect(
      new Set(instances.map((instance) => instance.widgets[0]?.value))
    ).toEqual(new Set([100, 200]))
  })

  it('inserts a subgraph instance without disturbing a pre-existing, unrelated instance', () => {
    const graph = new LGraph()
    onTestFinished(enableSubgraphNodeCreation(graph))

    function makeWorkflow(
      nodeType: string,
      hostId: number,
      value: WidgetValue
    ) {
      const blueprintGraph = new LGraph()
      const subgraph = createTestSubgraph({
        rootGraph: blueprintGraph,
        inputs: [{ name: 'v', type: '*' }]
      })
      blueprintGraph.subgraphs.set(subgraph.id, subgraph)
      const interior = LiteGraph.createNode(nodeType)!
      interior.id = toNodeId(7)
      subgraph.add(interior)
      subgraph.inputNode.slots[0].connect(interior.inputs[0], interior)
      const host = createTestSubgraphNode(subgraph, { id: hostId })
      host.widgets[0].value = value
      blueprintGraph.add(host)
      return serializeBlueprint(blueprintGraph)
    }

    const hostDoc = mint({ nodes: [], links: [] }, CATALOG)
    onTestFinished(() => hostDoc.destroy())
    const deliver = bindProjection('wf-coexisting-subgraphs', graph)
    deliver(Y.encodeStateAsUpdate(hostDoc), [])

    const firstOp = insertOp(
      makeWorkflow('toggle-widget', 1, true),
      'insert-coexist-first'
    )
    let vector = Y.encodeStateVector(hostDoc)
    expect(applyOps(hostDoc, [firstOp], CATALOG).outcomes[0]?.outcome).toBe(
      'applied'
    )
    expect(
      deliver(Y.encodeStateAsUpdate(hostDoc, vector), [firstOp.op_id])
    ).toBe(true)
    const [firstInstance] = findSubgraphInstances(graph)
    expect(promotedWidgetValues(firstInstance)).toEqual({ v: true })

    const secondOp = insertOp(
      makeWorkflow('combo-widget', 2, 'randomize'),
      'insert-coexist-second'
    )
    vector = Y.encodeStateVector(hostDoc)
    expect(applyOps(hostDoc, [secondOp], CATALOG).outcomes[0]?.outcome).toBe(
      'applied'
    )
    expect(
      deliver(Y.encodeStateAsUpdate(hostDoc, vector), [secondOp.op_id])
    ).toBe(true)

    const instances = findSubgraphInstances(graph)
    expect(instances).toHaveLength(2)
    // The first instance must still carry its original value untouched.
    const stillFirst = instances.find((i) => i.id === firstInstance.id)
    const other = instances.find((i) => i.id !== firstInstance.id)
    expect(stillFirst && promotedWidgetValues(stillFirst)).toEqual({
      v: true
    })
    expect(other && promotedWidgetValues(other)).toEqual({ v: 'randomize' })
  })

  it('round-trips a promoted widget through alternating set_widget writes (A -> B -> A)', () => {
    const graph = new LGraph()
    onTestFinished(enableSubgraphNodeCreation(graph))

    const blueprintGraph = new LGraph()
    const subgraph = createTestSubgraph({
      rootGraph: blueprintGraph,
      inputs: [{ name: 'value', type: 'NUMBER' }]
    })
    blueprintGraph.subgraphs.set(subgraph.id, subgraph)
    const interior = LiteGraph.createNode('number-widget')!
    interior.id = toNodeId(7)
    subgraph.add(interior)
    subgraph.inputNode.slots[0].connect(interior.inputs[0], interior)
    const host = createTestSubgraphNode(subgraph, { id: 1 })
    blueprintGraph.add(host)
    host.widgets[0].value = 5

    const workflow = serializeBlueprint(blueprintGraph)
    const hostDoc = mint({ nodes: [], links: [] }, CATALOG)
    onTestFinished(() => hostDoc.destroy())
    const deliver = bindProjection('wf-promoted-alternating', graph)
    deliver(Y.encodeStateAsUpdate(hostDoc), [])

    const insert = insertOp(workflow)
    let vector = Y.encodeStateVector(hostDoc)
    expect(applyOps(hostDoc, [insert], CATALOG).outcomes).toEqual([
      { op_id: insert.op_id, outcome: 'applied' }
    ])
    expect(
      deliver(Y.encodeStateAsUpdate(hostDoc, vector), [insert.op_id])
    ).toBe(true)

    const [instance] = findSubgraphInstances(graph)
    expect(instance).toBeDefined()
    expect(instance.widgets[0]?.value).toBe(5)
    const promotedWidgetId = instance.inputs[0]?.widgetId
    expect(promotedWidgetId).toBeDefined()

    // A -> B: write 42 over the initial 5.
    vector = Y.encodeStateVector(hostDoc)
    const toB = setWidgetOp(
      'insert-alternating-to-b',
      2,
      String(instance.id),
      'value',
      42,
      0
    )
    expect(applyOps(hostDoc, [toB], CATALOG).outcomes).toEqual([
      { op_id: toB.op_id, outcome: 'applied' }
    ])
    expect(deliver(Y.encodeStateAsUpdate(hostDoc, vector), [toB.op_id])).toBe(
      true
    )
    expect(instance.widgets[0]?.value).toBe(42)
    if (promotedWidgetId) {
      expect(useWidgetValueStore().getWidget(promotedWidgetId)?.value).toBe(42)
    }

    // B -> A: write 5 back, over the 42 that just landed.
    vector = Y.encodeStateVector(hostDoc)
    const backToA = setWidgetOp(
      'insert-alternating-back-to-a',
      3,
      String(instance.id),
      'value',
      5,
      0
    )
    expect(applyOps(hostDoc, [backToA], CATALOG).outcomes).toEqual([
      { op_id: backToA.op_id, outcome: 'applied' }
    ])
    expect(
      deliver(Y.encodeStateAsUpdate(hostDoc, vector), [backToA.op_id])
    ).toBe(true)
    expect(graph._nodes.find((n) => n.id === instance.id)).toBe(instance)
    expect(instance.widgets[0]?.value).toBe(5)
    if (promotedWidgetId) {
      expect(useWidgetValueStore().getWidget(promotedWidgetId)?.value).toBe(5)
    }
  })

  it('renders a promoted toggle widget on a subgraph instance', () => {
    const graph = new LGraph()
    onTestFinished(enableSubgraphNodeCreation(graph))

    const blueprintGraph = new LGraph()
    const subgraph = createTestSubgraph({
      rootGraph: blueprintGraph,
      inputs: [{ name: 'enabled', type: 'BOOLEAN' }]
    })
    blueprintGraph.subgraphs.set(subgraph.id, subgraph)
    const interior = LiteGraph.createNode('toggle-widget')!
    interior.id = toNodeId(4)
    subgraph.add(interior)
    subgraph.inputNode.slots[0].connect(interior.inputs[0], interior)
    const host = createTestSubgraphNode(subgraph, { id: 1 })
    host.widgets[0].value = true
    blueprintGraph.add(host)

    const workflow = serializeBlueprint(blueprintGraph)
    const hostDoc = mint({ nodes: [], links: [] }, CATALOG)
    onTestFinished(() => hostDoc.destroy())
    const op = insertOp(workflow)
    expect(applyOps(hostDoc, [op], CATALOG).outcomes).toEqual([
      { op_id: op.op_id, outcome: 'applied' }
    ])

    const deliver = bindProjection('wf-toggle-promoted', graph)
    expect(deliver(Y.encodeStateAsUpdate(hostDoc), [op.op_id])).toBe(true)

    const [instance] = findSubgraphInstances(graph)
    expect(instance).toBeDefined()
    expect(promotedWidgetValues(instance)).toEqual({
      enabled: true
    })
  })

  it('materializes a subgraph instance nested inside another subgraph, with its widget visible', () => {
    const graph = new LGraph()
    onTestFinished(enableSubgraphNodeCreation(graph))

    const blueprintGraph = new LGraph()
    const subgraphB = createTestSubgraph({
      rootGraph: blueprintGraph,
      inputs: [{ name: 'value', type: 'NUMBER' }]
    })
    blueprintGraph.subgraphs.set(subgraphB.id, subgraphB)
    const leafB = LiteGraph.createNode('number-widget')
    if (!leafB) throw new Error('Failed to create number-widget node')
    leafB.id = toNodeId(90)
    subgraphB.add(leafB)
    subgraphB.inputNode.slots[0].connect(leafB.inputs[0], leafB)

    const subgraphA = createTestSubgraph({ rootGraph: blueprintGraph })
    blueprintGraph.subgraphs.set(subgraphA.id, subgraphA)
    const interiorHostB = createTestSubgraphNode(subgraphB, {
      parentGraph: subgraphA,
      id: 91
    })
    interiorHostB.widgets[0].value = 42
    subgraphA.add(interiorHostB)

    const hostA = createTestSubgraphNode(subgraphA, { id: 1 })
    blueprintGraph.add(hostA)

    const workflow = serializeBlueprint(blueprintGraph)
    expect(workflow.definitions?.subgraphs).toHaveLength(2)

    const hostDoc = mint({ nodes: [], links: [] }, CATALOG)
    onTestFinished(() => hostDoc.destroy())
    const op = insertOp(workflow)
    expect(applyOps(hostDoc, [op], CATALOG).outcomes).toEqual([
      { op_id: op.op_id, outcome: 'applied' }
    ])

    const deliver = bindProjection('wf-nested-subgraph-instance', graph)
    expect(deliver(Y.encodeStateAsUpdate(hostDoc), [op.op_id])).toBe(true)

    const rootInstances = findSubgraphInstances(graph)
    expect(rootInstances).toHaveLength(1)
    const [rootInstance] = rootInstances

    const interiorInstances = rootInstance.subgraph.nodes.filter(
      (node): node is SubgraphNode => node instanceof SubgraphNode
    )
    expect(interiorInstances).toHaveLength(1)
    const [interiorInstance] = interiorInstances
    expect(interiorInstance.has_errors).not.toBe(true)
    expect(interiorInstance.widgets.map((widget) => widget.name)).toEqual([
      'value'
    ])
    expect(interiorInstance.widgets[0]?.value).toBe(42)
  })
})
