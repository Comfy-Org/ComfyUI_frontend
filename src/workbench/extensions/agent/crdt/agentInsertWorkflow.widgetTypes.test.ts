/**
 * Extended coverage for `insert_workflow`-materialized widget rendering,
 * complementing the PM-1580 regression pins in
 * `agentInsertWorkflowWidgets.regression.test.ts` (which covers exactly the
 * bug that was fixed: a `TestSaveImage`-shaped node with one `text` widget,
 * plus the two-way same-graph id-collision case).
 *
 * This file exercises the same pipeline (comfy-multi-player's
 * `insert_workflow` applier -> `AgentCrdtProjection` -> `graphMutations` ->
 * `agentNodeMaterializer`) across the widget TYPES a real node can carry
 * (combo, number, text, toggle, multiline) and a few id-collision shapes the
 * regression file does not: cross-graph collisions and a three-way
 * same-graph collision.
 */
import { applyOps, mint } from '@comfyorg/comfy-multi-player'
import type {
  InsertWorkflowOp,
  WidgetCatalog
} from '@comfyorg/comfy-multi-player'
import { describe, expect, it, onTestFinished } from 'vitest'
import * as Y from 'yjs'

import { LGraph, LGraphNode, LiteGraph } from '@/lib/litegraph/src/litegraph'
import {
  stripGraphPrefix,
  useWidgetValueStore
} from '@/stores/widgetValueStore'
import { graphScopeOf } from '@/types/graphScopeId'

import { AgentCrdtProjection } from './agentCrdtProjection'
import { inertPlacementPort } from './__fixtures__/inertPlacementPort'
import { FollowerDoc } from './followerDoc'
import { createGraphMutations } from './graphMutations'

class TestComboNode extends LGraphNode {
  static override title = 'Test Combo'
  constructor() {
    super('Test Combo')
    this.addWidget('combo', 'mode', 'fixed', () => {}, {
      values: ['fixed', 'increment', 'decrement', 'randomize']
    })
    this.serialize_widgets = true
  }
}

class TestNumberNode extends LGraphNode {
  static override title = 'Test Number'
  constructor() {
    super('Test Number')
    this.addWidget('number', 'steps', 20, () => {}, { min: 1, max: 100 })
    this.serialize_widgets = true
  }
}

class TestTextNode extends LGraphNode {
  static override title = 'Test Text'
  constructor() {
    super('Test Text')
    this.addWidget('text', 'filename_prefix', 'ComfyUI', () => {})
    this.serialize_widgets = true
  }
}

class TestToggleNode extends LGraphNode {
  static override title = 'Test Toggle'
  constructor() {
    super('Test Toggle')
    this.addWidget('toggle', 'enabled', false, () => {})
    this.serialize_widgets = true
  }
}

class TestMultilineNode extends LGraphNode {
  static override title = 'Test Multiline'
  constructor() {
    super('Test Multiline')
    this.addCustomWidget({
      name: 'prompt',
      type: 'customtext',
      value: '',
      options: { multiline: true },
      y: 0
    })
    this.serialize_widgets = true
  }
}

/** Mirrors a real sampler node's widget cluster: mixed types in one node. */
class TestMultiWidgetNode extends LGraphNode {
  static override title = 'Test Multi Widget'
  constructor() {
    super('Test Multi Widget')
    this.addWidget('number', 'seed', 0, () => {})
    this.addWidget('number', 'steps', 20, () => {})
    this.addWidget('number', 'cfg', 8, () => {})
    this.addWidget('combo', 'sampler_name', 'euler', () => {}, {
      values: ['euler', 'dpmpp_2m', 'ddim']
    })
    this.addWidget('toggle', 'add_noise', true, () => {})
    this.serialize_widgets = true
  }
}

const CATALOG: WidgetCatalog = {
  types: {
    TestCombo: { widget_order: ['mode'] },
    TestNumber: { widget_order: ['steps'] },
    TestText: { widget_order: ['filename_prefix'] },
    TestToggle: { widget_order: ['enabled'] },
    TestMultiline: { widget_order: ['prompt'] },
    TestMultiWidget: {
      widget_order: ['seed', 'steps', 'cfg', 'sampler_name', 'add_noise']
    }
  }
}

