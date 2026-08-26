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
import { computed } from 'vue'

import {
  LGraph,
  LGraphNode,
  LiteGraph,
  Reroute
} from '@/lib/litegraph/src/litegraph'
import { enableSubgraphNodeCreation } from '@/lib/litegraph/src/subgraph/__fixtures__/subgraphHelpers'
import type { SerialisableGraph } from '@/lib/litegraph/src/types/serialisation'
import { layoutStore } from '@/renderer/core/layout/store/layoutStore'
import { LayoutSource } from '@/renderer/core/layout/types'
import { useRerouteStore } from '@/stores/rerouteStore'
import { graphScopeOf } from '@/types/graphScopeId'
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

    const reroute = graph.createReroute([10, 10], link)
    assert(reroute)
    expect(store.getReroute(graphScopeOf(graph), reroute.id)?.id).toBe(
      reroute.id
    )

    graph.removeReroute(reroute.id)
    expect(store.getReroute(graphScopeOf(graph), reroute.id)).toBeUndefined()
  })

  it('does not add a reroute when its id is already registered', () => {
    const graph = new LGraph()
    const incumbent = new Reroute(toRerouteId(1), graph, [0, 0])
    vi.spyOn(console, 'error').mockImplementation(() => {})
    useRerouteStore().registerReroute(graphScopeOf(graph), incumbent._chain)
    layoutStore.applyOperation({
      type: 'createReroute',
      graphId: graph.rootGraph.id,
      rerouteId: incumbent.id,
      position: { x: 0, y: 0 },
      timestamp: Date.now(),
      source: LayoutSource.Canvas
    })

    const collision = new Reroute(incumbent.id, graph, [10, 10])

    expect(graph._addReroute(collision)).toBe(false)
    expect(graph.reroutes.has(incumbent.id)).toBe(false)
    collision.pos = [20, 30]
    expect(
      layoutStore.getRerouteLayout(graph.rootGraph.id, incumbent.id)?.position
    ).toEqual({ x: 0, y: 0 })
  })

  it('setReroute creates and updates geometry in one layout write', () => {
    const { graph } = connectedGraph()
    const store = useRerouteStore()
    const applyOperation = vi.spyOn(layoutStore, 'applyOperation')
    onTestFinished(() => applyOperation.mockRestore())

    const reroute = graph.setReroute({
      id: toRerouteId(3),
      parentId: undefined,
      pos: [5, 5],
      linkIds: []
    })
    assert(reroute)

    expect(store.getReroute(graphScopeOf(graph), reroute.id)?.id).toBe(3)
    const creationOperations = applyOperation.mock.calls.filter(
      ([operation]) => operation.type === 'createReroute'
    )
    expect(creationOperations).toHaveLength(1)
    expect(creationOperations[0][0]).toMatchObject({
      type: 'createReroute',
      rerouteId: toRerouteId(3),
      position: { x: 5, y: 5 }
    })

    applyOperation.mockClear()
    const existing = graph.setReroute({
      id: reroute.id,
      parentId: undefined,
      pos: [8, 9],
      linkIds: []
    })
    assert(existing)

    expect(existing).toBe(reroute)
    expect(existing.pos).toEqual([8, 9])
    const updateOperations = applyOperation.mock.calls.filter(
      ([operation]) => operation.type === 'moveReroute'
    )
    expect(updateOperations).toHaveLength(1)
    expect(updateOperations[0][0]).toMatchObject({
      type: 'moveReroute',
      rerouteId: reroute.id,
      position: { x: 8, y: 9 }
    })
  })

  it('class parentId writes are observable through the store query', () => {
    const { graph, link } = connectedGraph()
    const store = useRerouteStore()

    const first = graph.createReroute([10, 10], link)
    assert(first)
    const second = graph.createReroute([20, 20], first)
    assert(second)

    const parentId = computed(
      () => store.getReroute(graphScopeOf(graph), first.id)?.parentId
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
    assert(reroute)
    link.parentId = reroute.id

    link.disconnect(graph)

    expect(graph.reroutes.size).toBe(0)
    expect(store.getReroute(graphScopeOf(graph), reroute.id)).toBeUndefined()
  })

  it('clear() removes the graph’s chains from the store', () => {
    const { graph, link } = connectedGraph()
    const store = useRerouteStore()
    const reroute = graph.createReroute([10, 10], link)
    assert(reroute)
    const graphScope = graphScopeOf(graph)

    graph.clear()

    expect(store.getReroute(graphScope, reroute.id)).toBeUndefined()
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
      expect(store.getReroute(graphScopeOf(sg), reroute.id)?.id).toBe(
        reroute.id
      )
      const [link] = [...sg.links.values()]
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
    assert(reroute)

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
    assert(first)
    const second = graph.setReroute({
      id: toRerouteId(2),
      parentId: undefined,
      pos: [20, 20],
      linkIds: []
    })
    assert(second)

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
    assert(a)
    const b = graph.setReroute({
      id: toRerouteId(2),
      parentId: a.id,
      pos: [0, 0],
      linkIds: []
    })
    assert(b)
    const c = graph.setReroute({
      id: toRerouteId(3),
      parentId: b.id,
      pos: [0, 0],
      linkIds: []
    })
    assert(c)

    a.parentId = c.id

    expect(a.parentId).toBeUndefined()
    expect(c.getReroutes()).not.toBeNull()
  })

  it('snapToGrid mirrors the snapped position into the layout store', () => {
    const { graph, link } = connectedGraph()
    const reroute = graph.createReroute([12, 17], link)
    assert(reroute)

    expect(reroute.snapToGrid(10)).toBe(true)

    // Y snaps around a NODE_SLOT_HEIGHT * 0.7 offset, so 17 lands on 14.
    expect(
      layoutStore.getRerouteLayout(graph.rootGraph.id, reroute.id)?.position
    ).toEqual({
      x: 10,
      y: 14
    })
  })

  it('snapToGrid does not report or store a change when already aligned', () => {
    const { graph, link } = connectedGraph()
    const reroute = graph.createReroute([12, 17], link)
    assert(reroute)
    reroute.snapToGrid(10)
    const applyOperation = vi.spyOn(layoutStore, 'applyOperation')
    onTestFinished(() => applyOperation.mockRestore())

    expect(reroute.snapToGrid(10)).toBe(false)
    expect(applyOperation).not.toHaveBeenCalled()
  })

  it('refuses parentId writes that would create a cycle, allows repair', () => {
    const { graph, link } = connectedGraph()
    const first = graph.createReroute([10, 10], link)
    assert(first)
    const second = graph.createReroute([20, 20], first)
    assert(second)
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
    const reroute = graph.createReroute([10, 10], link)
    assert(reroute)

    onTestFinished(enableSubgraphNodeCreation(graph))

    const result = graph.convertToSubgraph(new Set([a, b, reroute]))
    assert(result.kind === 'success')
    const { subgraph } = result.value

    expect(graph.reroutes.size).toBe(0)
    const converted = subgraph.reroutes.get(reroute.id)
    expect(converted).toBeDefined()

    const [innerLink] = [...subgraph.links.values()]
    expect(innerLink.parentId).toBe(reroute.id)
    expect(store.getReroute(graphScopeOf(subgraph), reroute.id)).toBeDefined()

    subgraph.removeReroute(reroute.id)
    expect(store.getReroute(graphScopeOf(subgraph), reroute.id)).toBeUndefined()
  })

  it('floating marker survives through the store state', () => {
    const { graph, a, link } = connectedGraph()
    const store = useRerouteStore()
    const reroute = graph.createReroute([10, 10], link)
    assert(reroute)

    a.disconnectOutput(0)

    expect(reroute.floating).toEqual({ slotType: 'input' })
    expect(store.getReroute(graphScopeOf(graph), reroute.id)?.floating).toEqual(
      {
        slotType: 'input'
      }
    )
  })
})

