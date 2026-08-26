import { createTestingPinia } from '@pinia/testing'
import { setActivePinia } from 'pinia'
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
import { LGraphGroup } from '@/lib/litegraph/src/litegraph'
import type { Positionable } from '@/lib/litegraph/src/litegraph'
import {
  createTestNode,
  createTestWidgetNode
} from '@/lib/litegraph/src/__fixtures__/nodeHelpers'
import { useLinkStore } from '@/stores/linkStore'
import { useRerouteStore } from '@/stores/rerouteStore'
import { graphScopeOf } from '@/types/graphScopeId'
import { toRerouteId } from '@/types/rerouteId'

import {
  createTestRootGraph,
  createTestSubgraph,
  createTestSubgraphNode,
  enableSubgraphNodeCreation,
  resetSubgraphFixtureState
} from './__fixtures__/subgraphHelpers'

beforeEach(() => {
  setActivePinia(createTestingPinia({ stubActions: false }))
  resetSubgraphFixtureState()
})

describe('SubgraphConversion', () => {
  it('returns empty-selection without mutating the graph', () => {
    const rootGraph = createTestRootGraph()
    const before = rootGraph.serialize()
    const beforeChange = vi.spyOn(rootGraph, 'beforeChange')

    expect(rootGraph.convertToSubgraph(new Set())).toEqual({
      kind: 'empty-selection'
    })
    expect(beforeChange).not.toHaveBeenCalled()
    expect(rootGraph.serialize()).toEqual(before)
  })

  it('returns the converted subgraph and node on success', () => {
    const rootGraph = createTestRootGraph()
    onTestFinished(enableSubgraphNodeCreation(rootGraph))
    const source = createTestNode(rootGraph)

    const result = rootGraph.convertToSubgraph(new Set([source]))

    assert(result.kind === 'success')
    expect(result.value.subgraph).toBe(
      rootGraph.subgraphs.values().next().value
    )
    expect(result.value.node.subgraph).toBe(result.value.subgraph)
  })

  describe('Convert to Subgraph store integrity', () => {
    it('keeps interior and boundary-derived input links registered in the link store', () => {
      const rootGraph = createTestRootGraph()
      onTestFinished(enableSubgraphNodeCreation(rootGraph))

      const exterior = createTestNode(rootGraph, [], ['number'])
      const origin = createTestNode(rootGraph, ['number'], ['number'])
      const target = createTestNode(rootGraph, ['number'])
      exterior.connect(0, origin, 0)
      origin.connect(0, target, 0)

      const result = rootGraph.convertToSubgraph(
        new Set<Positionable>([target, origin])
      )
      assert(result.kind === 'success')
      const { subgraph, node: subgraphNode } = result.value

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

      const result = rootGraph.convertToSubgraph(
        new Set<Positionable>([target, origin, reroute])
      )
      assert(result.kind === 'success')
      const { subgraph } = result.value

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

      const result = subgraph.convertToSubgraph(new Set<Positionable>([origin]))
      assert(result.kind === 'success')
      const { node: subgraphNode } = result.value

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

      const result = rootGraph.convertToSubgraph(
        new Set<Positionable>([target, origin])
      )
      assert(result.kind === 'success')
      const { subgraph } = result.value

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
