import {
  assert,
  beforeEach,
  describe,
  expect,
  it,
  onTestFinished,
  vi
} from 'vitest'

import { SUBGRAPH_INPUT_ID } from '@/lib/litegraph/src/constants'
import { LGraphGroup, LiteGraph } from '@/lib/litegraph/src/litegraph'
import type {
  LGraph,
  LGraphNode,
  Positionable,
  SubgraphNode
} from '@/lib/litegraph/src/litegraph'
import {
  createTestNode,
  createTestWidgetNode
} from '@/lib/litegraph/src/__fixtures__/nodeHelpers'
import { useLinkStore } from '@/stores/linkStore'
import { useRerouteStore } from '@/stores/rerouteStore'
import { useWidgetValueStore } from '@/stores/widgetValueStore'
import { graphScopeOf } from '@/types/graphScopeId'
import { toNodeId } from '@/types/nodeId'
import { toRerouteId } from '@/types/rerouteId'

import {
  createTestRootGraph,
  createTestSubgraph,
  createTestSubgraphData,
  createTestSubgraphNode,
  enableSubgraphNodeCreation,
  resetSubgraphFixtureState
} from './__fixtures__/subgraphHelpers'

beforeEach(() => {
  resetSubgraphFixtureState()
})

function expectUnpackRejected(graph: LGraph, subgraphNode: SubgraphNode): void {
  const before = JSON.stringify(graph.serialize())
  const nodeCount = graph.nodes.length
  const beforeChange = vi.spyOn(graph, 'beforeChange')
  const afterChange = vi.spyOn(graph, 'afterChange')

  expect(graph.unpackSubgraph(subgraphNode)).toBe(false)
  expect(graph.getNodeById(subgraphNode.id)).toBeDefined()
  expect(graph.nodes.length).toBe(nodeCount)
  expect(JSON.stringify(graph.serialize())).toBe(before)
  expect(beforeChange).not.toHaveBeenCalled()
  expect(afterChange).not.toHaveBeenCalled()
}

