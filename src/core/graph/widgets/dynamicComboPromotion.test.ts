import {
  assert,
  beforeEach,
  describe,
  expect,
  onTestFinished,
  test
} from 'vitest'

import { promoteWidget } from '@/core/graph/subgraph/promotionUtils'
import {
  LGraphNode,
  LiteGraph,
  SubgraphNode
} from '@/lib/litegraph/src/litegraph'
import type { LGraph, Positionable } from '@/lib/litegraph/src/litegraph'
import { createTestRootGraph } from '@/lib/litegraph/src/subgraph/__fixtures__/subgraphHelpers'
import type { INodeInputSlot } from '@comfyorg/graph-model/slots'
import {
  bindPromotedDynamicInput,
  unbindPromotedDynamicInput
} from '@/core/graph/widgets/dynamicWidgets'
import type { ComfyNodeDef as ComfyNodeDefV1 } from '@comfyorg/object-info-parser'
import { useLitegraphService } from '@/services/litegraphService'
import { graphToPrompt } from '@/utils/executionUtil'
import { triggerCallbackOnAllNodes } from '@/utils/graphTraversalUtil'

const COMBO_NODE_TYPE = 'test/PromotedDynamicCombo'
const SOURCE_NODE_TYPE = 'test/PromotedDynamicComboSource'
const NESTED_NODE_TYPE = 'test/PromotedNestedDynamicCombo'
const OTHER_COMBO_NODE_TYPE = 'test/PromotedOtherDynamicCombo'
const INT_NODE_TYPE = 'test/PromotedInt'
const AUTOGROW_NODE_TYPE = 'test/PromotedAutogrow'

const comboNodeDef: ComfyNodeDefV1 = {
  name: COMBO_NODE_TYPE,
  display_name: 'Promoted Dynamic Combo',
  category: 'testing',
  python_module: 'nodes',
  description: '',
  input: {
    required: {
      mode: [
        'COMFY_DYNAMICCOMBO_V3',
        {
          options: [
            {
              key: 'scale',
              inputs: {
                required: {
                  factor: ['INT', { default: 2 }],
                  image: ['IMAGE', {}]
                }
              }
            },
            {
              key: 'caption',
              inputs: { required: { text: ['STRING', { default: 'hi' }] } }
            }
          ]
        }
      ]
    }
  },
  output: ['IMAGE'],
  output_name: ['IMAGE'],
  output_node: false
}

function nodeDef(
  name: string,
  mode: NonNullable<NonNullable<ComfyNodeDefV1['input']>['required']>[string]
): ComfyNodeDefV1 {
  return { ...comboNodeDef, name, input: { required: { mode } } }
}

const nodeDefs = [
  comboNodeDef,
  nodeDef(NESTED_NODE_TYPE, [
    'COMFY_DYNAMICCOMBO_V3',
    {
      options: [
        {
          key: 'scale',
          inputs: {
            required: {
              factor: ['INT', { default: 2 }],
              sub: [
                'COMFY_DYNAMICCOMBO_V3',
                {
                  options: [
                    {
                      key: 'a',
                      inputs: { required: { x: ['INT', { default: 1 }] } }
                    },
                    {
                      key: 'b',
                      inputs: { required: { y: ['INT', { default: 3 }] } }
                    }
                  ]
                }
              ]
            }
          }
        }
      ]
    }
  ]),
  nodeDef(OTHER_COMBO_NODE_TYPE, [
    'COMFY_DYNAMICCOMBO_V3',
    {
      options: [
        { key: 'zeta', inputs: { required: { q: ['INT', { default: 9 }] } } }
      ]
    }
  ]),
  nodeDef(INT_NODE_TYPE, ['INT', { default: 4 }]),
  nodeDef(AUTOGROW_NODE_TYPE, [
    'COMFY_AUTOGROW_V3',
    {
      template: {
        input: { required: { item: ['INT', { forceInput: true }] } },
        prefix: 'item',
        min: 1
      }
    }
  ])
]

class SourceNode extends LGraphNode {
  constructor() {
    super('Source')
    this.addOutput('IMAGE', 'IMAGE')
  }
}

function names(node: LGraphNode) {
  return {
    inputs: node.inputs.map((input) => input.name),
    widgets: node.widgets?.map((widget) => widget.name) ?? []
  }
}

function values(node: LGraphNode) {
  return Object.fromEntries(node.widgets?.map((w) => [w.name, w.value]) ?? [])
}

