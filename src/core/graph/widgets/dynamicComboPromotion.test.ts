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
import type { ComfyNodeDef as ComfyNodeDefV1 } from '@/schemas/nodeDefSchema'
import { useLitegraphService } from '@/services/litegraphService'
import { graphToPrompt } from '@/utils/executionUtil'

const COMBO_NODE_TYPE = 'test/PromotedDynamicCombo'
const SOURCE_NODE_TYPE = 'test/PromotedDynamicComboSource'

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

function widget(node: LGraphNode, name: string) {
  const found = node.widgets?.find((w) => w.name === name)
  assert(found, `widget ${name} on ${node.type}`)
  return found
}

/** Registers subgraph nodes with the dynamic input hooks the app installs. */
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

function buildPromoted() {
  const graph = newGraph()
  const node = LiteGraph.createNode(COMBO_NODE_TYPE)
  assert(node)
  graph.add(node)
  widget(node, 'mode.factor').value = 7
  const { subgraph, node: host } = graph.convertToSubgraph(
    new Set<Positionable>([node])
  )
  const inner = subgraph.nodes.find((n) => n.type === COMBO_NODE_TYPE)
  assert(inner, 'combo node inside the subgraph')
  assert(host.isSubgraphNode())
  promoteWidget(inner, widget(inner, 'mode'), [host])
  return { graph, inner, host }
}

describe('Promoting a dynamic combo onto a subgraph node', () => {
  beforeEach(async () => {
    LiteGraph.registerNodeType(SOURCE_NODE_TYPE, SourceNode)
    await useLitegraphService().registerNodeDef(COMBO_NODE_TYPE, comboNodeDef)
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
    const source = LiteGraph.createNode(SOURCE_NODE_TYPE)
    assert(source)
    graph.add(source)

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

  test('keeps the subgraph node option and child values across save and load', () => {
    const { graph, host } = buildPromoted()
    widget(host, 'mode').value = 'caption'
    widget(host, 'mode.text').value = 'saved'

    const reloaded = newGraph()
    const data = structuredClone(graph.serialize())
    reloaded.configure(data)
    const reloadedHost = reloaded.getNodeById(host.id)
    assert(reloadedHost?.isSubgraphNode())
    reloadedHost.subgraph.nodes.forEach((n) => n.onAfterGraphConfigured?.())

    expect(widget(reloadedHost, 'mode').value).toBe('caption')
    expect(widget(reloadedHost, 'mode.text').value).toBe('saved')
    const reloadedInner = reloadedHost.subgraph.nodes[0]
    expect(names(reloadedInner).inputs).toEqual(['mode'])
  })
})
