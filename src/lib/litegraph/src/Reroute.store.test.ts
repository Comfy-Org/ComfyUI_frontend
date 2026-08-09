import { createTestingPinia } from '@pinia/testing'
import { setActivePinia } from 'pinia'
import { beforeEach, describe, expect, it, onTestFinished, vi } from 'vitest'
import { computed } from 'vue'
import * as Y from 'yjs'

import {
  LGraph,
  LGraphNode,
  LiteGraph,
  Reroute
} from '@/lib/litegraph/src/litegraph'
import {
  createTestSubgraph,
  enableSubgraphNodeCreation
} from '@/lib/litegraph/src/subgraph/__fixtures__/subgraphHelpers'
import type { SerialisableGraph } from '@/lib/litegraph/src/types/serialisation'
import {
  attachLayout,
  detachLayout
} from '@/renderer/core/layout/operations/graphLayoutRegistration'
import { layoutStore } from '@/renderer/core/layout/store/layoutStore'
import { LayoutSource } from '@/renderer/core/layout/types'
import { getLayoutStoreYDoc } from '@/renderer/core/layout/store/layoutStoreTestUtils'
import { useRerouteStore } from '@/stores/rerouteStore'
import {
  graphScopeOf,
  toOwningGraphId,
  toRootGraphId
} from '@/types/graphScopeId'
import { toRerouteId } from '@/types/rerouteId'
import { createUuidv4, zeroUuid } from '@/utils/uuid'

import { duplicateSubgraphNodeIds } from './__fixtures__/duplicateSubgraphNodeIds'