function widget(node: LGraphNode, name: string) {
  const found = node.widgets?.find((w) => w.name === name)
  assert(found, `widget ${name} on ${node.type}`)
  return found
}

function newGraph(): LGraph {
  const graph = createTestRootGraph()
  const listener = (e: CustomEvent<{ subgraph: SubgraphNode['subgraph'] }>) => {
    const { subgraph } = e.detail
    class DynamicSubgraphNode extends SubgraphNode {
      constructor() {
        super(graph, subgraph, {
          id: -1,
          type: subgraph.id,
          pos: [0, 0],
          size: [100, 100],
          inputs: [],
          outputs: [],
          flags: {},
          mode: 0,
          order: 0
        })
      }
      protected override bindDynamicInput(
        input: INodeInputSlot,
        interiorNode: LGraphNode,
        interiorInput: INodeInputSlot
      ) {
        return bindPromotedDynamicInput(
          this,
          input,
          interiorNode,
          interiorInput
        )
      }
      protected override unbindDynamicInput(input: INodeInputSlot) {
        return unbindPromotedDynamicInput(this, input)
      }
    }
    LiteGraph.registered_node_types[subgraph.id] = DynamicSubgraphNode
    onTestFinished(() => {
      delete LiteGraph.registered_node_types[subgraph.id]
    })
  }
  graph.events.addEventListener('subgraph-created', listener)
  onTestFinished(() =>
    graph.events.removeEventListener('subgraph-created', listener)
  )
  return graph
}

function input(node: LGraphNode, name: string) {
  const found = node.inputs.find((i) => i.name === name)
  assert(found, `input ${name} on ${node.type}`)
  return found
}

function addNode(graph: LGraph, type: string) {
  const node = LiteGraph.createNode(type)
  assert(node, `node type ${type}`)
  graph.add(node)
  return node
}

function setValues(node: LGraphNode, edits: Record<string, string | number>) {
  for (const [name, value] of Object.entries(edits))
    widget(node, name).value = value
}

function buildPromoted(
  type = COMBO_NODE_TYPE,
  interiorValues: Record<string, string | number> = { 'mode.factor': 7 }
) {
  const graph = newGraph()
  const node = addNode(graph, type)
  setValues(node, interiorValues)
  const { subgraph, node: host } = graph.convertToSubgraph(
    new Set<Positionable>([node])
  )
  const inner = subgraph.nodes.find((n) => n.type === type)
  assert(inner, 'combo node inside the subgraph')
  assert(host.isSubgraphNode())
  promoteWidget(inner, widget(inner, 'mode'), [host])
  return { graph, inner, host }
}

