import { createTestingPinia } from '@pinia/testing'
import { setActivePinia } from 'pinia'
import { beforeEach, describe, expect, it, onTestFinished } from 'vitest'
import { computed } from 'vue'

import {
  LGraph,
  LGraphNode,
  LiteGraph,
  Reroute
} from '@/lib/litegraph/src/litegraph'
import { enableSubgraphNodeCreation } from '@/lib/litegraph/src/subgraph/__fixtures__/subgraphHelpers'
import type { SerialisableGraph } from '@/lib/litegraph/src/types/serialisation'
import { useLayoutMutations } from '@/renderer/core/layout/operations/layoutMutations'
import { layoutStore } from '@/renderer/core/layout/store/layoutStore'
import { useRerouteStore } from '@/stores/rerouteStore'
import { toRerouteId } from '@/types/rerouteId'
import { createUuidv4 } from '@/utils/uuid'

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

  it('linkIds follows the chain without manual set maintenance', () => {
    const { graph, link } = connectedGraph()
    const reroute = graph.setReroute({
      id: toRerouteId(1),
      parentId: undefined,
      pos: [10, 10],
      linkIds: []
    })

    link.parentId = reroute.id

    expect([...reroute.linkIds]).toEqual([link.id])

    link.parentId = undefined

    expect(reroute.linkIds.size).toBe(0)
  })

  it('parentId setter rejects a mutual-parent cycle', () => {
    const { graph } = connectedGraph()
    const first = graph.setReroute({
      id: toRerouteId(1),
      parentId: undefined,
      pos: [10, 10],
      linkIds: []
    })
    const second = graph.setReroute({
      id: toRerouteId(2),
      parentId: undefined,
      pos: [20, 20],
      linkIds: []
    })

    first.parentId = second.id
    second.parentId = first.id

    expect(second.parentId).toBeUndefined()
    expect(first.getReroutes()).not.toBeNull()
  })

  it('parentId setter rejects extending a chain back onto its root', () => {
    const { graph } = connectedGraph()
    const a = graph.setReroute({
      id: toRerouteId(1),
      parentId: undefined,
      pos: [0, 0],
      linkIds: []
    })
    const b = graph.setReroute({
      id: toRerouteId(2),
      parentId: a.id,
      pos: [0, 0],
      linkIds: []
    })
    const c = graph.setReroute({
      id: toRerouteId(3),
      parentId: b.id,
      pos: [0, 0],
      linkIds: []
    })

    a.parentId = c.id

    expect(a.parentId).toBeUndefined()
    expect(c.getReroutes()).not.toBeNull()
  })

  it('snapToGrid mirrors the snapped position into the layout store', () => {
    const { graph, link } = connectedGraph()
    const reroute = graph.createReroute([12, 17], link)!

    reroute.snapToGrid(10)

    expect(
      layoutStore.getRerouteLayout(graph.rootGraph.id, reroute.id)?.position
    ).toEqual({
      x: reroute.pos[0],
      y: reroute.pos[1]
    })
  })

  it('refuses parentId writes that would create a cycle, allows repair', () => {
    const { graph, link } = connectedGraph()
    const first = graph.createReroute([10, 10], link)!
    const second = graph.createReroute([20, 20], first)!
    expect(first.parentId).toBe(second.id)

    second.parentId = first.id

    expect(second.parentId).toBeUndefined()

    second._chain.parentId = first.id
    second.parentId = undefined

    expect(second.parentId).toBeUndefined()
  })

  it('convertToSubgraph hands reroute registrations to the subgraph', () => {
    const { graph, a, b, link } = connectedGraph()
    const store = useRerouteStore()
    const reroute = graph.createReroute([10, 10], link)!
    const graphId = graph.rootGraph.id

    onTestFinished(enableSubgraphNodeCreation(graph))

    const { subgraph } = graph.convertToSubgraph(new Set([a, b, reroute]))

    expect(graph.reroutes.size).toBe(0)
    const converted = subgraph.reroutes.get(reroute.id)
    expect(converted).toBeDefined()

    const [innerLink] = [...subgraph._links.values()]
    expect(innerLink.parentId).toBe(reroute.id)
    expect(store.getReroute(graphId, reroute.id)).toBeDefined()

    subgraph.removeReroute(reroute.id)
    expect(store.getReroute(graphId, reroute.id)).toBeUndefined()
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

describe('Reroute position lives only in layoutStore', () => {
  beforeEach(() => setActivePinia(createTestingPinia({ stubActions: false })))

  it('registers geometry on construction, before any graph wiring', () => {
    const { graph, link } = connectedGraph()

    const reroute = graph.createReroute([37, 41], link)!

    expect(
      layoutStore.getRerouteLayout(graph.rootGraph.id, reroute.id)?.position
    ).toEqual({
      x: 37,
      y: 41
    })
  })

  it('isolates colliding reroute IDs across live root graphs', () => {
    const firstGraph = new LGraph()
    const secondGraph = new LGraph()
    firstGraph.id = createUuidv4()
    secondGraph.id = createUuidv4()
    const rerouteId = toRerouteId(12)
    const first = firstGraph.setReroute({
      id: rerouteId,
      pos: [10, 20],
      linkIds: []
    })
    const second = secondGraph.setReroute({
      id: rerouteId,
      pos: [100, 200],
      linkIds: []
    })

    first.pos = [30, 40]
    expect(
      layoutStore.getRerouteLayout(firstGraph.id, rerouteId)?.position
    ).toEqual({ x: 30, y: 40 })
    expect(
      layoutStore.getRerouteLayout(secondGraph.id, rerouteId)?.position
    ).toEqual({ x: 100, y: 200 })

    firstGraph.removeReroute(rerouteId)
    expect(layoutStore.getRerouteLayout(firstGraph.id, rerouteId)).toBeNull()
    expect([...second.pos]).toEqual([100, 200])

    firstGraph.clear()
    expect(
      layoutStore.getRerouteLayout(secondGraph.id, rerouteId)
    ).not.toBeNull()
  })

  it('reads a store write back through pos, with no class-side copy', () => {
    const { graph, link } = connectedGraph()
    const reroute = graph.createReroute([10, 10], link)!

    // Move it in the store only. A mirrored copy on the class could not see
    // this without a synchronisation step.
    useLayoutMutations().moveReroute(graph.rootGraph.id, reroute.id, {
      x: 300,
      y: 400
    })

    expect([...reroute.pos]).toEqual([300, 400])
    expect(reroute.boundingRect[0]).toBe(300 - Reroute.radius)
  })

  it('routes move and snapToGrid through the same stored point', () => {
    const { graph, link } = connectedGraph()
    const reroute = graph.createReroute([10, 10], link)!

    reroute.move(5, 7)
    expect(
      layoutStore.getRerouteLayout(graph.rootGraph.id, reroute.id)?.position
    ).toEqual({
      x: 15,
      y: 17
    })

    // y snaps about an offset of NODE_SLOT_HEIGHT * 0.7, so it lands on 14.
    reroute.snapToGrid(10)
    expect(
      layoutStore.getRerouteLayout(graph.rootGraph.id, reroute.id)?.position
    ).toEqual({
      x: 20,
      y: 14
    })
    expect([...reroute.pos]).toEqual([20, 14])
  })
})
