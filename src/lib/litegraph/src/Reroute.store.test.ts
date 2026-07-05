import { createTestingPinia } from '@pinia/testing'
import { setActivePinia } from 'pinia'
import { beforeEach, describe, expect, it } from 'vitest'
import { computed } from 'vue'

import { LGraph, LGraphNode, LiteGraph } from '@/lib/litegraph/src/litegraph'
import type { SerialisableGraph } from '@/lib/litegraph/src/types/serialisation'
import { useRerouteStore } from '@/stores/rerouteStore'
import { toRerouteId } from '@/types/rerouteId'

import { duplicateSubgraphNodeIds } from './__fixtures__/duplicateSubgraphNodeIds'

function connectedGraph() {
  const graph = new LGraph()
  const a = new LGraphNode('A')
  const b = new LGraphNode('B')
  a.addOutput('out', 'INT')
  b.addInput('in', 'INT')
  graph.add(a)
  graph.add(b)
  const link = a.connect(0, b, 0)!
  return { graph, a, b, link }
}

describe('Reroute ↔ rerouteStore integration', () => {
  beforeEach(() => setActivePinia(createTestingPinia({ stubActions: false })))

  it('createReroute registers the chain, removeReroute unregisters it', () => {
    const { graph, link } = connectedGraph()
    const store = useRerouteStore()

    const reroute = graph.createReroute([10, 10], link)!
    expect(store.getReroute(graph.rootGraph.id, reroute.id)?.id).toBe(
      reroute.id
    )

    graph.removeReroute(reroute.id)
    expect(store.getReroute(graph.rootGraph.id, reroute.id)).toBeUndefined()
  })

  it('setReroute (deserialisation) registers the chain', () => {
    const { graph } = connectedGraph()
    const store = useRerouteStore()

    const reroute = graph.setReroute({
      id: toRerouteId(3),
      parentId: undefined,
      pos: [5, 5],
      linkIds: []
    })

    expect(store.getReroute(graph.rootGraph.id, reroute.id)?.id).toBe(3)
  })

  it('class parentId writes are observable through the store query', () => {
    const { graph, link } = connectedGraph()
    const store = useRerouteStore()

    const first = graph.createReroute([10, 10], link)!
    const second = graph.createReroute([20, 20], first)!

    const parentId = computed(
      () => store.getReroute(graph.rootGraph.id, first.id)?.parentId
    )
    expect(parentId.value).toBe(second.id)

    first.parentId = undefined

    expect(parentId.value).toBeUndefined()
  })

  it('disconnect pruning an empty reroute unregisters it', () => {
    const { graph, link } = connectedGraph()
    const store = useRerouteStore()
    const reroute = graph.setReroute({
      id: toRerouteId(1),
      parentId: undefined,
      pos: [10, 10],
      linkIds: [link.id]
    })
    link.parentId = reroute.id

    link.disconnect(graph)

    expect(graph.reroutes.size).toBe(0)
    expect(store.getReroute(graph.rootGraph.id, reroute.id)).toBeUndefined()
  })

  it('clear() removes the graph’s chains from the store', () => {
    const { graph, link } = connectedGraph()
    const store = useRerouteStore()
    const reroute = graph.createReroute([10, 10], link)!
    const graphId = graph.rootGraph.id

    graph.clear()

    expect(store.getReroute(graphId, reroute.id)).toBeUndefined()
  })

  it('deduplicates colliding subgraph reroute ids into one root bucket', () => {
    LiteGraph.registerNodeType('dummy', LGraphNode)
    const data = structuredClone(
      duplicateSubgraphNodeIds
    ) as unknown as SerialisableGraph
    const [a, b] = data.definitions!.subgraphs!
    a.reroutes = [{ id: 1, pos: [0, 0], linkIds: [1] }]
    a.links![0].parentId = toRerouteId(1)
    b.reroutes = [{ id: 1, pos: [0, 0], linkIds: [2] }]
    b.links![0].parentId = toRerouteId(1)

    const graph = new LGraph(data)

    const store = useRerouteStore()
    const subgraphs = [...graph.subgraphs.values()]
    const rerouteIds = subgraphs.map((sg) => [...sg.reroutes.keys()][0])
    expect(new Set(rerouteIds).size).toBe(2)

    for (const sg of subgraphs) {
      const [reroute] = [...sg.reroutes.values()]
      expect(store.getReroute(graph.rootGraph.id, reroute.id)?.id).toBe(
        reroute.id
      )
      const [link] = [...sg._links.values()]
      expect(link.parentId).toBe(reroute.id)
    }
  })

  it('floating marker survives through the store state', () => {
    const { graph, a, link } = connectedGraph()
    const store = useRerouteStore()
    const reroute = graph.createReroute([10, 10], link)!

    a.disconnectOutput(0)

    expect(reroute.floating).toEqual({ slotType: 'input' })
    expect(store.getReroute(graph.rootGraph.id, reroute.id)?.floating).toEqual({
      slotType: 'input'
    })
  })
})