describe('Promoting a dynamic combo onto a subgraph node', () => {
  beforeEach(async () => {
    LiteGraph.registerNodeType(SOURCE_NODE_TYPE, SourceNode)
    for (const def of nodeDefs)
      await useLitegraphService().registerNodeDef(def.name, def)
  })

  test('moves the option inputs from the interior node to the subgraph node', () => {
    const { inner, host } = buildPromoted()
    expect(names(inner)).toEqual({ inputs: ['mode'], widgets: ['mode'] })
    expect(names(host)).toEqual({
      inputs: ['mode', 'mode.factor', 'mode.image'],
      widgets: ['mode', 'mode.factor']
    })
    expect(widget(host, 'mode.factor').value).toBe(7)
  })

  test('rejects a link to the promoted combo input from a node output', () => {
    const { graph, host } = buildPromoted()
    const source = addNode(graph, SOURCE_NODE_TYPE)

    expect(source.connect(0, host, 0)).toBeNull()
    expect(host.isInputConnected(0)).toBe(false)
  })

  test('switching the subgraph node option swaps its child inputs', () => {
    const { inner, host } = buildPromoted()
    widget(host, 'mode').value = 'caption'
    expect(names(host).inputs).toEqual(['mode', 'mode.text'])
    expect(names(inner).inputs).toEqual(['mode'])
  })

  test('demoting restores the option inputs on the interior node', async () => {
    const { inner, host } = buildPromoted()
    host.subgraph.inputs[0].disconnect()
    await Promise.resolve()
    expect(names(inner).inputs).toEqual(['mode', 'mode.factor', 'mode.image'])
    expect(widget(inner, 'mode.factor').value).toBe(7)
    expect(names(host)).toEqual({ inputs: ['mode'], widgets: [] })
  })

  test('executes with the subgraph node option and child values', async () => {
    const { graph, inner, host } = buildPromoted()
    widget(host, 'mode').value = 'caption'
    widget(host, 'mode.text').value = 'promoted'
    const source = addNode(graph, SOURCE_NODE_TYPE)

    const { output } = await graphToPrompt(graph)
    expect(output[`${host.id}:${inner.id}`].inputs).toMatchObject({
      mode: 'caption',
      'mode.text': 'promoted'
    })

    widget(host, 'mode').value = 'scale'
    source.connect(
      0,
      host,
      host.inputs.findIndex((i) => i.name === 'mode.image')
    )
    const { output: scaled } = await graphToPrompt(graph)
    expect(scaled[`${host.id}:${inner.id}`].inputs).toMatchObject({
      mode: 'scale',
      'mode.factor': 7,
      'mode.image': [String(source.id), 0]
    })
  })

  test('executes with a child value whose widget is not saved with the workflow', async () => {
    const { graph, inner, host } = buildPromoted()
    widget(host, 'mode.factor').serialize = false

    const { output } = await graphToPrompt(graph)
    expect(output[`${host.id}:${inner.id}`].inputs).toMatchObject({
      'mode.factor': 7
    })
  })

  test('copies nested option values from the interior node', () => {
    const { host } = buildPromoted(NESTED_NODE_TYPE, {
      'mode.sub': 'b',
      'mode.sub.y': 55
    })
    expect(values(host)).toEqual({
      mode: 'scale',
      'mode.factor': 2,
      'mode.sub': 'b',
      'mode.sub.y': 55
    })
  })

  test.for([
    {
      type: OTHER_COMBO_NODE_TYPE,
      inputs: ['mode', 'mode.q'],
      widgets: { mode: 'zeta', 'mode.q': 9 }
    },
    { type: INT_NODE_TYPE, inputs: ['mode'], widgets: { mode: 4 } }
  ])(
    'rewiring to a $type input in the same tick replaces the option inputs',
    async ({ type, inputs, widgets }) => {
      const { host } = buildPromoted()
      const target = addNode(host.subgraph, type)
      const [subgraphInput] = host.subgraph.inputs

      subgraphInput.disconnect()
      subgraphInput.connect(input(target, 'mode'), target)
      await Promise.resolve()

      expect(names(host).inputs).toEqual(inputs)
      expect(values(host)).toEqual(widgets)
    }
  )

  test('reconnecting the same interior input in the same tick keeps the subgraph node values', async () => {
    const { inner, host } = buildPromoted()
    widget(host, 'mode.factor').value = 9
    const [subgraphInput] = host.subgraph.inputs

    subgraphInput.disconnect()
    subgraphInput.connect(input(inner, 'mode'), inner)
    await Promise.resolve()

    expect(values(host)).toEqual({ mode: 'scale', 'mode.factor': 9 })
  })

  test('drops a promoted widget when its input stays linked to an autogrow group', async () => {
    const graph = newGraph()
    const nodes = [INT_NODE_TYPE, AUTOGROW_NODE_TYPE].map((type) =>
      addNode(graph, type)
    )
    const { subgraph, node: host } = graph.convertToSubgraph(
      new Set<Positionable>(nodes)
    )
    const [intNode, autogrowNode] = subgraph.nodes
    assert(host.isSubgraphNode())
    promoteWidget(intNode, widget(intNode, 'mode'), [host])
    subgraph.inputs[0].connect(input(autogrowNode, 'mode'), autogrowNode)

    intNode.disconnectInput(0)
    await Promise.resolve()

    expect(names(host).widgets).toEqual([])
    expect(host.serialize().widgets_values).toBeUndefined()
  })

  test.for<{ type: string; edits: Record<string, string | number> }>([
    {
      type: COMBO_NODE_TYPE,
      edits: { mode: 'caption', 'mode.text': 'saved' }
    },
    {
      type: NESTED_NODE_TYPE,
      edits: { 'mode.factor': 7, 'mode.sub': 'b', 'mode.sub.y': 55 }
    }
  ])(
    'keeps the $type option and child values across save and load',
    ({ type, edits }) => {
      const { graph, host } = buildPromoted(type, {})
      setValues(host, edits)

      const reloaded = newGraph()
      reloaded.configure(structuredClone(graph.serialize()))
      const reloadedHost = reloaded.getNodeById(host.id)
      assert(reloadedHost?.isSubgraphNode())
      triggerCallbackOnAllNodes(reloaded, 'onAfterGraphConfigured')

      expect(values(reloadedHost)).toMatchObject(edits)
      expect(names(reloadedHost.subgraph.nodes[0]).inputs).toEqual(['mode'])
    }
  )
})