describe('SubgraphConversion', () => {
  describe('Convert to Subgraph store integrity', () => {
    it('keeps interior and boundary-derived input links registered in the link store', () => {
      const rootGraph = createTestRootGraph()
      onTestFinished(enableSubgraphNodeCreation(rootGraph))

      const exterior = createTestNode(rootGraph, [], ['number'])
      const origin = createTestNode(rootGraph, ['number'], ['number'])
      const target = createTestNode(rootGraph, ['number'])
      exterior.connect(0, origin, 0)
      origin.connect(0, target, 0)

      const { subgraph, node: subgraphNode } = rootGraph.convertToSubgraph(
        new Set<Positionable>([target, origin])
      )

      const linkStore = useLinkStore()

      expect(
        linkStore.isInputSlotConnected(graphScopeOf(subgraph), target.id, 0)
      ).toBe(true)
      const interiorTopology = linkStore.getInputSlotLink(
        graphScopeOf(subgraph),
        target.id,
        0
      )
      expect(interiorTopology?.originNodeId).toBe(origin.id)
      expect(subgraph.getLink(interiorTopology?.id)).toBeDefined()

      expect(
        linkStore.isInputSlotConnected(graphScopeOf(subgraph), origin.id, 0)
      ).toBe(true)
      expect(
        linkStore.getInputSlotLink(graphScopeOf(subgraph), origin.id, 0)
          ?.originNodeId
      ).toBe(SUBGRAPH_INPUT_ID)

      expect(
        linkStore.isInputSlotConnected(
          graphScopeOf(rootGraph),
          subgraphNode.id,
          0
        )
      ).toBe(true)
    })

    it('keeps interior reroute chains registered with live membership', () => {
      const rootGraph = createTestRootGraph()
      onTestFinished(enableSubgraphNodeCreation(rootGraph))

      const origin = createTestNode(rootGraph, [], ['number'])
      const target = createTestNode(rootGraph, ['number'])
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
        useRerouteStore().getReroute(graphScopeOf(subgraph), reroute.id)
      ).toBeDefined()
      expect(clonedReroute!.linkIds.size).toBe(1)
      expect(
        useRerouteStore().getMembership(graphScopeOf(subgraph), reroute.id)
          .linkIds.size
      ).toBe(1)
    })

    it('connects a nested conversion to its enclosing subgraph output', () => {
      const subgraph = createTestSubgraph({
        outputs: [{ name: 'value', type: 'number' }]
      })
      onTestFinished(enableSubgraphNodeCreation(subgraph.rootGraph))
      const origin = createTestNode(subgraph, [], ['number'])
      const output = subgraph.outputNode.slots[0]
      output.connect(origin.outputs[0], origin)

      const { node: subgraphNode } = subgraph.convertToSubgraph(
        new Set<Positionable>([origin])
      )

      const links = output.getLinks()
      expect(links).toHaveLength(1)
      expect(links[0]).toMatchObject({
        origin_id: subgraphNode.id,
        target_id: output.parent.id
      })
    })

    it('preserves widget values on interior nodes through conversion', () => {
      const rootGraph = createTestRootGraph()
      onTestFinished(enableSubgraphNodeCreation(rootGraph))

      const origin = createTestNode(rootGraph, [], ['number'])
      const target = createTestWidgetNode(rootGraph)
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
    it('keeps a shared definition link registered while copying it to the parent', () => {
      const subgraph = createTestSubgraph()
      const subgraphNode = createTestSubgraphNode(subgraph)
      const graph = subgraphNode.graph!
      graph.add(subgraphNode)
      graph.add(createTestSubgraphNode(subgraph))

      const node1 = createTestNode(subgraph, [], ['number'])
      const node2 = createTestNode(subgraph, ['number'])
      const innerLink = node1.connect(0, node2, 0)
      assert(innerLink)
      const topology = useLinkStore().getInputSlotLink(
        graphScopeOf(subgraph),
        node2.id,
        0
      )

      graph.unpackSubgraph(subgraphNode)

      expect(topology).toMatchObject({
        originNodeId: node1.id,
        originSlot: 0,
        targetNodeId: node2.id,
        targetSlot: 0
      })
      expect(
        useLinkStore().getInputSlotLink(graphScopeOf(subgraph), node2.id, 0)
      ).toBe(topology)
      expect(graph.links.size).toBe(1)
      const [parentLink] = graph.links.values()
      expect(parentLink).toMatchObject({
        origin_slot: 0,
        target_slot: 0
      })
      expect(parentLink.origin_id).not.toBe(node1.id)
      expect(parentLink.target_id).not.toBe(node2.id)
      expect(graph.getNodeById(parentLink.origin_id)).toBeDefined()
      expect(graph.getNodeById(parentLink.target_id)).toBeDefined()
    })
    it('reconnects by input name when earlier links shift dynamic slots', () => {
      const graph = createTestRootGraph()
      onTestFinished(enableSubgraphNodeCreation(graph))

      const sources = [
        createTestNode(graph, [], ['number']),
        createTestNode(graph, [], ['number', 'number']),
        createTestNode(graph, [], ['number', 'number', 'number'])
      ]
      const target = createTestNode(
        graph,
        ['number', 'number', 'number'],
        [],
        'dynamic target'
      )
      sources.forEach((source, index) => source.connect(index, target, index))

      const { subgraph, node: subgraphNode } = graph.convertToSubgraph(
        new Set<Positionable>([target, ...sources])
      )
      const innerTarget = subgraph.nodes.find(
        (node) => node.title === 'dynamic target'
      )
      assert(innerTarget)
      const targetPrototype = Object.getPrototypeOf(innerTarget) as LGraphNode
      targetPrototype.onConnectionsChange = function (_type, slot, connected) {
        if (
          !connected ||
          slot !== 0 ||
          this.findInputSlot('inserted_dynamic_input') !== -1
        )
          return
        this.addInput('inserted_dynamic_input', 'number')
        const insertedInput = this.inputs.pop()
        assert(insertedInput)
        this.inputs.splice(1, 0, insertedInput)
      }

      graph.unpackSubgraph(subgraphNode)

      const unpackedTarget = graph.nodes.find(
        (node) => node.title === 'dynamic target'
      )
      assert(unpackedTarget)
      expect(
        ['input_0', 'input_1', 'input_2'].map(
          (name) =>
            unpackedTarget.getInputLink(unpackedTarget.findInputSlot(name))
              ?.origin_slot
        )
      ).toEqual([0, 1, 2])
      expect(
        unpackedTarget.getInputLink(
          unpackedTarget.findInputSlot('inserted_dynamic_input')
        )
      ).toBeNull()
    })
    it('preserves links to duplicate-named subgraph inputs by ID', () => {
      const graph = createTestRootGraph()
      onTestFinished(enableSubgraphNodeCreation(graph))
      const targetDefinition = graph.createSubgraph(
        createTestSubgraphData({ name: 'duplicate target' })
      )
      targetDefinition.addInput('duplicate', 'number')
      targetDefinition.addInput('duplicate', 'number')
      const target = LiteGraph.createNode(targetDefinition.id)
      assert(target?.isSubgraphNode())
      graph.add(target)
      const source0 = createTestNode(graph, [], ['number'], 'source 0')
      const source1 = createTestNode(graph, [], ['number'], 'source 1')
      source0.connect(0, target, 0)
      source1.connect(0, target, 1)
      const { node: wrapper } = graph.convertToSubgraph(
        new Set<Positionable>([source0, source1, target])
      )

      graph.unpackSubgraph(wrapper)

      const unpackedTarget = graph.nodes.find(
        (node) =>
          node.isSubgraphNode() && node.subgraph.id === targetDefinition.id
      )
      assert(unpackedTarget)
      const scope = graphScopeOf(graph)
      const firstLink = useLinkStore().getInputSlotLink(
        scope,
        unpackedTarget.id,
        0
      )
      const secondLink = useLinkStore().getInputSlotLink(
        scope,
        unpackedTarget.id,
        1
      )
      assert(firstLink && secondLink)
      expect(graph.getNodeById(firstLink.originNodeId)?.title).toBe('source 0')
      expect(graph.getNodeById(secondLink.originNodeId)?.title).toBe('source 1')
    })
    it('preserves duplicate-named links when an earlier connection removes an input', () => {
      const graph = createTestRootGraph()
      onTestFinished(enableSubgraphNodeCreation(graph))
      const target = createTestNode(graph, [], [], 'duplicate target')
      for (let index = 0; index < 4; index++) {
        target.addInput('duplicate', 'number')
      }
      const source0 = createTestNode(graph, [], ['number'], 'source 0')
      const source2 = createTestNode(graph, [], ['number'], 'source 2')
      const source3 = createTestNode(graph, [], ['number'], 'source 3')
      source0.connect(0, target, 0)
      source2.connect(0, target, 2)
      source3.connect(0, target, 3)
      const { node: wrapper } = graph.convertToSubgraph(
        new Set<Positionable>([source0, source2, source3, target])
      )
      const targetPrototype = Object.getPrototypeOf(target) as LGraphNode
      targetPrototype.onConnectionsChange = function (
        _type,
        slot,
        connected,
        link
      ) {
        if (connected && link && slot === 0 && this.inputs.length === 4) {
          this.removeInput(1)
        }
      }

      graph.unpackSubgraph(wrapper)

      const unpackedTarget = graph.nodes.find(
        (node) => node.title === 'duplicate target'
      )
      assert(unpackedTarget)
      expect(
        unpackedTarget.inputs.map((_, slot) => {
          const link = unpackedTarget.getInputLink(slot)
          return link ? graph.getNodeById(link.origin_id)?.title : undefined
        })
      ).toEqual(['source 0', 'source 2', 'source 3'])
    })
    it('reconnects nested subgraph inputs by name after dynamic slots shift', () => {
      const graph = createTestRootGraph()
      onTestFinished(enableSubgraphNodeCreation(graph))
      const seed = createTestNode(graph)
      const { subgraph: outer } = graph.convertToSubgraph(
        new Set<Positionable>([seed])
      )
      for (const name of ['input_0', 'input_1', 'input_2']) {
        outer.addInput(name, 'number')
      }
      const target = createTestNode(
        outer,
        ['number', 'number', 'number'],
        [],
        'nested dynamic target'
      )
      outer.inputNode.slots.forEach((input, index) =>
        input.connect(target.inputs[index], target)
      )

      const { subgraph: nested, node: nestedNode } = outer.convertToSubgraph(
        new Set<Positionable>([target])
      )
      const innerTarget = nested.nodes.find(
        (node) => node.title === 'nested dynamic target'
      )
      assert(innerTarget)
      const targetPrototype = Object.getPrototypeOf(innerTarget) as LGraphNode
      targetPrototype.onConnectionsChange = function (_type, slot, connected) {
        if (
          !connected ||
          slot !== 0 ||
          this.findInputSlot('inserted_dynamic_input') !== -1
        )
          return
        this.addInput('inserted_dynamic_input', 'number')
        const insertedInput = this.inputs.pop()
        assert(insertedInput)
        this.inputs.splice(1, 0, insertedInput)
      }

      outer.unpackSubgraph(nestedNode)

      const unpackedTarget = outer.nodes.find(
        (node) => node.title === 'nested dynamic target'
      )
      assert(unpackedTarget)
      expect(
        ['input_0', 'input_1', 'input_2'].map(
          (name) =>
            unpackedTarget.getInputLink(unpackedTarget.findInputSlot(name))
              ?.origin_slot
        )
      ).toEqual([0, 1, 2])
      expect(
        unpackedTarget.getInputLink(
          unpackedTarget.findInputSlot('inserted_dynamic_input')
        )
      ).toBeNull()
    })
    it('Should merge boundary links', () => {
      const subgraph = createTestSubgraph({
        inputs: [{ name: 'value', type: 'number' }],
        outputs: [{ name: 'value', type: 'number' }]
      })
      const subgraphNode = createTestSubgraphNode(subgraph)
      const graph = subgraphNode.graph!
      graph.add(subgraphNode)

      const innerNode1 = createTestNode(subgraph, [], ['number'])
      const innerNode2 = createTestNode(subgraph, ['number'], [])
      subgraph.inputNode.slots[0].connect(innerNode2.inputs[0], innerNode2)
      subgraph.outputNode.slots[0].connect(innerNode1.outputs[0], innerNode1)

      const outerNode1 = createTestNode(graph, [], ['number'])
      const outerNode2 = createTestNode(graph, ['number'])
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

      const inner = createTestNode(subgraph, [], ['number'])
      const innerLink = subgraph.outputNode.slots[0].connect(
        inner.outputs[0],
        inner
      )
      assert(innerLink)

      const outer = createTestNode(graph, ['number'])
      const outerLink = subgraphNode.connect(0, outer, 0)
      assert(outerLink)
      subgraph.add(new LGraphGroup())

      subgraph.createReroute([10, 10], innerLink)
      graph.createReroute([10, 10], outerLink)

      graph.unpackSubgraph(subgraphNode)

      expect(graph.reroutes.size).toBe(2)
      expect(graph.groups.length).toBe(1)
    })
    it('Should leave the graph untouched when a subgraph link is malformed', () => {
      const subgraph = createTestSubgraph()
      const subgraphNode = createTestSubgraphNode(subgraph)
      const graph = subgraphNode.graph!
      graph.add(subgraphNode)

      const innerNode1 = createTestNode(subgraph, [], ['number'])
      const innerNode2 = createTestNode(subgraph, ['number'], [])
      const innerLink = innerNode1.connect(0, innerNode2, 0)
      assert(innerLink)

      innerLink.target_id = toNodeId(9999)
      expectUnpackRejected(graph, subgraphNode)
    })
    it('Should leave the graph untouched when a subgraph link has an invalid origin slot', () => {
      const subgraph = createTestSubgraph()
      const subgraphNode = createTestSubgraphNode(subgraph)
      const graph = subgraphNode.graph!
      graph.add(subgraphNode)

      const innerNode1 = createTestNode(subgraph, [], ['number'])
      const innerNode2 = createTestNode(subgraph, ['number'], [])
      const innerLink = innerNode1.connect(0, innerNode2, 0)
      assert(innerLink)

      innerLink.origin_slot = 9999
      expectUnpackRejected(graph, subgraphNode)
    })
    it('Should leave the graph untouched when a subgraph link has an invalid target slot', () => {
      const subgraph = createTestSubgraph()
      const subgraphNode = createTestSubgraphNode(subgraph)
      const graph = subgraphNode.graph!
      graph.add(subgraphNode)

      const innerNode1 = createTestNode(subgraph, [], ['number'])
      const innerNode2 = createTestNode(subgraph, ['number'], [])
      const innerLink = innerNode1.connect(0, innerNode2, 0)
      assert(innerLink)

      innerLink.target_slot = 9999
      expectUnpackRejected(graph, subgraphNode)
    })
    it.for([9999, 0.5])(
      'Should leave the graph untouched when a subgraph input link has invalid boundary slot %s',
      (invalidSlot) => {
        const subgraph = createTestSubgraph({
          inputs: [{ name: 'value', type: 'number' }]
        })
        const subgraphNode = createTestSubgraphNode(subgraph)
        const graph = subgraphNode.graph!
        graph.add(subgraphNode)

        const innerNode = createTestNode(subgraph, ['number'])
        const innerLink = subgraph.inputNode.slots[0].connect(
          innerNode.inputs[0],
          innerNode
        )
        assert(innerLink)
        innerLink.origin_slot = invalidSlot
        expectUnpackRejected(graph, subgraphNode)
      }
    )
    it.for([9999, 0.5])(
      'Should leave the graph untouched when a subgraph output link has invalid boundary slot %s',
      (invalidSlot) => {
        const subgraph = createTestSubgraph({
          outputs: [{ name: 'value', type: 'number' }]
        })
        const subgraphNode = createTestSubgraphNode(subgraph)
        const graph = subgraphNode.graph!
        graph.add(subgraphNode)

        const innerNode = createTestNode(subgraph, [], ['number'])
        const innerLink = subgraph.outputNode.slots[0].connect(
          innerNode.outputs[0],
          innerNode
        )
        assert(innerLink)
        innerLink.target_slot = invalidSlot
        expectUnpackRejected(graph, subgraphNode)
      }
    )
    it('Should report success when unpacking an intact subgraph', () => {
      const subgraph = createTestSubgraph()
      const subgraphNode = createTestSubgraphNode(subgraph)
      const graph = subgraphNode.graph!
      graph.add(subgraphNode)

      const innerNode1 = createTestNode(subgraph, [], ['number'])
      const innerNode2 = createTestNode(subgraph, ['number'], [])
      assert(innerNode1.connect(0, innerNode2, 0))

      expect(graph.unpackSubgraph(subgraphNode)).toBe(true)
      expect(graph.getNodeById(subgraphNode.id)).toBeNull()
      expect(graph.nodes.length).toBe(2)
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

      const inner = createTestNode(subgraph, [], ['number', 'number'])
      const innerLink1 = subgraph.outputNode.slots[0].connect(
        inner.outputs[0],
        inner
      )
      const innerLink2 = subgraph.outputNode.slots[1].connect(
        inner.outputs[1],
        inner
      )
      const outer1 = createTestNode(graph, ['number'])
      const outer2 = createTestNode(graph, ['number'])
      const outer3 = createTestNode(graph, ['number'])
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

      const inner1 = createTestNode(subgraph, ['number', 'number'])
      const inner2 = createTestNode(subgraph, ['number'])
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
      const outer = createTestNode(graph, [], ['number'])
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
      function createPromotedWidgetSubgraph(interiorNodeCount = 1) {
        const subgraph = createTestSubgraph({
          inputs: [{ name: 'value', type: 'number' }]
        })
        const subgraphNode = createTestSubgraphNode(subgraph)
        const graph = subgraphNode.graph!
        graph.add(subgraphNode)

        for (let i = 0; i < interiorNodeCount; i++) {
          const inner = createTestWidgetNode(subgraph)
          inner.inputs[0].widget = { name: 'text_widget' }
          const widget = inner.getWidgetFromSlot(inner.inputs[0])
          assert(widget)
          widget.value = 'stale interior value'
          subgraph.inputNode.slots[0].connect(inner.inputs[0], inner)
        }

        const { widgetId } = subgraphNode.inputs[0]
        assert(widgetId)
        return { graph, subgraphNode, hostWidgetId: widgetId }
      }

      function readUnpackedWidgetValues(graph: LGraph) {
        return graph.nodes.map(
          (node) => node.getWidgetFromSlot(node.inputs[0])?.value
        )
      }

      it('Should not report a missing link for a promoted widget input', () => {
        const { graph, subgraphNode } = createPromotedWidgetSubgraph()
        const errorSpy = vi.spyOn(console, 'error').mockImplementation(() => {})

        graph.unpackSubgraph(subgraphNode)

        expect(errorSpy).not.toHaveBeenCalled()
      })

      it('Should report a missing host input and continue unpacking', () => {
        const { graph, subgraphNode } = createPromotedWidgetSubgraph()
        subgraphNode.removeInput(0)
        const errorSpy = vi.spyOn(console, 'error').mockImplementation(() => {})

        graph.unpackSubgraph(subgraphNode)

        expect(errorSpy).toHaveBeenCalledWith(
          'Missing host input when unpacking subgraph'
        )
        expect(graph.nodes.length).toBe(1)
      })

      it('Should not alias a later host input when an earlier input is missing', () => {
        const subgraph = createTestSubgraph({
          inputs: [
            { name: 'first', type: 'number' },
            { name: 'second', type: 'number' }
          ]
        })
        const subgraphNode = createTestSubgraphNode(subgraph)
        const graph = subgraphNode.graph!
        graph.add(subgraphNode)

        for (let slot = 0; slot < 2; slot++) {
          const inner = createTestWidgetNode(subgraph)
          inner.inputs[0].widget = { name: 'text_widget' }
          const widget = inner.getWidgetFromSlot(inner.inputs[0])
          assert(widget)
          widget.value = `interior ${slot}`
          subgraph.inputNode.slots[slot].connect(inner.inputs[0], inner)
        }

        const secondWidgetId = subgraphNode.inputs[1].widgetId
        assert(secondWidgetId)
        useWidgetValueStore().setValue(secondWidgetId, 'second host')
        subgraphNode.removeInput(0)
        const errorSpy = vi.spyOn(console, 'error').mockImplementation(() => {})

        graph.unpackSubgraph(subgraphNode)

        expect(errorSpy).toHaveBeenCalledTimes(1)
        expect(readUnpackedWidgetValues(graph)).toEqual([
          'interior 0',
          'second host'
        ])
      })

      it('Should hand the promoted host value to the interior widget', () => {
        const { graph, subgraphNode, hostWidgetId } =
          createPromotedWidgetSubgraph()
        useWidgetValueStore().setValue(hostWidgetId, 'host edit')

        graph.unpackSubgraph(subgraphNode)

        expect(readUnpackedWidgetValues(graph)).toEqual(['host edit'])
      })

      it('Should leave the interior value alone when the host has no value', () => {
        const { graph, subgraphNode } = createPromotedWidgetSubgraph()

        graph.unpackSubgraph(subgraphNode)

        expect(readUnpackedWidgetValues(graph)).toEqual([
          'stale interior value'
        ])
      })

      it('Should hand the promoted host value to every interior widget it feeds', () => {
        const { graph, subgraphNode, hostWidgetId } =
          createPromotedWidgetSubgraph(2)
        useWidgetValueStore().setValue(hostWidgetId, 'host edit')

        graph.unpackSubgraph(subgraphNode)

        expect(readUnpackedWidgetValues(graph)).toEqual([
          'host edit',
          'host edit'
        ])
      })

      it('Should not report a missing link for an unconnected plain input', () => {
        const subgraph = createTestSubgraph({
          inputs: [{ name: 'value', type: 'number' }]
        })
        const subgraphNode = createTestSubgraphNode(subgraph)
        const graph = subgraphNode.graph!
        graph.add(subgraphNode)

        const inner = createTestNode(subgraph, ['number'])
        subgraph.inputNode.slots[0].connect(inner.inputs[0], inner)
        const errorSpy = vi.spyOn(console, 'error').mockImplementation(() => {})

        graph.unpackSubgraph(subgraphNode)

        expect(errorSpy).not.toHaveBeenCalled()
        expect(graph.nodes.length).toBe(1)
      })
    })

    it('Should truncate cyclic reroute chains instead of aborting unpack', () => {
      const subgraph = createTestSubgraph({
        outputs: [{ name: 'value', type: 'number' }]
      })
      const subgraphNode = createTestSubgraphNode(subgraph)
      const graph = subgraphNode.graph!
      graph.add(subgraphNode)

      const inner = createTestNode(subgraph, [], ['number'])
      const innerLink = subgraph.outputNode.slots[0].connect(
        inner.outputs[0],
        inner
      )
      assert(innerLink)
      const outer = createTestNode(graph, ['number'])
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

      const inner = createTestNode(subgraph, [], ['number'])
      const innerLink = subgraph.outputNode.slots[0].connect(
        inner.outputs[0],
        inner
      )
      assert(innerLink)
      const outer = createTestNode(graph, ['number'])
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