function connectedGraph() {
  const graph = new LGraph()
  graph.id = createUuidv4()
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
  beforeEach(() => {
    setActivePinia(createTestingPinia({ stubActions: false }))
    layoutStore.resetForTests()
  })

  it('createReroute registers the chain, removeReroute unregisters it', () => {
    const { graph, link } = connectedGraph()
    const store = useRerouteStore()

    const reroute = graph.createReroute([10, 10], link)!
    expect(store.getReroute(graphScopeOf(graph), reroute.id)?.id).toBe(
      reroute.id
    )

    graph.removeReroute(reroute.id)
    expect(store.getReroute(graphScopeOf(graph), reroute.id)).toBeUndefined()
  })

  it('setReroute creates and updates stored geometry', () => {
    const { graph } = connectedGraph()
    const store = useRerouteStore()

    const reroute = graph.setReroute({
      id: toRerouteId(3),
      parentId: undefined,
      pos: [5, 5],
      linkIds: []
    })

    expect(store.getReroute(graphScopeOf(graph), reroute.id)?.id).toBe(3)
    expect(
      layoutStore.getRerouteLayout(graph.rootGraph.id, reroute.id)?.position
    ).toEqual({ x: 5, y: 5 })

    const existing = graph.setReroute({
      id: reroute.id,
      parentId: undefined,
      pos: [8, 9],
      linkIds: []
    })

    expect(existing).toBe(reroute)
    expect(existing.pos).toEqual([8, 9])
    expect(
      layoutStore.getRerouteLayout(graph.rootGraph.id, reroute.id)?.position
    ).toEqual({ x: 8, y: 9 })
  })

  it('class parentId writes are observable through the store query', () => {
    const { graph, link } = connectedGraph()
    const store = useRerouteStore()

    const first = graph.createReroute([10, 10], link)!
    const second = graph.createReroute([20, 20], first)!

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
    link.parentId = reroute.id

    link.disconnect(graph)

    expect(graph.reroutes.size).toBe(0)
    expect(store.getReroute(graphScopeOf(graph), reroute.id)).toBeUndefined()
    expect(
      layoutStore.getRerouteLayout(graph.rootGraph.id, reroute.id)
    ).toBeNull()
  })

  it('clear() removes the graph’s chains from the store', () => {
    const { graph, link } = connectedGraph()
    const store = useRerouteStore()
    const reroute = graph.createReroute([10, 10], link)!
    const scope = graphScopeOf(graph)
    graph.clear()

    expect(store.getReroute(scope, reroute.id)).toBeUndefined()
  })

  it('clear() removes stale components without an entity shell', () => {
    const graph = new LGraph()
    const graphId = graph.id
    const scope = graphScopeOf(graph)
    const rerouteId = toRerouteId(99)
    const store = useRerouteStore()
    store.registerReroute(scope, { id: rerouteId })
    layoutStore.applyOperation({
      actor: 'remote',
      entity: 'reroute',
      graphId,
      position: { x: 10, y: 20 },
      rerouteId,
      source: LayoutSource.External,
      timestamp: Date.now(),
      type: 'createReroute'
    })

    graph.clear()

    expect(store.getReroute(scope, rerouteId)).toBeUndefined()
    expect(layoutStore.getRerouteLayout(graphId, rerouteId)).toBeNull()
  })

  it('replacement configure clears stale components from the old root', () => {
    const graph = new LGraph()
    const graphId = graph.id
    const scope = graphScopeOf(graph)
    const rerouteId = toRerouteId(99)
    const store = useRerouteStore()
    store.registerReroute(scope, { id: rerouteId })
    layoutStore.applyOperation({
      actor: 'remote',
      entity: 'reroute',
      graphId,
      position: { x: 10, y: 20 },
      rerouteId,
      source: LayoutSource.External,
      timestamp: Date.now(),
      type: 'createReroute'
    })
    const data = graph.asSerialisable()
    data.id = createUuidv4()

    graph.configure(data)

    expect(store.getReroute(scope, rerouteId)).toBeUndefined()
    expect(layoutStore.getRerouteLayout(graphId, rerouteId)).toBeNull()
  })

  it('registers unique subgraph reroute ids in one root bucket', () => {
    LiteGraph.registerNodeType('dummy', LGraphNode)
    const data = structuredClone(
      duplicateSubgraphNodeIds
    ) as unknown as SerialisableGraph
    const [a, b] = data.definitions!.subgraphs!
    a.reroutes = [{ id: 1, pos: [0, 0], linkIds: [1] }]
    a.links![0].parentId = toRerouteId(1)
    b.reroutes = [{ id: 2, pos: [0, 0], linkIds: [2] }]
    b.links![0].parentId = toRerouteId(2)

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
      const [link] = [...sg._links.values()]
      expect(link.parentId).toBe(reroute.id)
    }

    graph.configure(data)

    expect(
      [...graph.subgraphs.values()].map(
        (subgraph) => [...subgraph.reroutes.keys()][0]
      )
    ).toEqual([toRerouteId(1), toRerouteId(2)])
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
    const reroute = graph.createReroute([12, 17], link)!
    reroute.snapToGrid(10)
    const storedPosition = layoutStore.getRerouteLayout(
      graph.rootGraph.id,
      reroute.id
    )?.position

    expect(reroute.snapToGrid(10)).toBe(false)
    expect(
      layoutStore.getRerouteLayout(graph.rootGraph.id, reroute.id)?.position
    ).toEqual(storedPosition)
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
    onTestFinished(enableSubgraphNodeCreation(graph))

    const { subgraph } = graph.convertToSubgraph(new Set([a, b, reroute]))

    expect(graph.reroutes.size).toBe(0)
    const converted = subgraph.reroutes.get(reroute.id)
    expect(converted).toBeDefined()

    const [innerLink] = [...subgraph._links.values()]
    expect(innerLink.parentId).toBe(reroute.id)
    expect(store.getReroute(graphScopeOf(subgraph), reroute.id)).toBeDefined()

    subgraph.removeReroute(reroute.id)
    expect(store.getReroute(graphScopeOf(subgraph), reroute.id)).toBeUndefined()
  })

  it('floating marker survives through the store state', () => {
    const { graph, a, link } = connectedGraph()
    const store = useRerouteStore()
    const reroute = graph.createReroute([10, 10], link)!

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
  beforeEach(() => {
    setActivePinia(createTestingPinia({ stubActions: false }))
    layoutStore.resetForTests()
  })

  it('adopts stored layout when materialized from serialized data', () => {
    const { graph, link } = connectedGraph()
    const rerouteId = toRerouteId(37)
    layoutStore.applyOperation({
      actor: 'remote-peer',
      entity: 'reroute',
      graphId: graph.rootGraph.id,
      position: { x: 500, y: 300 },
      rerouteId,
      source: LayoutSource.External,
      timestamp: Date.now(),
      type: 'createReroute'
    })
    const data = graph.asSerialisable()
    data.version = 1
    data.reroutes = [{ id: rerouteId, pos: [100, 100], linkIds: [] }]
    const serializedLink = data.links?.find(({ id }) => id === link.id)
    if (!serializedLink) throw new Error('Expected serialized link')
    serializedLink.parentId = rerouteId

    graph.configure(data)

    const reroute = graph.reroutes.get(rerouteId)!
    expect([...reroute.pos]).toEqual([500, 300])

    reroute.pos = [600, 300]

    expect(
      layoutStore.getRerouteLayout(graph.rootGraph.id, rerouteId)?.position
    ).toEqual({ x: 600, y: 300 })
    expect(
      layoutStore.getRerouteLayout(graph.rootGraph.id, rerouteId)
    ).not.toBeNull()
  })

  it('limits configure adoption to the exact serialized reroute input', () => {
    const graph = new LGraph()
    const serializedRerouteId = toRerouteId(38)
    const unrelatedRerouteId = toRerouteId(39)
    for (const rerouteId of [serializedRerouteId, unrelatedRerouteId]) {
      layoutStore.applyOperation({
        actor: 'remote-peer',
        entity: 'reroute',
        graphId: graph.id,
        position: { x: 50, y: 60 },
        rerouteId,
        source: LayoutSource.External,
        timestamp: Date.now(),
        type: 'createReroute'
      })
    }
    const data = graph.asSerialisable()
    const serializedReroute = {
      id: serializedRerouteId,
      pos: [10, 20] as [number, number],
      floating: { slotType: 'input' as const },
      linkIds: []
    }
    data.reroutes = [serializedReroute]
    const originalSetReroute = graph.setReroute.bind(graph)
    let unrelatedError: unknown
    let adoptedReroute: Reroute | undefined
    vi.spyOn(graph, 'setReroute').mockImplementation((rerouteData) => {
      if (rerouteData === serializedReroute) {
        try {
          originalSetReroute({
            id: unrelatedRerouteId,
            pos: [30, 40],
            linkIds: []
          })
        } catch (error) {
          unrelatedError = error
        }
      }
      const reroute = originalSetReroute(rerouteData)
      if (rerouteData === serializedReroute) adoptedReroute = reroute
      return reroute
    })

    graph.configure(data)

    expect(unrelatedError).toEqual(expect.objectContaining({ name: 'Error' }))
    expect(graph.reroutes.has(unrelatedRerouteId)).toBe(false)
    expect(adoptedReroute).toBeDefined()
  })

  it('rebuilds a reroute during keep_old configure', () => {
    const { graph, link } = connectedGraph()
    const reroute = graph.createReroute([100, 100], link)!
    const data = graph.asSerialisable()

    graph.configure(data, true)

    const rebuilt = graph.reroutes.get(reroute.id)!
    expect(rebuilt).not.toBe(reroute)
    expect(
      layoutStore.getRerouteLayout(graph.rootGraph.id, reroute.id)?.position
    ).toEqual({ x: 100, y: 100 })

    rebuilt.pos = [200, 300]

    expect(
      layoutStore.getRerouteLayout(graph.rootGraph.id, reroute.id)?.position
    ).toEqual({ x: 200, y: 300 })
  })

  it('does not restore stale topology when rebuild is rejected', () => {
    const graph = new LGraph()
    const parent = graph.setReroute({ pos: [5, 6], linkIds: [] })
    const reroute = graph.setReroute({
      pos: [10, 20],
      floating: { slotType: 'input' },
      linkIds: []
    })
    const data = graph.asSerialisable()
    data.reroutes = data.reroutes?.filter(({ id }) => id === reroute.id)
    const serialized = data.reroutes?.find(({ id }) => id === reroute.id)
    if (!serialized) throw new Error('Expected serialized reroute')
    serialized.parentId = parent.id
    serialized.pos = [30, 40]
    serialized.floating = { slotType: 'output' }
    const applyOperation = vi
      .spyOn(layoutStore, 'applyOperation')
      .mockImplementation((operation) =>
        operation.type === 'createReroute' && operation.rerouteId === reroute.id
          ? 'rejected'
          : 'no-op'
      )
    onTestFinished(() => applyOperation.mockRestore())

    expect(() => graph.configure(data, true)).toThrow(/registration rejected/)

    expect(graph.reroutes.get(reroute.id)).toBeUndefined()
    expect(
      useRerouteStore().getReroute(graphScopeOf(graph), reroute.id)
    ).toBeUndefined()
  })

  it('keeps constructor geometry transient until registration', () => {
    const graph = new LGraph()
    const reroute = new Reroute(toRerouteId(12), graph, [37, 41])

    expect([...reroute.pos]).toEqual([37, 41])
    expect(
      layoutStore.getRerouteLayout(graph.rootGraph.id, reroute.id)
    ).toBeNull()

    graph._addReroute(reroute)

    expect(
      layoutStore.getRerouteLayout(graph.rootGraph.id, reroute.id)?.position
    ).toEqual({
      x: 37,
      y: 41
    })
  })

  it('rejects a duplicate owner before changing reroute or layout state', () => {
    const graph = new LGraph()
    const id = toRerouteId(13)
    const owner = new Reroute(id, graph, [10, 20])
    graph._addReroute(owner)
    const duplicate = new Reroute(id, graph, [100, 200])

    expect(() => graph._addReroute(duplicate)).toThrow(/already owned/)
    expect(graph.reroutes.get(id)).toBe(owner)
    expect(useRerouteStore().getReroute(graphScopeOf(graph), id)).toBe(
      owner._chain
    )
    expect(
      layoutStore.getRerouteLayout(graph.rootGraph.id, id)?.position
    ).toEqual({
      x: 10,
      y: 20
    })
  })

  it('rejects reroute ownership collisions across sibling subgraphs', () => {
    const root = new LGraph()
    const firstGraph = createTestSubgraph({ rootGraph: root })
    const secondGraph = createTestSubgraph({ rootGraph: root })
    const id = toRerouteId(14)
    const owner = new Reroute(id, firstGraph, [10, 20])
    firstGraph._addReroute(owner)
    const duplicate = new Reroute(id, secondGraph, [100, 200])

    expect(() => secondGraph._addReroute(duplicate)).toThrow(/already owned/)
    expect(secondGraph.reroutes.has(id)).toBe(false)
    expect(layoutStore.getRerouteLayout(root.id, id)?.position).toEqual({
      x: 10,
      y: 20
    })
  })

  it('only attaches an instance to its constructor graph', () => {
    const root = new LGraph()
    const firstGraph = createTestSubgraph({ rootGraph: root })
    const secondGraph = createTestSubgraph({ rootGraph: root })
    const reroute = new Reroute(toRerouteId(15), firstGraph, [10, 20])

    firstGraph._addReroute(reroute)
    firstGraph._addReroute(reroute)
    expect(firstGraph.reroutes.get(reroute.id)).toBe(reroute)

    expect(() => secondGraph._addReroute(reroute)).toThrow(/constructor graph/)
    expect(secondGraph.reroutes.has(reroute.id)).toBe(false)
    expect(firstGraph.reroutes.get(reroute.id)).toBe(reroute)
  })

  it('rolls back chain ownership when layout registration fails', () => {
    const graph = new LGraph()
    const reroute = new Reroute(toRerouteId(16), graph, [10, 20])
    const applyOperation = vi
      .spyOn(layoutStore, 'applyOperation')
      .mockImplementation((operation) => {
        if (operation.type === 'createReroute') throw new Error('layout failed')
        return 'no-op'
      })
    onTestFinished(() => applyOperation.mockRestore())

    expect(() => graph._addReroute(reroute)).toThrow('layout failed')
    expect(graph.reroutes.has(reroute.id)).toBe(false)
    expect(
      useRerouteStore().getReroute(graphScopeOf(graph), reroute.id)
    ).toBeUndefined()
    expect(
      layoutStore.getRerouteLayout(graph.rootGraph.id, reroute.id)
    ).toBeNull()
    expect(reroute._graphScope).toBeUndefined()
  })

  it.for(['rejected', 'no-op'] as const)(
    'rejects ordinary attachment when layout registration is %s',
    (result) => {
      const graph = new LGraph()
      const reroute = new Reroute(toRerouteId(16), graph, [10, 20])
      const applyOperation = vi
        .spyOn(layoutStore, 'applyOperation')
        .mockReturnValueOnce(result)
      onTestFinished(() => applyOperation.mockRestore())

      expect(() => graph._addReroute(reroute)).toThrow(/registration/)
      expect(graph.reroutes.has(reroute.id)).toBe(false)
      expect(
        useRerouteStore().getReroute(graphScopeOf(graph), reroute.id)
      ).toBeUndefined()
    }
  )

  it('rejects a reroute structurally owned by a sibling subgraph', () => {
    const root = new LGraph()
    const subgraph = createTestSubgraph({ rootGraph: root })
    const sibling = createTestSubgraph({ rootGraph: root })
    const existing = new Reroute(toRerouteId(27), subgraph, [70, 80])
    subgraph._addReroute(existing)
    const owner = new Reroute(toRerouteId(28), sibling, [10, 20])
    sibling._addReroute(owner)
    const original = subgraph.asSerialisable()
    const data = structuredClone(original)
    data.name = 'Rejected replacement'
    data.inputs = [{ id: createUuidv4(), name: 'Rejected input', type: '*' }]
    data.reroutes = [{ id: 28, pos: [30, 40], linkIds: [] }]
    const events: string[] = []
    let inputEvents = 0
    subgraph.events.addEventListener('configuring', () =>
      events.push('configuring')
    )
    subgraph.events.addEventListener('configured', () =>
      events.push('configured')
    )
    subgraph.events.addEventListener('input-added', () => inputEvents++)

    expect(() => subgraph.configure(data)).toThrow(/already owned/)

    expect(events).toEqual(['configuring', 'configured'])
    expect(inputEvents).toBe(0)
    expect(subgraph.asSerialisable()).toEqual(original)
    expect(
      useRerouteStore().getReroute(graphScopeOf(subgraph), existing.id)
    ).toBe(existing._chain)
    expect(useRerouteStore().getReroute(graphScopeOf(sibling), owner.id)).toBe(
      owner._chain
    )
    expect(
      layoutStore.getRerouteLayout(root.id, existing.id)?.position
    ).toEqual({ x: 70, y: 80 })
    expect(layoutStore.getRerouteLayout(root.id, owner.id)?.position).toEqual({
      x: 10,
      y: 20
    })
  })

  it('does not preflight a canceled configuration', () => {
    const id = createUuidv4()
    const owner = new LGraph()
    owner.id = id
    owner._addReroute(new Reroute(toRerouteId(19), owner, [10, 20]))
    const graph = new LGraph()
    const originalId = graph.id
    const data = graph.asSerialisable()
    data.id = id
    data.reroutes = [{ id: 19, pos: [30, 40], linkIds: [] }]
    graph.events.addEventListener('configuring', (event) =>
      event.preventDefault()
    )

    expect(() => graph.configure(data)).not.toThrow()
    expect(graph.id).toBe(originalId)
    expect(graph.reroutes.size).toBe(0)
  })

  it('honors a configuring listener that enables replacement', () => {
    const graph = new LGraph()
    const existing = new Reroute(toRerouteId(31), graph, [10, 20])
    graph._addReroute(existing)
    const originalId = graph.id
    const replacementId = createUuidv4()
    const data = graph.asSerialisable()
    data.id = replacementId
    graph.events.addEventListener('configuring', (event) => {
      event.detail.clearGraph = true
    })

    expect(() => graph.configure(data, true)).not.toThrow()

    expect(graph.id).toBe(replacementId)
    expect(graph.reroutes.has(existing.id)).toBe(false)
    expect(
      useRerouteStore().getReroute(
        {
          rootGraphId: toRootGraphId(originalId),
          owningGraphId: toOwningGraphId(originalId)
        },
        existing.id
      )
    ).toBeUndefined()
  })

  it('honors a configuring listener that retains populated state', () => {
    const { graph, link } = connectedGraph()
    const existing = graph.createReroute([10, 20], link)!
    const originalId = graph.id
    const replacementId = createUuidv4()
    const data = graph.asSerialisable()
    data.id = replacementId
    graph.events.addEventListener('configuring', (event) => {
      event.detail.clearGraph = false
    })
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {})
    onTestFinished(() => warn.mockRestore())

    expect(() => graph.configure(data)).not.toThrow()

    expect(graph.id).toBe(originalId)
    const rebuilt = graph.reroutes.get(existing.id)!
    expect(rebuilt).not.toBe(existing)
    expect(
      useRerouteStore().getReroute(
        {
          rootGraphId: toRootGraphId(originalId),
          owningGraphId: toOwningGraphId(originalId)
        },
        existing.id
      )
    ).toBe(rebuilt._chain)
    expect(
      useRerouteStore().getReroute(
        {
          rootGraphId: toRootGraphId(replacementId),
          owningGraphId: toOwningGraphId(replacementId)
        },
        existing.id
      )
    ).toBeUndefined()
    expect(warn).toHaveBeenCalledWith(
      '[LGraph] Keeping current root identity during configuration',
      {
        currentGraphId: originalId,
        mode: 'keep-old',
        requestedGraphId: replacementId
      }
    )
  })

  it('moves a replacement reroute from a subgraph into the root', () => {
    const { graph, link } = connectedGraph()
    const rerouteId = toRerouteId(34)
    const data: SerialisableGraph = {
      ...graph.asSerialisable(),
      reroutes: [{ id: rerouteId, pos: [30, 40], linkIds: [] }]
    }
    const serializedLink = data.links?.find(({ id }) => id === link.id)
    if (!serializedLink) throw new Error('Expected serialized link')
    serializedLink.parentId = rerouteId
    const subgraph = createTestSubgraph({ rootGraph: graph })
    graph.subgraphs.set(subgraph.id, subgraph)
    subgraph._addReroute(new Reroute(rerouteId, subgraph, [10, 20]))

    expect(() => graph.configure(data)).not.toThrow()

    expect(graph.subgraphs.has(subgraph.id)).toBe(false)
    expect([...graph.reroutes.keys()]).toEqual([rerouteId])
    expect(useRerouteStore().getReroute(graphScopeOf(graph), rerouteId)).toBe(
      graph.reroutes.get(rerouteId)?._chain
    )
    expect(layoutStore.getRerouteLayout(graph.id, rerouteId)?.position).toEqual(
      {
        x: 30,
        y: 40
      }
    )
  })

  it('keeps the first root-local duplicate reroute', () => {
    const { graph } = connectedGraph()
    const data = graph.asSerialisable()
    data.reroutes = [
      { id: 23, pos: [30, 40], linkIds: [] },
      { id: 23, pos: [50, 60], linkIds: [] }
    ]
    const [link] = data.links ?? []
    if (!link) throw new Error('Expected serialized link')
    link.parentId = toRerouteId(23)
    const originalData = structuredClone(data)
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {})
    onTestFinished(() => warn.mockRestore())

    expect(() => graph.configure(data)).not.toThrow()

    expect(graph.reroutes.size).toBe(1)
    expect(graph.reroutes.get(toRerouteId(23))?.pos).toEqual([30, 40])
    expect(data).toEqual(originalData)
    expect(warn).toHaveBeenCalledWith('[LGraph] Duplicate reroute ignored', {
      graphId: graph.id,
      rerouteId: toRerouteId(23),
      scope: 'root'
    })
  })

  it('keeps the first duplicate reroute within a subgraph', () => {
    const graph = new LGraph()
    const subgraph = createTestSubgraph({ rootGraph: graph })
    const source = new LGraphNode('source')
    source.addOutput('out', '*')
    const target = new LGraphNode('target')
    target.addInput('in', '*')
    subgraph.add(source)
    subgraph.add(target)
    source.connect(0, target, 0)
    const subgraphData = subgraph.asSerialisable()
    subgraphData.reroutes = [
      { id: 23, pos: [30, 40], linkIds: [] },
      { id: 23, pos: [50, 60], linkIds: [] }
    ]
    const [link] = subgraphData.links ?? []
    if (!link) throw new Error('Expected serialized link')
    link.parentId = toRerouteId(23)
    const data = graph.asSerialisable()
    data.definitions = { subgraphs: [subgraphData] }
    const originalData = structuredClone(data)
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {})
    onTestFinished(() => warn.mockRestore())

    expect(() => graph.configure(data)).not.toThrow()

    const configured = graph.subgraphs.get(subgraph.id)
    expect(configured?.reroutes.size).toBe(1)
    expect(configured?.reroutes.get(toRerouteId(23))?.pos).toEqual([30, 40])
    expect(data).toEqual(originalData)
    expect(warn).toHaveBeenCalledWith('[LGraph] Duplicate reroute ignored', {
      graphId: graph.id,
      rerouteId: toRerouteId(23),
      scope: subgraph.id
    })
  })

  it.for([
    {
      name: 'between the root graph and a subgraph',
      configureData(data: SerialisableGraph) {
        data.reroutes = [{ id: 23, pos: [30, 40], linkIds: [] }]
        const subgraph = createTestSubgraph({
          rootGraph: new LGraph()
        }).asSerialisable()
        subgraph.reroutes = [{ id: 23, pos: [50, 60], linkIds: [] }]
        data.definitions = { subgraphs: [subgraph] }
      }
    },
    {
      name: 'between sibling subgraphs',
      configureData(data: SerialisableGraph) {
        const fixtureRoot = new LGraph()
        const first = createTestSubgraph({
          rootGraph: fixtureRoot
        }).asSerialisable()
        const second = createTestSubgraph({
          rootGraph: fixtureRoot
        }).asSerialisable()
        first.reroutes = [{ id: 23, pos: [30, 40], linkIds: [] }]
        second.reroutes = [{ id: 23, pos: [50, 60], linkIds: [] }]
        data.definitions = { subgraphs: [first, second] }
      }
    }
  ])('handles incoming reroute collisions $name', ({ configureData }) => {
    const graph = new LGraph()
    const existing = new Reroute(toRerouteId(24), graph, [70, 80])
    graph._addReroute(existing)
    const originalId = graph.id
    const data = graph.asSerialisable()
    configureData(data)
    const originalData = structuredClone(data)

    expect(() => graph.configure(data)).not.toThrow()
    const rerouteIds = [
      ...graph.reroutes.keys(),
      ...[...graph.subgraphs.values()].flatMap((subgraph) => [
        ...subgraph.reroutes.keys()
      ])
    ]
    expect(new Set(rerouteIds).size).toBe(rerouteIds.length)
    expect(data).toEqual(originalData)
    expect(graph.id).toBe(originalId)
  })

  it('rejects keep_old data owned by a sibling subgraph', () => {
    const graph = new LGraph()
    const sibling = createTestSubgraph({ rootGraph: graph })
    sibling._addReroute(new Reroute(toRerouteId(25), sibling, [10, 20]))
    const existing = new Reroute(toRerouteId(26), graph, [70, 80])
    graph._addReroute(existing)
    const originalId = graph.id
    const data = graph.asSerialisable()
    data.id = zeroUuid
    data.reroutes = [{ id: 25, pos: [30, 40], linkIds: [] }]

    expect(() => graph.configure(data, true)).toThrow(/already owned/)
    expect(graph.id).toBe(originalId)
    expect(graph.reroutes.get(existing.id)).toBe(existing)
    expect(
      useRerouteStore().getReroute(
        {
          rootGraphId: toRootGraphId(originalId),
          owningGraphId: toOwningGraphId(originalId)
        },
        existing.id
      )
    ).toBe(existing._chain)
    expect(
      layoutStore.getRerouteLayout(originalId, existing.id)?.position
    ).toEqual({ x: 70, y: 80 })
    expect(
      layoutStore.getRerouteLayout(originalId, toRerouteId(25))?.position
    ).toEqual({ x: 10, y: 20 })
  })

  it('keeps the populated root identity while loading keep_old data', () => {
    const { graph, link } = connectedGraph()
    const reroute = graph.createReroute([70, 80], link)!
    const originalId = graph.id
    const replacementId = createUuidv4()
    const data = structuredClone(graph.asSerialisable())
    data.id = replacementId
    data.reroutes?.push({ id: 30, pos: [30, 40], linkIds: [] })
    const retainedReroute = data.reroutes?.find(({ id }) => id === reroute.id)
    if (!retainedReroute) throw new Error('Expected retained reroute')
    retainedReroute.parentId = 30
    const originalData = structuredClone(data)
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {})
    onTestFinished(() => warn.mockRestore())

    expect(() => graph.configure(data, true)).not.toThrow()

    expect(graph.id).toBe(originalId)
    const rebuilt = graph.reroutes.get(reroute.id)!
    expect(rebuilt).not.toBe(reroute)
    expect(rebuilt.parentId).toBe(toRerouteId(30))
    expect(graph.reroutes.get(toRerouteId(30))?.pos).toEqual([30, 40])
    expect(
      useRerouteStore().getReroute(
        {
          rootGraphId: toRootGraphId(originalId),
          owningGraphId: toOwningGraphId(originalId)
        },
        reroute.id
      )
    ).toBe(rebuilt._chain)
    expect(
      useRerouteStore().getReroute(
        {
          rootGraphId: toRootGraphId(originalId),
          owningGraphId: toOwningGraphId(originalId)
        },
        toRerouteId(30)
      )
    ).toBeDefined()
    expect(
      useRerouteStore().getReroute(
        {
          rootGraphId: toRootGraphId(replacementId),
          owningGraphId: toOwningGraphId(replacementId)
        },
        reroute.id
      )
    ).toBeUndefined()
    expect(
      layoutStore.getRerouteLayout(originalId, reroute.id)?.position
    ).toEqual({ x: 70, y: 80 })
    expect(layoutStore.getRerouteLayout(replacementId, reroute.id)).toBeNull()
    expect(data).toEqual(originalData)
    expect(warn).toHaveBeenCalledWith(
      '[LGraph] Keeping current root identity during configuration',
      {
        currentGraphId: originalId,
        mode: 'keep-old',
        requestedGraphId: replacementId
      }
    )
  })

  it('root clear drops nested reroute components', () => {
    const graph = new LGraph()
    const subgraph = createTestSubgraph({ rootGraph: graph })
    graph.subgraphs.set(subgraph.id, subgraph)
    const reroute = new Reroute(toRerouteId(30), subgraph, [10, 20])
    subgraph._addReroute(reroute)
    const clearedScope = graphScopeOf(subgraph)

    layoutStore.applyOperation({
      actor: 'remote',
      entity: 'reroute',
      graphId: graph.id,
      position: { x: 25, y: 35 },
      rerouteId: reroute.id,
      source: LayoutSource.External,
      timestamp: Date.now(),
      type: 'moveReroute'
    })
    graph.clear()

    expect(
      useRerouteStore().getReroute(clearedScope, reroute.id)
    ).toBeUndefined()
    expect(layoutStore.getRerouteLayout(graph.id, reroute.id)).toBeNull()
  })

  it('preserves the projected position when removing a reroute', () => {
    const { graph, link } = connectedGraph()
    const reroute = graph.createReroute([10, 20], link)!
    layoutStore.applyOperation({
      actor: 'remote',
      entity: 'reroute',
      graphId: graph.id,
      position: { x: 30, y: 40 },
      rerouteId: reroute.id,
      source: LayoutSource.External,
      timestamp: Date.now(),
      type: 'moveReroute'
    })

    graph.removeReroute(reroute.id)

    expect([...reroute.pos]).toEqual([30, 40])
  })

  it('attached reroute writes update a replacement layout at the same key', () => {
    const graph = new LGraph()
    const reroute = graph.setReroute({ pos: [10, 20], linkIds: [] })
    const reroutes = getLayoutStoreYDoc().getMap<Y.Map<unknown>>('reroutes')
    const key = `${graph.rootGraph.id}:${reroute.id}`
    const foreign = new Y.Map<unknown>()
    foreign.set('id', reroute.id)
    foreign.set('position', { x: 70, y: 80 })
    reroutes.set(key, foreign)

    reroute.pos = [30, 40]

    expect(reroutes.get(key)).toBe(foreign)
    expect([...reroute.pos]).toEqual([30, 40])
  })

  it.for([
    [
      'remove',
      true,
      (graph: LGraph, reroute: Reroute) => graph.removeReroute(reroute.id)
    ],
    [
      'unowned unregister',
      false,
      (graph: LGraph, reroute: Reroute) =>
        detachLayout(graph, 'reroute', reroute)
    ]
  ] as const)(
    '%s handles an existing reroute layout by attachment',
    ([, attached, release]) => {
      const graph = new LGraph()
      const reroute = attached
        ? graph.setReroute({ pos: [10, 20], linkIds: [] })
        : new Reroute(toRerouteId(31), graph, [10, 20])
      const reroutes = getLayoutStoreYDoc().getMap<Y.Map<unknown>>('reroutes')
      const key = `${graph.rootGraph.id}:${reroute.id}`
      const foreignReroute = new Y.Map<unknown>()
      foreignReroute.set('id', reroute.id)
      foreignReroute.set('position', { x: 70, y: 80 })
      reroutes.set(key, foreignReroute)

      release(graph, reroute)

      expect(reroutes.get(key)).toBe(attached ? undefined : foreignReroute)
      if (attached) expect([...reroute.pos]).toEqual([70, 80])
    }
  )

  it('restores an attached reroute layout when canvas deselect throws', () => {
    const { graph, link } = connectedGraph()
    const reroute = graph.createReroute([10, 20], link)!
    detachLayout(graph, 'reroute', reroute)
    attachLayout(graph, 'reroute', reroute, {
      position: { x: 10, y: 20 }
    })
    const canvasAction = vi
      .spyOn(graph, 'canvasAction')
      .mockImplementation(() => {
        throw new Error('reroute deselect failed')
      })

    expect(() => graph.removeReroute(reroute.id)).toThrow(
      'reroute deselect failed'
    )
    expect(graph.reroutes.get(reroute.id)).toBe(reroute)
    expect(link.parentId).toBe(reroute.id)
    expect(
      layoutStore.getRerouteLayout(graph.rootGraph.id, reroute.id)?.position
    ).toEqual({ x: 10, y: 20 })

    reroute.pos = [30, 40]
    expect(
      layoutStore.getRerouteLayout(graph.rootGraph.id, reroute.id)?.position
    ).toEqual({ x: 30, y: 40 })

    canvasAction.mockRestore()
    graph.removeReroute(reroute.id)
    expect(
      layoutStore.getRerouteLayout(graph.rootGraph.id, reroute.id)
    ).toBeNull()
  })

  it('keeps reroute attachment when reentrant unregister is rejected', () => {
    const { graph, link } = connectedGraph()
    const reroute = graph.createReroute([10, 20], link)!
    const ydoc = getLayoutStoreYDoc()
    function attemptRemove(): void {
      ydoc.off('beforeTransaction', attemptRemove)
      graph.removeReroute(reroute.id)
    }
    ydoc.on('beforeTransaction', attemptRemove)

    reroute.pos = [30, 40]

    expect(graph.reroutes.get(reroute.id)).toBe(reroute)
    expect(link.parentId).toBe(reroute.id)
    expect(
      layoutStore.getRerouteLayout(graph.rootGraph.id, reroute.id)?.position
    ).toEqual({ x: 30, y: 40 })
  })

  it('clears subgraph reroute registrations when the root clears', () => {
    const root = new LGraph()
    const subgraph = createTestSubgraph({ rootGraph: root })
    root.subgraphs.set(subgraph.id, subgraph)
    const reroute = new Reroute(toRerouteId(32), subgraph, [10, 20])
    subgraph._addReroute(reroute)
    const scope = graphScopeOf(subgraph)
    expect(useRerouteStore().getReroute(scope, reroute.id)).toBe(reroute._chain)

    root.clear()

    expect(useRerouteStore().getReroute(scope, reroute.id)).toBeUndefined()
  })

  it('isolates colliding reroute IDs across live root graphs', () => {
    const firstGraph = new LGraph()
    const secondGraph = new LGraph()
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

  it('uses the live root graph ID after construction', () => {
    const graph = new LGraph()
    const originalId = graph.id
    const reroute = new Reroute(toRerouteId(21), graph, [10, 20])
    const configuredId = createUuidv4()
    graph.id = configuredId

    graph._addReroute(reroute)
    reroute.pos = [30, 40]

    expect(useRerouteStore().getReroute(graphScopeOf(graph), reroute.id)).toBe(
      reroute._chain
    )
    expect(
      layoutStore.getRerouteLayout(configuredId, reroute.id)?.position
    ).toEqual({ x: 30, y: 40 })
    expect(layoutStore.getRerouteLayout(originalId, reroute.id)).toBeNull()
    expect([...reroute.pos]).toEqual([30, 40])
  })

  it('reads a store write back through pos, with no class-side copy', () => {
    const { graph, link } = connectedGraph()
    const reroute = graph.createReroute([10, 10], link)!
    const pos = reroute.pos
    const getFullLayout = vi.spyOn(layoutStore, 'getRerouteLayout')
    onTestFinished(() => getFullLayout.mockRestore())

    getLayoutStoreYDoc()
      .getMap<Y.Map<unknown>>('reroutes')
      .get(`${graph.rootGraph.id}:${reroute.id}`)
      ?.set('position', { x: 300, y: 400 })
    getFullLayout.mockClear()

    expect([...reroute.pos]).toEqual([300, 400])
    expect(reroute.pos).toBe(pos)
    expect([...pos]).toEqual([300, 400])
    expect(reroute.boundingRect[0]).toBe(300 - Reroute.radius)
    expect(getFullLayout).not.toHaveBeenCalled()
  })

  it('writes indexed and method mutations through to the store', () => {
    const { graph, link } = connectedGraph()
    const reroute = graph.createReroute([10, 20], link)!

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
    const reroute = graph.createReroute([10, 20], link)!
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