describe('Reroute position lives only in layoutStore', () => {
  beforeEach(() => setActivePinia(createTestingPinia({ stubActions: false })))

  it('registers geometry after graph ownership', () => {
    const { graph, link } = connectedGraph()

    const reroute = graph.createReroute([37, 41], link)
    assert(reroute)

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
    assert(first)
    const second = secondGraph.setReroute({
      id: rerouteId,
      pos: [100, 200],
      linkIds: []
    })
    assert(second)

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
    const reroute = graph.createReroute([10, 10], link)
    assert(reroute)
    const pos = reroute.pos

    // Move it in the store only. A mirrored copy on the class could not see
    // this without a synchronisation step.
    layoutStore.applyOperation({
      type: 'moveReroute',
      graphId: graph.rootGraph.id,
      rerouteId: reroute.id,
      position: { x: 300, y: 400 },
      timestamp: Date.now(),
      source: LayoutSource.Canvas
    })

    expect([...reroute.pos]).toEqual([300, 400])
    expect(reroute.pos).toBe(pos)
    expect([...pos]).toEqual([300, 400])
    expect(reroute.boundingRect[0]).toBe(300 - Reroute.radius)
  })

  it('keeps canonical position after removal', () => {
    const { graph, link } = connectedGraph()
    const reroute = graph.createReroute([10, 10], link)
    assert(reroute)
    layoutStore.applyOperation({
      type: 'moveReroute',
      graphId: graph.rootGraph.id,
      rerouteId: reroute.id,
      position: { x: 300, y: 400 },
      timestamp: Date.now(),
      source: LayoutSource.Canvas
    })

    graph.removeReroute(reroute.id)

    expect([...reroute.pos]).toEqual([300, 400])
  })

  it('writes indexed and method mutations through to the store', () => {
    const { graph, link } = connectedGraph()
    const reroute = graph.createReroute([10, 20], link)
    assert(reroute)

    reroute.pos[0] = 30
    const pos = reroute.pos
    pos.fill(40)
    pos[1] = 50

    expect(
      layoutStore.getRerouteLayout(graph.rootGraph.id, reroute.id)?.position
    ).toEqual({ x: 40, y: 50 })
  })

  it('rejects mutations that change the position length', () => {
    const { graph, link } = connectedGraph()
    const reroute = graph.createReroute([10, 20], link)
    assert(reroute)
    const pos = reroute.pos

    pos.pop()
    pos.push(30)

    expect(pos).toHaveLength(2)
    expect([...pos]).toEqual([10, 20])
    expect(
      layoutStore.getRerouteLayout(graph.rootGraph.id, reroute.id)?.position
    ).toEqual({ x: 10, y: 20 })
  })

  it('routes move and snapToGrid through the same stored point', () => {
    const { graph, link } = connectedGraph()
    const reroute = graph.createReroute([10, 10], link)
    assert(reroute)

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