function registerAll(): void {
  LiteGraph.registerNodeType('TestCombo', TestComboNode)
  LiteGraph.registerNodeType('TestNumber', TestNumberNode)
  LiteGraph.registerNodeType('TestText', TestTextNode)
  LiteGraph.registerNodeType('TestToggle', TestToggleNode)
  LiteGraph.registerNodeType('TestMultiline', TestMultilineNode)
  LiteGraph.registerNodeType('TestMultiWidget', TestMultiWidgetNode)
}

let opSeq = 0
function insertOp(
  workflow: InsertWorkflowOp['workflow'],
  opId?: string
): InsertWorkflowOp {
  opSeq += 1
  return {
    op_id: (opId ?? `insert-widget-type-op-${opSeq}`).padEnd(32, '0'),
    actor: 'agent:test',
    base_version: 1,
    stamp: [1, 'agent:test'],
    op: 'insert_workflow',
    workflow
  }
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

/** What `LGraphNode.vue`'s `widgetIds` computed does, read straight from the store. */
function renderedWidgets(graphId: string, nodeId: string) {
  const widgetValueStore = useWidgetValueStore()
  const bareNodeId = stripGraphPrefix(nodeId)
  if (!bareNodeId) return []
  return widgetValueStore
    .getNodeWidgetIds(graphId as never, bareNodeId)
    .flatMap((id) => {
      const widget = widgetValueStore.getWidget(id)
      return widget ? [{ name: widget.name, value: widget.value }] : []
    })
}

function insertSingleNode(
  graph: LGraph,
  workflowId: string,
  nodeId: number,
  type: string,
  widgetsValues: unknown[]
): LGraphNode {
  const host = mint({ nodes: [], links: [] }, CATALOG)
  onTestFinished(() => host.destroy())
  const deliver = bindProjection(workflowId, graph)
  deliver(Y.encodeStateAsUpdate(host), [])

  const op = insertOp({
    nodes: [{ id: nodeId, type, widgets_values: widgetsValues }],
    links: []
  })
  const vector = Y.encodeStateVector(host)
  expect(applyOps(host, [op], CATALOG).outcomes).toEqual([
    { op_id: op.op_id, outcome: 'applied' }
  ])
  expect(deliver(Y.encodeStateAsUpdate(host, vector), [op.op_id])).toBe(true)

  const node = graph._nodes.find((candidate) => candidate.type === type)
  expect(node).toBeDefined()
  if (!node) throw new Error(`no live node of type ${type} was materialized`)
  return node
}

describe('insert_workflow materializes every widget type with the correct value', () => {
  registerAll()

  it('renders a combo widget with its selected value', () => {
    const graph = new LGraph()
    const node = insertSingleNode(graph, 'wf-combo', 1, 'TestCombo', [
      'randomize'
    ])
    expect(renderedWidgets(graph.rootGraph.id, String(node.id))).toEqual([
      { name: 'mode', value: 'randomize' }
    ])
  })

  it('renders a combo widget carrying a value outside its declared options', () => {
    const graph = new LGraph()
    const node = insertSingleNode(graph, 'wf-combo-custom', 1, 'TestCombo', [
      'not-a-listed-option'
    ])
    expect(renderedWidgets(graph.rootGraph.id, String(node.id))).toEqual([
      { name: 'mode', value: 'not-a-listed-option' }
    ])
  })

  it.for([
    { name: 'positive', value: 42 },
    { name: 'zero', value: 0 },
    { name: 'negative', value: -7 }
  ])('renders a number widget with a $name value', ({ value }) => {
    const graph = new LGraph()
    const node = insertSingleNode(graph, 'wf-number', 1, 'TestNumber', [value])
    expect(renderedWidgets(graph.rootGraph.id, String(node.id))).toEqual([
      { name: 'steps', value }
    ])
  })

  it('renders a text widget with its string value', () => {
    const graph = new LGraph()
    const node = insertSingleNode(graph, 'wf-text', 1, 'TestText', [
      'my_custom_prefix'
    ])
    expect(renderedWidgets(graph.rootGraph.id, String(node.id))).toEqual([
      { name: 'filename_prefix', value: 'my_custom_prefix' }
    ])
  })

  it.for([
    { name: 'true', value: true },
    { name: 'false', value: false }
  ])('renders a toggle widget set to $name', ({ value }) => {
    const graph = new LGraph()
    const node = insertSingleNode(graph, 'wf-toggle', 1, 'TestToggle', [value])
    expect(renderedWidgets(graph.rootGraph.id, String(node.id))).toEqual([
      { name: 'enabled', value }
    ])
  })

  it('renders a multiline text widget with embedded newlines intact', () => {
    const graph = new LGraph()
    const prompt = 'a glorious spooky duck\nin a cathedral\nat dusk'
    const node = insertSingleNode(graph, 'wf-multiline', 1, 'TestMultiline', [
      prompt
    ])
    expect(renderedWidgets(graph.rootGraph.id, String(node.id))).toEqual([
      { name: 'prompt', value: prompt }
    ])
  })

  it('renders every widget on a multi-widget node, in declared order, with correct values', () => {
    const graph = new LGraph()
    const node = insertSingleNode(graph, 'wf-multi', 1, 'TestMultiWidget', [
      12345,
      30,
      6.5,
      'dpmpp_2m',
      false
    ])
    expect(renderedWidgets(graph.rootGraph.id, String(node.id))).toEqual([
      { name: 'seed', value: 12345 },
      { name: 'steps', value: 30 },
      { name: 'cfg', value: 6.5 },
      { name: 'sampler_name', value: 'dpmpp_2m' },
      { name: 'add_noise', value: false }
    ])
  })

  it('renders only the widgets a partial widgets_values array actually supplies', () => {
    const graph = new LGraph()
    // Only the first two of five widget values are supplied.
    const node = insertSingleNode(
      graph,
      'wf-partial',
      1,
      'TestMultiWidget',
      [999, 15]
    )
    const rendered = renderedWidgets(graph.rootGraph.id, String(node.id))
    expect(rendered).toEqual([
      { name: 'seed', value: 999 },
      { name: 'steps', value: 15 }
    ])
  })

  it('two inserted nodes sharing an original id, in DIFFERENT graphs, keep independent widget values', () => {
    const graphA = new LGraph()
    const graphB = new LGraph()
    const nodeA = insertSingleNode(graphA, 'wf-cross-graph-a', 9, 'TestText', [
      'value-in-graph-a'
    ])
    const nodeB = insertSingleNode(graphB, 'wf-cross-graph-b', 9, 'TestText', [
      'value-in-graph-b'
    ])

    expect(renderedWidgets(graphA.rootGraph.id, String(nodeA.id))).toEqual([
      { name: 'filename_prefix', value: 'value-in-graph-a' }
    ])
    expect(renderedWidgets(graphB.rootGraph.id, String(nodeB.id))).toEqual([
      { name: 'filename_prefix', value: 'value-in-graph-b' }
    ])
  })

  it('three inserted nodes sharing an original id, in the SAME graph, each keep their own widget value', () => {
    const graph = new LGraph()
    const host = mint({ nodes: [], links: [] }, CATALOG)
    onTestFinished(() => host.destroy())
    const deliver = bindProjection('wf-triple-collision', graph)
    deliver(Y.encodeStateAsUpdate(host), [])

    const values = ['first', 'second', 'third']
    for (const value of values) {
      const op = insertOp({
        nodes: [{ id: 3, type: 'TestText', widgets_values: [value] }],
        links: []
      })
      const vector = Y.encodeStateVector(host)
      expect(applyOps(host, [op], CATALOG).outcomes[0]?.outcome).toBe('applied')
      expect(deliver(Y.encodeStateAsUpdate(host, vector), [op.op_id])).toBe(
        true
      )
    }

    const nodes = graph._nodes.filter((n) => n.type === 'TestText')
    expect(nodes).toHaveLength(3)
    const ids = new Set(nodes.map((n) => String(n.id)))
    expect(ids.size).toBe(3)

    const renderedValues = nodes.map(
      (n) => renderedWidgets(graph.rootGraph.id, String(n.id))[0]?.value
    )
    expect(new Set(renderedValues)).toEqual(new Set(values))
  })
})
