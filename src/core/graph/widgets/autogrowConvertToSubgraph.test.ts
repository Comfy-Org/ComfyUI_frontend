import {
  assert,
  beforeEach,
  describe,
  expect,
  onTestFinished,
  test
} from 'vitest'

import { SUBGRAPH_INPUT_ID } from '@/lib/litegraph/src/constants'
import { LGraph, LGraphNode, LiteGraph } from '@/lib/litegraph/src/litegraph'
import type { SubgraphNode } from '@/lib/litegraph/src/litegraph'
import { enableSubgraphNodeCreation } from '@/lib/litegraph/src/subgraph/__fixtures__/subgraphHelpers'
import type { ComfyNodeDef as ComfyNodeDefV1 } from '@/schemas/nodeDefSchema'
import { useLitegraphService } from '@/services/litegraphService'

const AUTOGROW_NODE_TYPE = 'test/AutogrowThenPlainInputs'
const SOURCE_NODE_TYPE = 'test/ImageMaskFloatSource'

const autogrowNodeDef: ComfyNodeDefV1 = {
  name: AUTOGROW_NODE_TYPE,
  display_name: 'Autogrow Then Plain Inputs',
  category: 'testing',
  python_module: 'nodes',
  description: '',
  input: {
    required: {
      images: [
        'COMFY_AUTOGROW_V3',
        {
          template: {
            input: { required: { image: ['IMAGE', {}] } },
            prefix: 'image',
            min: 1
          }
        }
      ],
      mask: ['MASK', {}],
      strength: ['FLOAT', { default: 1 }]
    }
  },
  output: ['IMAGE'],
  output_name: ['IMAGE'],
  output_node: false
}

const SOURCE_OUTPUTS = {
  image_a: 'IMAGE',
  image_b: 'IMAGE',
  image_c: 'IMAGE',
  mask: 'MASK',
  value: 'FLOAT'
}

class SourceNode extends LGraphNode {
  constructor() {
    super('Source')
    for (const [name, type] of Object.entries(SOURCE_OUTPUTS))
      this.addOutput(name, type)
  }
}

function connectedInputTypes(node: LGraphNode): Record<string, string> {
  return Object.fromEntries(
    node.inputs.flatMap((input, slot) => {
      const link = node.getInputLink(slot)
      return link ? [[input.name, String(link.type)]] : []
    })
  )
}

function connectedInputOrigins(
  node: LGraphNode,
  host?: SubgraphNode
): Record<string, string> {
  return Object.fromEntries(
    node.inputs.flatMap((input, slot) => {
      let link = node.getInputLink(slot) ?? undefined
      let graph = node.graph
      if (link?.origin_id === SUBGRAPH_INPUT_ID && host) {
        graph = host.graph
        link = graph?.getLink(host.inputs[link.origin_slot]?.link)
      }
      const origin = link && graph?.getNodeById(link.origin_id)
      return link && origin
        ? [[input.name, origin.outputs[link.origin_slot].name]]
        : []
    })
  )
}

const EXPECTED_CONNECTIONS = {
  'images.image0': 'IMAGE',
  'images.image1': 'IMAGE',
  'images.image2': 'IMAGE',
  mask: 'MASK',
  strength: 'FLOAT'
}

const EXPECTED_ORIGINS = {
  'images.image0': 'image_a',
  'images.image1': 'image_b',
  'images.image2': 'image_c',
  mask: 'mask',
  strength: 'value'
}

describe('Convert to Subgraph with a grown autogrow group (FE-3325)', () => {
  beforeEach(async () => {
    LiteGraph.registerNodeType(SOURCE_NODE_TYPE, SourceNode)
    await useLitegraphService().registerNodeDef(
      AUTOGROW_NODE_TYPE,
      autogrowNodeDef
    )
  })

  function buildGraph() {
    const graph = new LGraph()
    onTestFinished(enableSubgraphNodeCreation(graph))
    const source = LiteGraph.createNode(SOURCE_NODE_TYPE)
    const node = LiteGraph.createNode(AUTOGROW_NODE_TYPE)
    assert.ok(source && node)
    graph.add(source)
    graph.add(node)
    const slotOf = (name: string) =>
      node.inputs.findIndex((input) => input.name === name)
    source.connect(0, node, slotOf('images.image0'))
    source.connect(1, node, slotOf('images.image1'))
    source.connect(2, node, slotOf('images.image2'))
    source.connect(3, node, slotOf('mask'))
    source.connect(4, node, slotOf('strength'))
    expect(connectedInputTypes(node)).toEqual(EXPECTED_CONNECTIONS)
    expect(connectedInputOrigins(node)).toEqual(EXPECTED_ORIGINS)
    return { graph, source, node }
  }

  function convert(graph: LGraph, items: Set<LGraphNode>) {
    const { subgraph, node: host } = graph.convertToSubgraph(items)
    const inner = subgraph.nodes.find(
      (node) => node.type === AUTOGROW_NODE_TYPE
    )
    assert.ok(inner, 'autogrow node inside the subgraph')
    return { inner, host }
  }

  test('wires the grown group ahead of mask and strength', () => {
    const { node } = buildGraph()
    expect(node.inputs.map((input) => input.name)).toEqual([
      'images',
      'images.image0',
      'images.image1',
      'images.image2',
      'images.image3',
      'mask',
      'strength'
    ])
  })

  test('converts with the autogrow node inside the subgraph when the sources stay outside', () => {
    const { graph, node } = buildGraph()
    expect(convert(graph, new Set([node])).inner.type).toBe(AUTOGROW_NODE_TYPE)
  })

  test('converts with the autogrow node inside the subgraph when the sources are converted too', () => {
    const { graph, source, node } = buildGraph()
    expect(convert(graph, new Set([source, node])).inner.type).toBe(
      AUTOGROW_NODE_TYPE
    )
  })

  test('keeps every link on its input when the sources stay outside (boundary links)', () => {
    const { graph, node } = buildGraph()
    const { inner, host } = convert(graph, new Set([node]))
    expect(connectedInputTypes(inner)).toEqual(EXPECTED_CONNECTIONS)
    expect(connectedInputOrigins(inner, host)).toEqual(EXPECTED_ORIGINS)
  })

  test('keeps every link on its input when the sources are converted too (internal links)', () => {
    const { graph, source, node } = buildGraph()
    const { inner } = convert(graph, new Set([source, node]))
    expect(connectedInputTypes(inner)).toEqual(EXPECTED_CONNECTIONS)
    expect(connectedInputOrigins(inner)).toEqual(EXPECTED_ORIGINS)
  })
})
