import {
  assert,
  beforeEach,
  describe,
  expect,
  it,
  onTestFinished,
  vi
} from 'vitest'

import {
  LGraphGroup,
  LGraphNode,
  LiteGraph
} from '@/lib/litegraph/src/litegraph'
import type { LGraph, ISlotType } from '@/lib/litegraph/src/litegraph'
import { useWidgetValueStore } from '@/stores/widgetValueStore'

import {
  createTestSubgraph,
  createTestSubgraphNode,
  resetSubgraphFixtureState
} from './__fixtures__/subgraphHelpers'

beforeEach(() => {
  resetSubgraphFixtureState()
})

function createNode(
  graph: LGraph,
  inputs: ISlotType[] = [],
  outputs: ISlotType[] = [],
  title?: string
) {
  const type = JSON.stringify({ inputs, outputs })
  if (!LiteGraph.registered_node_types[type]) {
    class testnode extends LGraphNode {
      constructor(title: string) {
        super(title)
        let i_count = 0
        for (const input of inputs) this.addInput('input_' + i_count++, input)
        let o_count = 0
        for (const output of outputs)
          this.addOutput('output_' + o_count++, output)
      }
    }
    LiteGraph.registered_node_types[type] = testnode
  }
  const node = LiteGraph.createNode(type, title)
  if (!node) {
    throw new Error('Failed to create node')
  }
  graph.add(node)
  return node
}
describe('SubgraphConversion', () => {
  describe('Subgraph Unpacking Functionality', () => {
    it('Should keep interior nodes and links', () => {
      const subgraph = createTestSubgraph()
      const subgraphNode = createTestSubgraphNode(subgraph)
      const graph = subgraphNode.graph!
      graph.add(subgraphNode)

      const node1 = createNode(subgraph, [], ['number'])
      const node2 = createNode(subgraph, ['number'])
      node1.connect(0, node2, 0)

      graph.unpackSubgraph(subgraphNode)

      expect(graph.nodes.length).toBe(2)
      expect(graph.links.size).toBe(1)
    })
    it('Should merge boundary links', () => {
      const subgraph = createTestSubgraph({
        inputs: [{ name: 'value', type: 'number' }],
        outputs: [{ name: 'value', type: 'number' }]
      })
      const subgraphNode = createTestSubgraphNode(subgraph)
      const graph = subgraphNode.graph!
      graph.add(subgraphNode)

      const innerNode1 = createNode(subgraph, [], ['number'])
      const innerNode2 = createNode(subgraph, ['number'], [])
      subgraph.inputNode.slots[0].connect(innerNode2.inputs[0], innerNode2)
      subgraph.outputNode.slots[0].connect(innerNode1.outputs[0], innerNode1)

      const outerNode1 = createNode(graph, [], ['number'])
      const outerNode2 = createNode(graph, ['number'])
      outerNode1.connect(0, subgraphNode, 0)
      subgraphNode.connect(0, outerNode2, 0)

      graph.unpackSubgraph(subgraphNode)

      expect(graph.nodes.length).toBe(4)
      expect(graph.links.size).toBe(2)
    })
    it('Should keep reroutes and groups', () => {
      const subgraph = createTestSubgraph({
        outputs: [{ name: 'value', type: 'number' }]
      })
      const subgraphNode = createTestSubgraphNode(subgraph)
      const graph = subgraphNode.graph!
      graph.add(subgraphNode)

      const inner = createNode(subgraph, [], ['number'])
      const innerLink = subgraph.outputNode.slots[0].connect(
        inner.outputs[0],
        inner
      )
      assert(innerLink)

      const outer = createNode(graph, ['number'])
      const outerLink = subgraphNode.connect(0, outer, 0)
      assert(outerLink)
      subgraph.add(new LGraphGroup())

      subgraph.createReroute([10, 10], innerLink)
      graph.createReroute([10, 10], outerLink)

      graph.unpackSubgraph(subgraphNode)

      expect(graph.reroutes.size).toBe(2)
      expect(graph.groups.length).toBe(1)
    })
    it('Should map reroutes onto split outputs', () => {
      const subgraph = createTestSubgraph({
        outputs: [
          { name: 'value1', type: 'number' },
          { name: 'value2', type: 'number' }
        ]
      })
      const subgraphNode = createTestSubgraphNode(subgraph)
      const graph = subgraphNode.graph!
      graph.add(subgraphNode)

      const inner = createNode(subgraph, [], ['number', 'number'])
      const innerLink1 = subgraph.outputNode.slots[0].connect(
        inner.outputs[0],
        inner
      )
      const innerLink2 = subgraph.outputNode.slots[1].connect(
        inner.outputs[1],
        inner
      )
      const outer1 = createNode(graph, ['number'])
      const outer2 = createNode(graph, ['number'])
      const outer3 = createNode(graph, ['number'])
      const outerLink1 = subgraphNode.connect(0, outer1, 0)
      assert(innerLink1 && innerLink2 && outerLink1)
      subgraphNode.connect(0, outer2, 0)
      subgraphNode.connect(1, outer3, 0)

      subgraph.createReroute([10, 10], innerLink1)
      subgraph.createReroute([10, 20], innerLink2)
      graph.createReroute([10, 10], outerLink1)

      graph.unpackSubgraph(subgraphNode)

      expect(graph.reroutes.size).toBe(3)
      expect(graph.links.size).toBe(3)
      let linkRefCount = 0
      for (const reroute of graph.reroutes.values()) {
        linkRefCount += reroute.linkIds.size
      }
      expect(linkRefCount).toBe(4)
    })
    it('Should map reroutes onto split inputs', () => {
      const subgraph = createTestSubgraph({
        inputs: [
          { name: 'value1', type: 'number' },
          { name: 'value2', type: 'number' }
        ]
      })
      const subgraphNode = createTestSubgraphNode(subgraph)
      const graph = subgraphNode.graph!
      graph.add(subgraphNode)

      const inner1 = createNode(subgraph, ['number', 'number'])
      const inner2 = createNode(subgraph, ['number'])
      const innerLink1 = subgraph.inputNode.slots[0].connect(
        inner1.inputs[0],
        inner1
      )
      const innerLink2 = subgraph.inputNode.slots[1].connect(
        inner1.inputs[1],
        inner1
      )
      const innerLink3 = subgraph.inputNode.slots[1].connect(
        inner2.inputs[0],
        inner2
      )
      assert(innerLink1 && innerLink2 && innerLink3)
      const outer = createNode(graph, [], ['number'])
      const outerLink1 = outer.connect(0, subgraphNode, 0)
      const outerLink2 = outer.connect(0, subgraphNode, 1)
      assert(outerLink1 && outerLink2)

      graph.createReroute([10, 10], outerLink1)
      graph.createReroute([10, 20], outerLink2)
      subgraph.createReroute([10, 10], innerLink1)

      graph.unpackSubgraph(subgraphNode)

      expect(graph.reroutes.size).toBe(3)
      expect(graph.links.size).toBe(3)
      let linkRefCount = 0
      for (const reroute of graph.reroutes.values()) {
        linkRefCount += reroute.linkIds.size
      }
      expect(linkRefCount).toBe(4)
    })

    describe('Unconnected boundary inputs', () => {
      const PROMOTED_TEXT_TYPE = 'Fixture/PromotedText'

      class PromotedTextNode extends LGraphNode {
        constructor() {
          super('PromotedText')
          this.serialize_widgets = true
          const input = this.addInput('text', 'STRING')
          input.widget = { name: 'text' }
          this.addWidget('text', 'text', 'stale interior value', () => {})
        }
      }

      function createPromotedTextSubgraph() {
        LiteGraph.registered_node_types[PROMOTED_TEXT_TYPE] = PromotedTextNode
        onTestFinished(() => {
          delete LiteGraph.registered_node_types[PROMOTED_TEXT_TYPE]
        })

        const subgraph = createTestSubgraph({
          inputs: [{ name: 'text', type: 'STRING' }]
        })
        const subgraphNode = createTestSubgraphNode(subgraph)
        const graph = subgraphNode.graph!
        graph.add(subgraphNode)

        const inner = LiteGraph.createNode(PROMOTED_TEXT_TYPE)
        assert(inner)
        subgraph.add(inner)
        subgraph.inputNode.slots[0].connect(inner.inputs[0], inner)

        const { widgetId } = subgraphNode.inputs[0]
        assert(widgetId)
        return { graph, subgraphNode, hostWidgetId: widgetId }
      }

      it('Should not report a missing link for a promoted widget input', () => {
        const { graph, subgraphNode } = createPromotedTextSubgraph()
        const errorSpy = vi.spyOn(console, 'error').mockImplementation(() => {})

        graph.unpackSubgraph(subgraphNode)

        expect(errorSpy).not.toHaveBeenCalled()
      })

      it('Should hand the promoted host value to the interior widget', () => {
        const { graph, subgraphNode, hostWidgetId } =
          createPromotedTextSubgraph()
        useWidgetValueStore().setValue(hostWidgetId, 'host edit')

        graph.unpackSubgraph(subgraphNode)

        const unpacked = graph.nodes.find(
          (node) => node.type === PROMOTED_TEXT_TYPE
        )
        expect(unpacked?.widgets?.[0].value).toBe('host edit')
      })

      it('Should leave the interior value alone when the host has no value', () => {
        const { graph, subgraphNode } = createPromotedTextSubgraph()

        graph.unpackSubgraph(subgraphNode)

        const unpacked = graph.nodes.find(
          (node) => node.type === PROMOTED_TEXT_TYPE
        )
        expect(unpacked?.widgets?.[0].value).toBe('stale interior value')
      })

      it('Should not report a missing link for an unconnected plain input', () => {
        const subgraph = createTestSubgraph({
          inputs: [{ name: 'value', type: 'number' }]
        })
        const subgraphNode = createTestSubgraphNode(subgraph)
        const graph = subgraphNode.graph!
        graph.add(subgraphNode)

        const inner = createNode(subgraph, ['number'])
        subgraph.inputNode.slots[0].connect(inner.inputs[0], inner)
        const errorSpy = vi.spyOn(console, 'error').mockImplementation(() => {})

        graph.unpackSubgraph(subgraphNode)

        expect(errorSpy).not.toHaveBeenCalled()
        expect(graph.nodes.length).toBe(1)
      })
    })
  })
})
