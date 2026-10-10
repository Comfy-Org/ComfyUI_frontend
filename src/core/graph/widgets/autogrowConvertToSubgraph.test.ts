import {
  assert,
  beforeEach,
  describe,
  expect,
  onTestFinished,
  test
} from 'vitest'

import { LGraph, LGraphNode, LiteGraph } from '@/lib/litegraph/src/litegraph'
import { enableSubgraphNodeCreation } from '@/lib/litegraph/src/subgraph/__fixtures__/subgraphHelpers'
import type { ComfyNodeDef as ComfyNodeDefV1 } from '@/schemas/nodeDefSchema'
import { useLitegraphService } from '@/services/litegraphService'

const AUTOGROW_NODE_TYPE = 'test/AutogrowThenPlainInputs'
const SOURCE_NODE_TYPE = 'test/ImageMaskFloatSource'

/**
 * An autogrow group followed by ordinary inputs: the shape FE-3325 reports.
 * Growing the group shifts `mask` and `strength` to later slots.
 */
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

class SourceNode extends LGraphNode {
  constructor() {
    super('Source')
    this.addOutput('image', 'IMAGE')
    this.addOutput('mask', 'MASK')
    this.addOutput('value', 'FLOAT')
  }
}

/** Connected inputs as `name -> link type`, so a link on the wrong slot shows. */
function connectedInputTypes(node: LGraphNode): Record<string, string> {
  return Object.fromEntries(
    node.inputs.flatMap((input, slot) => {
      const link = node.getInputLink(slot)
      return link ? [[input.name, String(link.type)]] : []
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

/**
 * FE-3325 repro only - no fix ships with these tests.
 *
 * `multiClone` round-trips each selected node through a fresh, graph-less
 * node. Its default autogrow layout makes `ComfyNode.configure` append the
 * grown slots after `mask`/`strength`, and with no graph the serialized link
 * ids are lost, so `realignInputLinkSlots` cannot repoint the subgraph's
 * links by name. They keep the original slot indices and land on the wrong
 * inputs. Flip `test.fails` to `test` once Convert to Subgraph is fixed.
 */
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
    source.connect(0, node, slotOf('images.image1'))
    source.connect(0, node, slotOf('images.image2'))
    source.connect(1, node, slotOf('mask'))
    source.connect(2, node, slotOf('strength'))
    expect(connectedInputTypes(node)).toEqual(EXPECTED_CONNECTIONS)
    return { graph, source, node }
  }

  function innerAutogrowNode(graph: LGraph, items: Set<LGraphNode>) {
    const { subgraph } = graph.convertToSubgraph(items)
    const inner = subgraph.nodes.find(
      (node) => node.type === AUTOGROW_NODE_TYPE
    )
    assert.ok(inner, 'autogrow node inside the subgraph')
    return inner
  }

  test('wires the grown group ahead of mask and strength', () => {
    const { node } = buildGraph()
    expect(node.inputs.map((input) => input.name)).toEqual([
      'images.image0',
      'images.image1',
      'images.image2',
      'images.image3',
      'mask',
      'strength'
    ])
  })

  test('converts with the autogrow node inside the subgraph', () => {
    const boundary = buildGraph()
    expect(
      innerAutogrowNode(boundary.graph, new Set([boundary.node])).type
    ).toBe(AUTOGROW_NODE_TYPE)
    const internal = buildGraph()
    expect(
      innerAutogrowNode(
        internal.graph,
        new Set([internal.source, internal.node])
      ).type
    ).toBe(AUTOGROW_NODE_TYPE)
  })

  test.fails('keeps every link on its input when the sources stay outside (boundary links)', () => {
    const { graph, node } = buildGraph()
    const inner = innerAutogrowNode(graph, new Set([node]))
    expect(connectedInputTypes(inner)).toEqual(EXPECTED_CONNECTIONS)
  })

  test.fails('keeps every link on its input when the sources are converted too (internal links)', () => {
    const { graph, source, node } = buildGraph()
    const inner = innerAutogrowNode(graph, new Set([source, node]))
    expect(connectedInputTypes(inner)).toEqual(EXPECTED_CONNECTIONS)
  })
})
