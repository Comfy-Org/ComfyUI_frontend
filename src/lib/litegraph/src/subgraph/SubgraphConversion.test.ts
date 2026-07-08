import { assert, beforeEach, describe, expect, it } from 'vitest'
import { createTestingPinia } from '@pinia/testing'
import { setActivePinia } from 'pinia'

import { SUBGRAPH_INPUT_ID } from '@/lib/litegraph/src/constants'
import {
  LGraphGroup,
  LGraphNode,
  LiteGraph,
  SubgraphNode
} from '@/lib/litegraph/src/litegraph'
import type {
  ISlotType,
  LGraph,
  Positionable
} from '@/lib/litegraph/src/litegraph'
import { useLinkStore } from '@/stores/linkStore'
import { useRerouteStore } from '@/stores/rerouteStore'
import { toRerouteId } from '@/types/rerouteId'

import {
  createTestRootGraph,
  createTestSubgraph,
  createTestSubgraphNode,
  resetSubgraphFixtureState
} from './__fixtures__/subgraphHelpers'

beforeEach(() => {
  setActivePinia(createTestingPinia({ stubActions: false }))
  resetSubgraphFixtureState()
})

function enableSubgraphNodeCreation(rootGraph: LGraph): void {
  rootGraph.events.addEventListener('subgraph-created', (e) => {
    const { subgraph } = e.detail
    LiteGraph.registered_node_types[subgraph.id] = class extends SubgraphNode {
      constructor() {
        super(rootGraph, subgraph, {
          id: -1,
          type: subgraph.id,
          pos: [0, 0],
          size: [200, 100],
          inputs: [],
          outputs: [],
          properties: {},
          flags: {},
          mode: 0,
          order: 0
        })
      }
    }
  })
}

const WIDGET_NODE_TYPE = 'test/conversionWidgetNode'

function createWidgetNode(graph: LGraph): LGraphNode {
  if (!LiteGraph.registered_node_types[WIDGET_NODE_TYPE]) {
    class WidgetTestNode extends LGraphNode {
      constructor(title: string) {
        super(title)
        this.addInput('in', 'number')
        this.addOutput('out', 'number')
        this.addWidget('text', 'text_widget', '', () => {})
        this.serialize_widgets = true
      }
    }
    LiteGraph.registered_node_types[WIDGET_NODE_TYPE] = WidgetTestNode
  }
  const node = LiteGraph.createNode(WIDGET_NODE_TYPE)
  if (!node) throw new Error('Failed to create widget node')
  graph.add(node)
  return node
}

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
  describe('Convert to Subgraph store integrity', () => {
    it('keeps interior and boundary-derived input links registered in the link store', () => {
      const rootGraph = createTestRootGraph()
      enableSubgraphNodeCreation(rootGraph)

      const exterior = createNode(rootGraph, [], ['number'])
      const origin = createNode(rootGraph, ['number'], ['number'])
      const target = createNode(rootGraph, ['number'])
      exterior.connect(0, origin, 0)
      origin.connect(0, target, 0)

      const { subgraph, node: subgraphNode } = rootGraph.convertToSubgraph(
        new Set<Positionable>([target, origin])
      )

      const linkStore = useLinkStore()

      expect(linkStore.isInputSlotConnected(rootGraph.id, target.id, 0)).toBe(
        true
      )
      const interiorTopology = linkStore.getInputSlotLink(
        rootGraph.id,
        target.id,
        0
      )
      expect(interiorTopology?.originNodeId).toBe(origin.id)
      expect(subgraph.getLink(interiorTopology?.id)).toBeDefined()

      expect(linkStore.isInputSlotConnected(rootGraph.id, origin.id, 0)).toBe(
        true
      )
      expect(
        linkStore.getInputSlotLink(rootGraph.id, origin.id, 0)?.originNodeId
      ).toBe(SUBGRAPH_INPUT_ID)

      expect(
        linkStore.isInputSlotConnected(rootGraph.id, subgraphNode.id, 0)
      ).toBe(true)
    })

    it('keeps interior reroute chains registered with live membership', () => {
      const rootGraph = createTestRootGraph()
      enableSubgraphNodeCreation(rootGraph)

      const origin = createNode(rootGraph, [], ['number'])
      const target = createNode(rootGraph, ['number'])
      const link = origin.connect(0, target, 0)
      assert(link)
      const reroute = rootGraph.createReroute([50, 50], link)
      assert(reroute)

      const { subgraph } = rootGraph.convertToSubgraph(
        new Set<Positionable>([target, origin, reroute])
      )

      const clonedReroute = subgraph.reroutes.get(reroute.id)
      expect(clonedReroute).toBeDefined()
      expect(
        useRerouteStore().getReroute(rootGraph.id, reroute.id)
      ).toBeDefined()
      expect(clonedReroute!.linkIds.size).toBe(1)
      expect(
        useRerouteStore().getMembership(rootGraph.id, reroute.id).linkIds.size
      ).toBe(1)
    })

    it('keeps converted nodes registered in the badge store', () => {
      const rootGraph = createTestRootGraph()
      enableSubgraphNodeCreation(rootGraph)

      const origin = createNode(rootGraph, [], ['number'])
      const target = createNode(rootGraph, ['number'])
      origin.connect(0, target, 0)

      rootGraph.convertToSubgraph(new Set<Positionable>([target, origin]))
    })

    it('preserves widget values on interior nodes through conversion', () => {
      const rootGraph = createTestRootGraph()
      enableSubgraphNodeCreation(rootGraph)

      const origin = createNode(rootGraph, [], ['number'])
      const target = createWidgetNode(rootGraph)
      origin.connect(0, target, 0)
      target.widgets![0].value = 'converted value'

      const { subgraph } = rootGraph.convertToSubgraph(
        new Set<Positionable>([target, origin])
      )

      const innerTarget = subgraph.nodes.find((node) => node.id === target.id)
      expect(innerTarget).toBeDefined()
      expect(innerTarget!.widgets?.[0]?.value).toBe('converted value')
    })
  })

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
    it('Should truncate cyclic reroute chains instead of aborting unpack', () => {
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

      const first = subgraph.createReroute([10, 10], innerLink)!
      const second = subgraph.createReroute([20, 20], first)!
      // Simulate corrupt data: first → second → first
      second._chain.parentId = first.id

      expect(() => graph.unpackSubgraph(subgraphNode)).not.toThrow()

      expect(graph.nodes.length).toBe(2)
      expect(graph.links.size).toBe(1)
      expect(graph.reroutes.size).toBe(2)
      const [link] = [...graph.links.values()]
      assert(link.parentId !== undefined)
      expect(graph.reroutes.get(link.parentId)).toBeDefined()
    })
    it('Should not stitch broken external parentId references onto merged links', () => {
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

      // Simulate corrupt data: the external chain names a missing reroute
      outerLink.parentId = toRerouteId(999)

      graph.unpackSubgraph(subgraphNode)

      expect(graph.links.size).toBe(1)
      const [link] = [...graph.links.values()]
      expect(link.parentId).toBeUndefined()
    })
  })
})
