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
  registerRerouteLayout,
  unregisterRerouteLayout
} from '@/renderer/core/layout/operations/graphLayoutRegistration'
import { useLayoutMutations } from '@/renderer/core/layout/operations/layoutMutations'
import {
  LayoutOperationError,
  layoutStore
} from '@/renderer/core/layout/store/layoutStore'
import { LayoutSource } from '@/renderer/core/layout/types'
import { getLayoutStoreYDoc } from '@/renderer/core/layout/store/layoutStoreTestUtils'
import { useRerouteStore } from '@/stores/rerouteStore'
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
    expect(store.getReroute(graph.rootGraph.id, reroute.id)?.id).toBe(
      reroute.id
    )

    graph.removeReroute(reroute.id)
    expect(store.getReroute(graph.rootGraph.id, reroute.id)).toBeUndefined()
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

    expect(store.getReroute(graph.rootGraph.id, reroute.id)?.id).toBe(3)
    const creationOperations = applyOperation.mock.calls.filter(
      ([operation]) => operation.entity === 'reroute'
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

    expect(existing).toBe(reroute)
    expect(existing.pos).toEqual([8, 9])
    const updateOperations = applyOperation.mock.calls.filter(
      ([operation]) => operation.entity === 'reroute'
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
    const applyOperation = vi.spyOn(layoutStore, 'applyOperation')
    onTestFinished(() => applyOperation.mockRestore())

    expect(reroute.snapToGrid(10)).toBe(false)
    expect(applyOperation).not.toHaveBeenCalled()
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
  beforeEach(() => {
    setActivePinia(createTestingPinia({ stubActions: false }))
    layoutStore.resetForTests()
  })

  it('adopts stored ownership when materialized from serialized data', () => {
    const { graph, link } = connectedGraph()
    const rerouteId = toRerouteId(37)
    layoutStore.applyOperation({
      actor: 'remote-peer',
      entity: 'reroute',
      graphId: graph.rootGraph.id,
      position: { x: 500, y: 300 },
      registrationId: 'remote-peer',
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
      layoutStore.getRegistrationId('reroute', graph.rootGraph.id, rerouteId)
    ).toBe('remote-peer')
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
    expect(useRerouteStore().getReroute(graph.rootGraph.id, id)).toBe(
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

    expect(() => graph._addReroute(reroute)).toThrow('layout failed')
    expect(graph.reroutes.has(reroute.id)).toBe(false)
    expect(
      useRerouteStore().getReroute(graph.rootGraph.id, reroute.id)
    ).toBeUndefined()
    expect(
      layoutStore.getRerouteLayout(graph.rootGraph.id, reroute.id)
    ).toBeNull()
    expect(reroute._graphId).toBeUndefined()
    applyOperation.mockRestore()
  })

  it('preflights all serialized reroutes before configuring a graph', () => {
    const id = createUuidv4()
    const owner = new LGraph()
    owner.id = id
    owner._addReroute(new Reroute(toRerouteId(18), owner, [10, 20]))
    const graph = new LGraph()
    const originalId = graph.id
    const originalLayout = { x: 70, y: 80 }
    useLayoutMutations().createReroute(
      originalId,
      toRerouteId(17),
      originalLayout
    )

    expect(() =>
      graph.configure({
        version: 1,
        revision: 0,
        id,
        state: {
          lastNodeId: 0,
          lastLinkId: 0,
          lastGroupId: 0,
          lastRerouteId: 18
        },
        nodes: [],
        links: [],
        groups: [],
        reroutes: [
          { id: 17, pos: [30, 40], linkIds: [] },
          { id: 18, pos: [50, 60], linkIds: [] }
        ]
      })
    ).toThrow(/already owned/)

    expect(graph.id).toBe(originalId)
    expect(graph.reroutes.size).toBe(0)
    expect(useRerouteStore().getReroute(id, toRerouteId(17))).toBeUndefined()
    expect(
      layoutStore.getRerouteLayout(originalId, toRerouteId(17))?.position
    ).toEqual(originalLayout)
    expect(layoutStore.getRerouteLayout(id, toRerouteId(18))?.position).toEqual(
      {
        x: 10,
        y: 20
      }
    )
  })

  it('preflights nested serialized reroutes before changing graph state', () => {
    const id = createUuidv4()
    const owner = new LGraph()
    owner.id = id
    owner._addReroute(new Reroute(toRerouteId(22), owner, [10, 20]))
    const graph = new LGraph()
    const originalId = graph.id
    const existing = new Reroute(toRerouteId(21), graph, [70, 80])
    graph._addReroute(existing)
    const data = graph.asSerialisable()
    data.id = id
    const subgraph = createTestSubgraph({ rootGraph: graph }).asSerialisable()
    subgraph.reroutes = [{ id: 22, pos: [30, 40], linkIds: [] }]
    data.definitions = { subgraphs: [subgraph] }

    expect(() => graph.configure(data)).toThrow(/already owned/)

    expect(graph.id).toBe(originalId)
    expect(graph.reroutes.get(existing.id)).toBe(existing)
    expect(useRerouteStore().getReroute(originalId, existing.id)).toBe(
      existing._chain
    )
    expect(
      layoutStore.getRerouteLayout(originalId, existing.id)?.position
    ).toEqual({ x: 70, y: 80 })
    expect(layoutStore.getRerouteLayout(id, toRerouteId(22))?.position).toEqual(
      {
        x: 10,
        y: 20
      }
    )
  })

  it('dispatches configured without applying subgraph data after preflight rejection', () => {
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
    expect(useRerouteStore().getReroute(root.id, existing.id)).toBe(
      existing._chain
    )
    expect(useRerouteStore().getReroute(root.id, owner.id)).toBe(owner._chain)
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

  it('preflights replacement data supplied by configuring listeners', () => {
    const id = createUuidv4()
    const owner = new LGraph()
    owner.id = id
    owner._addReroute(new Reroute(toRerouteId(20), owner, [10, 20]))
    const graph = new LGraph()
    const replacement = graph.asSerialisable()
    replacement.id = id
    replacement.reroutes = [{ id: 20, pos: [30, 40], linkIds: [] }]
    graph.events.addEventListener('configuring', (event) => {
      event.detail.data = replacement
    })

    expect(() => graph.configure(graph.asSerialisable())).toThrow(
      /already owned/
    )
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
      useRerouteStore().getReroute(originalId, existing.id)
    ).toBeUndefined()
  })

  it('honors a configuring listener that retains populated state', () => {
    const graph = new LGraph()
    const existing = new Reroute(toRerouteId(33), graph, [10, 20])
    graph._addReroute(existing)
    const originalId = graph.id
    const replacementId = createUuidv4()
    const data = graph.asSerialisable()
    data.id = replacementId
    graph.events.addEventListener('configuring', (event) => {
      event.detail.clearGraph = false
    })

    expect(() => graph.configure(data)).toThrow(/identity/)

    expect(graph.id).toBe(originalId)
    expect(graph.reroutes.get(existing.id)).toBe(existing)
    expect(useRerouteStore().getReroute(originalId, existing.id)).toBe(
      existing._chain
    )
    expect(
      useRerouteStore().getReroute(replacementId, existing.id)
    ).toBeUndefined()
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
    expect(useRerouteStore().getReroute(graph.id, rerouteId)).toBe(
      graph.reroutes.get(rerouteId)?._chain
    )
    expect(layoutStore.getRerouteLayout(graph.id, rerouteId)?.position).toEqual(
      {
        x: 30,
        y: 40
      }
    )
  })

  it.for([
    {
      name: 'within the root graph',
      configureData(data: SerialisableGraph) {
        data.reroutes = [
          { id: 23, pos: [30, 40], linkIds: [] },
          { id: 23, pos: [50, 60], linkIds: [] }
        ]
      }
    },
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
  ])(
    'rejects incoming reroute collisions $name before mutation',
    ({ configureData }) => {
      const graph = new LGraph()
      const existing = new Reroute(toRerouteId(24), graph, [70, 80])
      graph._addReroute(existing)
      const originalId = graph.id
      const data = graph.asSerialisable()
      configureData(data)

      expect(() => graph.configure(data)).toThrow(/Reroute 23.*more than once/)
      expect(graph.id).toBe(originalId)
      expect(graph.reroutes.get(existing.id)).toBe(existing)
      expect(useRerouteStore().getReroute(originalId, existing.id)).toBe(
        existing._chain
      )
      expect(
        layoutStore.getRerouteLayout(originalId, existing.id)?.position
      ).toEqual({ x: 70, y: 80 })
    }
  )

  it('preflights keep_old data without an ID against its live root bucket', () => {
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
    expect(useRerouteStore().getReroute(originalId, existing.id)).toBe(
      existing._chain
    )
    expect(
      layoutStore.getRerouteLayout(originalId, existing.id)?.position
    ).toEqual({ x: 70, y: 80 })
    expect(
      layoutStore.getRerouteLayout(originalId, toRerouteId(25))?.position
    ).toEqual({ x: 10, y: 20 })
  })

  it('rejects keep_old identity changes before mutating populated root state', () => {
    const graph = new LGraph()
    const reroute = new Reroute(toRerouteId(29), graph, [70, 80])
    graph._addReroute(reroute)
    const originalId = graph.id
    const replacementId = createUuidv4()
    const data = graph.asSerialisable()
    data.id = replacementId

    expect(() => graph.configure(data, true)).toThrow(/identity/)

    expect(graph.id).toBe(originalId)
    expect(graph.reroutes.get(reroute.id)).toBe(reroute)
    expect(useRerouteStore().getReroute(originalId, reroute.id)).toBe(
      reroute._chain
    )
    expect(
      useRerouteStore().getReroute(replacementId, reroute.id)
    ).toBeUndefined()
    expect(
      layoutStore.getRerouteLayout(originalId, reroute.id)?.position
    ).toEqual({ x: 70, y: 80 })
    expect(layoutStore.getRerouteLayout(replacementId, reroute.id)).toBeNull()
  })

  it('clear detaches retained reroutes until valid reattachment', () => {
    const graph = new LGraph()
    const reroute = new Reroute(toRerouteId(30), graph, [10, 20])
    graph._addReroute(reroute)
    const clearedGraphId = graph.id

    graph.clear()
    reroute.pos = [30, 40]

    expect(reroute._graphId).toBeUndefined()
    expect(reroute._attachedGraph).toBeUndefined()
    expect(
      useRerouteStore().getReroute(clearedGraphId, reroute.id)
    ).toBeUndefined()
    expect([...reroute.pos]).toEqual([30, 40])
    expect(layoutStore.getRerouteLayout(graph.id, reroute.id)).toBeNull()

    graph._addReroute(reroute)
    expect(useRerouteStore().getReroute(graph.id, reroute.id)).toBe(
      reroute._chain
    )
    expect(
      layoutStore.getRerouteLayout(graph.id, reroute.id)?.position
    ).toEqual({ x: 30, y: 40 })
  })

  it('remove preserves a foreign layout that replaced the attached reroute', () => {
    const graph = new LGraph()
    const reroute = graph.setReroute({ pos: [10, 20], linkIds: [] })
    const reroutes = getLayoutStoreYDoc().getMap<Y.Map<unknown>>('reroutes')
    const key = `${graph.rootGraph.id}:${reroute.id}`
    const foreignReroute = new Y.Map<unknown>()
    foreignReroute.set('id', reroute.id)
    foreignReroute.set('position', { x: 70, y: 80 })
    foreignReroute.set('registrationId', 'foreign-reroute')
    reroutes.set(key, foreignReroute)

    graph.removeReroute(reroute.id)

    expect(reroutes.get(key)).toBe(foreignReroute)
  })

  it('stale attached reroute writes preserve a foreign replacement', () => {
    const graph = new LGraph()
    const reroute = graph.setReroute({ pos: [10, 20], linkIds: [] })
    const reroutes = getLayoutStoreYDoc().getMap<Y.Map<unknown>>('reroutes')
    const key = `${graph.rootGraph.id}:${reroute.id}`
    const foreign = new Y.Map<unknown>()
    foreign.set('id', reroute.id)
    foreign.set('position', { x: 70, y: 80 })
    foreign.set('registrationId', 'foreign')
    reroutes.set(key, foreign)

    reroute.pos = [30, 40]

    expect(reroutes.get(key)).toBe(foreign)
    expect([...reroute.pos]).toEqual([70, 80])
  })

  it('clear preserves a foreign layout that replaced the attached reroute', () => {
    const graph = new LGraph()
    const reroute = graph.setReroute({ pos: [10, 20], linkIds: [] })
    const reroutes = getLayoutStoreYDoc().getMap<Y.Map<unknown>>('reroutes')
    const key = `${graph.rootGraph.id}:${reroute.id}`
    const foreignReroute = new Y.Map<unknown>()
    foreignReroute.set('id', reroute.id)
    foreignReroute.set('position', { x: 70, y: 80 })
    foreignReroute.set('registrationId', 'foreign-reroute')
    reroutes.set(key, foreignReroute)

    graph.clear()

    expect(reroutes.get(key)).toBe(foreignReroute)
  })

  it('unregister without ownership evidence preserves the reroute layout', () => {
    const graph = new LGraph()
    const reroute = new Reroute(toRerouteId(31), graph, [10, 20])
    const reroutes = getLayoutStoreYDoc().getMap<Y.Map<unknown>>('reroutes')
    const key = `${graph.rootGraph.id}:${reroute.id}`
    const foreignReroute = new Y.Map<unknown>()
    foreignReroute.set('id', reroute.id)
    foreignReroute.set('position', { x: 70, y: 80 })
    foreignReroute.set('registrationId', 'foreign-reroute')
    reroutes.set(key, foreignReroute)

    unregisterRerouteLayout(graph, reroute)

    expect(reroutes.get(key)).toBe(foreignReroute)
  })

  it('keeps retained ownership after a foreign explicit unregister', () => {
    const graph = new LGraph()
    const reroute = graph.setReroute({ pos: [10, 20], linkIds: [] })
    unregisterRerouteLayout(graph, reroute)
    registerRerouteLayout(graph, reroute, { x: 10, y: 20 }, 'A')

    expect(unregisterRerouteLayout(graph, reroute, 'B')).toBe('no-op')
    reroute.pos = [30, 40]
    expect(
      layoutStore.getRerouteLayout(graph.rootGraph.id, reroute.id)?.position
    ).toEqual({ x: 30, y: 40 })

    expect(unregisterRerouteLayout(graph, reroute, 'A')).toBe('applied')
    expect(
      layoutStore.getRerouteLayout(graph.rootGraph.id, reroute.id)
    ).toBeNull()
  })

  it('keeps a pending orphan after a foreign explicit unregister', () => {
    const graph = new LGraph()
    const reroute = new Reroute(toRerouteId(33), graph, [10, 20])
    const originalApplyOperation = layoutStore.applyOperation.bind(layoutStore)
    const applyOperation = vi
      .spyOn(layoutStore, 'applyOperation')
      .mockImplementation((operation) => {
        const result = originalApplyOperation(operation)
        if (operation.type === 'createReroute') throw new Error('create failed')
        return result
      })
    onTestFinished(() => applyOperation.mockRestore())

    expect(() =>
      registerRerouteLayout(graph, reroute, { x: 10, y: 20 }, 'A')
    ).toThrow('create failed')
    expect(unregisterRerouteLayout(graph, reroute, 'B')).toBe('no-op')

    applyOperation.mockRestore()
    expect(
      registerRerouteLayout(graph, reroute, { x: 30, y: 40 }, 'retry')
    ).toBe('applied')
    expect(layoutStore.getRegistrationId('reroute', graph.id, reroute.id)).toBe(
      'retry'
    )
  })

  it('retains reroute ownership when unregister throws before deletion', () => {
    const { graph, link } = connectedGraph()
    const reroute = graph.createReroute([10, 20], link)!
    const ydoc = getLayoutStoreYDoc()
    const transact = vi.spyOn(ydoc, 'transact').mockImplementationOnce(() => {
      throw new Error('reroute delete failed')
    })

    expect(() => graph.removeReroute(reroute.id)).toThrow(
      'reroute delete failed'
    )
    transact.mockRestore()
    expect(graph.reroutes.get(reroute.id)).toBe(reroute)
    expect(reroute._attachedGraph?.deref()).toBe(graph)
    expect(link.parentId).toBe(reroute.id)
    expect(
      layoutStore.getRerouteLayout(graph.rootGraph.id, reroute.id)
    ).not.toBeNull()

    graph.removeReroute(reroute.id)

    expect(graph.reroutes.has(reroute.id)).toBe(false)
    expect(reroute._attachedGraph).toBeUndefined()
    expect(link.parentId).toBeUndefined()
    expect(
      layoutStore.getRerouteLayout(graph.rootGraph.id, reroute.id)
    ).toBeNull()
  })

  it('restores reroute registration when unregister throws after deletion', () => {
    const { graph, link } = connectedGraph()
    const reroute = graph.createReroute([10, 20], link)!
    const ydoc = getLayoutStoreYDoc()
    const registrationId = layoutStore.getRegistrationId(
      'reroute',
      graph.rootGraph.id,
      reroute.id
    )
    const originalTransact = ydoc.transact.bind(ydoc)
    const transact = vi
      .spyOn(ydoc, 'transact')
      .mockImplementationOnce((transaction, origin) => {
        originalTransact(transaction, origin)
        throw new Error('reroute unregister failed')
      })

    expect(() => graph.removeReroute(reroute.id)).toThrow(
      'reroute unregister failed'
    )
    transact.mockRestore()
    expect(graph.reroutes.get(reroute.id)).toBe(reroute)
    expect(reroute._attachedGraph?.deref()).toBe(graph)
    expect(
      layoutStore.getRegistrationId('reroute', graph.rootGraph.id, reroute.id)
    ).toBe(registrationId)
    expect(
      layoutStore.getRerouteLayout(graph.rootGraph.id, reroute.id)?.position
    ).toEqual({
      x: 10,
      y: 20
    })

    reroute.pos = [30, 40]
    expect(
      layoutStore.getRerouteLayout(graph.rootGraph.id, reroute.id)?.position
    ).toEqual({
      x: 30,
      y: 40
    })
    graph.removeReroute(reroute.id)
    expect(
      layoutStore.getRerouteLayout(graph.rootGraph.id, reroute.id)
    ).toBeNull()
  })

  it('restores an attached reroute layout when canvas deselect throws', () => {
    const { graph, link } = connectedGraph()
    const reroute = graph.createReroute([10, 20], link)!
    unregisterRerouteLayout(graph, reroute)
    registerRerouteLayout(graph, reroute, { x: 10, y: 20 }, '')
    const canvasAction = vi
      .spyOn(graph, 'canvasAction')
      .mockImplementation(() => {
        throw new Error('reroute deselect failed')
      })

    expect(() => graph.removeReroute(reroute.id)).toThrow(
      'reroute deselect failed'
    )
    expect(graph.reroutes.get(reroute.id)).toBe(reroute)
    expect(reroute._attachedGraph?.deref()).toBe(graph)
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

  it('keeps reroute ownership when reentrant unregister is rejected', () => {
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
    expect(reroute._attachedGraph?.deref()).toBe(graph)
    expect(link.parentId).toBe(reroute.id)
    expect(
      layoutStore.getRerouteLayout(graph.rootGraph.id, reroute.id)?.position
    ).toEqual({ x: 30, y: 40 })
  })

  it('retains subgraph reroute ownership when clear layout deletion throws', () => {
    const root = new LGraph()
    const subgraph = createTestSubgraph({ rootGraph: root })
    root.subgraphs.set(subgraph.id, subgraph)
    const reroute = new Reroute(toRerouteId(32), subgraph, [10, 20])
    subgraph._addReroute(reroute)
    const rootId = root.id
    const ydoc = getLayoutStoreYDoc()
    const transact = vi.spyOn(ydoc, 'transact').mockImplementationOnce(() => {
      throw new Error('clear layout failed')
    })

    expect(() => root.clear()).toThrow('clear layout failed')
    transact.mockRestore()
    expect(subgraph.reroutes.get(reroute.id)).toBe(reroute)
    expect(reroute._attachedGraph?.deref()).toBe(subgraph)
    expect(useRerouteStore().getReroute(rootId, reroute.id)).toBe(
      reroute._chain
    )

    root.clear()

    expect(reroute._attachedGraph).toBeUndefined()
    expect(useRerouteStore().getReroute(rootId, reroute.id)).toBeUndefined()
  })

  it('clear only removes reroutes owned by that same-UUID root', () => {
    const firstGraph = new LGraph()
    const secondGraph = new LGraph()
    secondGraph.id = firstGraph.id
    const first = firstGraph.setReroute({
      id: toRerouteId(35),
      pos: [10, 20],
      linkIds: []
    })
    const second = secondGraph.setReroute({
      id: toRerouteId(36),
      pos: [30, 40],
      linkIds: []
    })
    const graphId = firstGraph.id

    firstGraph.clear()
    second.pos = [50, 60]

    expect(useRerouteStore().getReroute(graphId, first.id)).toBeUndefined()
    expect(useRerouteStore().getReroute(graphId, second.id)).toBe(second._chain)
    expect(secondGraph.reroutes.get(second.id)).toBe(second)
    expect(second._graphId).toBe(graphId)
    expect(second._attachedGraph?.deref()).toBe(secondGraph)
    expect(layoutStore.getRerouteLayout(graphId, second.id)?.position).toEqual({
      x: 50,
      y: 60
    })
    expect([...second.pos]).toEqual([50, 60])
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

    expect(useRerouteStore().getReroute(configuredId, reroute.id)).toBe(
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

    getLayoutStoreYDoc()
      .getMap<Y.Map<unknown>>('reroutes')
      .get(`${graph.rootGraph.id}:${reroute.id}`)
      ?.set('position', { x: 300, y: 400 })

    expect([...reroute.pos]).toEqual([300, 400])
    expect(reroute.pos).toBe(pos)
    expect([...pos]).toEqual([300, 400])
    expect(reroute.boundingRect[0]).toBe(300 - Reroute.radius)
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

  it('rejects a layout inserted during reroute registration without deleting it', () => {
    const graph = new LGraph()
    const originalLastRerouteId = graph.state.lastRerouteId
    const ydoc = getLayoutStoreYDoc()
    function insertForeignLayout(): void {
      ydoc.off('beforeTransaction', insertForeignLayout)
      const foreignReroute = new Y.Map<unknown>()
      foreignReroute.set('id', 1)
      foreignReroute.set('position', { x: 70, y: 80 })
      ydoc
        .getMap<Y.Map<unknown>>('reroutes')
        .set(`${graph.id}:1`, foreignReroute)
      throw new Error('foreign reroute listener failed')
    }
    ydoc.on('beforeTransaction', insertForeignLayout)

    expect(() => graph.setReroute({ pos: [10, 20], linkIds: [] })).toThrow(
      'foreign reroute listener failed'
    )

    expect(graph.reroutes).toHaveLength(0)
    expect(graph.state.lastRerouteId).toBe(originalLastRerouteId)
    expect(
      useRerouteStore().getReroute(graph.id, toRerouteId(1))
    ).toBeUndefined()
    const foreignLayout = ydoc
      .getMap<Y.Map<unknown>>('reroutes')
      .get(`${graph.id}:1`)
    expect(foreignLayout?.get('id')).toBe(1)
    expect(foreignLayout?.get('position')).toEqual({ x: 70, y: 80 })
  })

  it('restores reroute chain ownership when registration compensation throws', () => {
    const graph = new LGraph()
    const rerouteId = toRerouteId(999_999)
    const reroute = new Reroute(rerouteId, graph, [10, 20])
    const originalLastRerouteId = graph.state.lastRerouteId
    const originalApplyOperation = layoutStore.applyOperation.bind(layoutStore)
    const applyOperation = vi.spyOn(layoutStore, 'applyOperation')
    onTestFinished(() => applyOperation.mockRestore())
    applyOperation.mockImplementation((operation) => {
      if (operation.type === 'deleteReroute') {
        throw new Error('compensation failed')
      }
      const result = originalApplyOperation(operation)
      if (operation.type === 'createReroute') {
        throw new LayoutOperationError('registration failed', true, {
          cause: new Error('registration failed')
        })
      }
      return result
    })

    expect(() => graph._addReroute(reroute)).toThrow('registration failed')

    expect(graph.reroutes).toHaveLength(0)
    expect(graph.state.lastRerouteId).toBe(originalLastRerouteId)
    expect(useRerouteStore().getReroute(graph.id, rerouteId)).toBeUndefined()

    applyOperation.mockRestore()
    graph._addReroute(reroute)
    expect(graph.reroutes.get(reroute.id)).toBe(reroute)
    expect([...reroute.pos]).toEqual([10, 20])
  })

  it('preserves a foreign layout replacing an applied registration before failure', () => {
    const graph = new LGraph()
    const originalLastRerouteId = graph.state.lastRerouteId
    const ydoc = getLayoutStoreYDoc()
    const reroutes = ydoc.getMap<Y.Map<unknown>>('reroutes')
    let registeredKey: string | undefined
    const originalTransact = ydoc.transact.bind(ydoc)
    const transact = vi.spyOn(ydoc, 'transact')
    transact.mockImplementation((transaction, origin) => {
      originalTransact(transaction, origin)
      registeredKey = [...reroutes.keys()].find((key) =>
        key.startsWith(`${graph.id}:`)
      )
      if (!registeredKey) return
      transact.mockRestore()
      const foreignReroute = new Y.Map<unknown>()
      const rerouteId = Number(
        registeredKey.slice(registeredKey.lastIndexOf(':') + 1)
      )
      foreignReroute.set('id', rerouteId)
      foreignReroute.set('position', { x: 70, y: 80 })
      foreignReroute.set('registrationId', 'foreign-reroute')
      reroutes.set(registeredKey, foreignReroute)
      throw new Error('reroute finalization failed')
    })

    expect(() => graph.setReroute({ pos: [10, 20], linkIds: [] })).toThrow(
      'reroute finalization failed'
    )
    transact.mockRestore()

    expect(graph.reroutes).toHaveLength(0)
    expect(graph.state.lastRerouteId).toBe(originalLastRerouteId)
    expect(
      useRerouteStore().getReroute(graph.id, toRerouteId(1))
    ).toBeUndefined()
    const foreignLayout = reroutes.get(registeredKey!)
    expect(foreignLayout?.get('position')).toEqual({ x: 70, y: 80 })
    expect(foreignLayout?.get('registrationId')).toBe('foreign-reroute')
  })
})
