import { describe, expect, it, onTestFinished, vi } from 'vitest'

import { LGraph } from '@/lib/litegraph/src/litegraph'
import { createTestNode } from '@/lib/litegraph/src/__fixtures__/nodeHelpers'
import { LLink, replaceLinkTopology } from '@/lib/litegraph/src/LLink'
import {
  createTestRootGraph,
  createTestSubgraph,
  createTestSubgraphNode,
  enableSubgraphNodeCreation
} from '@/lib/litegraph/src/subgraph/__fixtures__/subgraphHelpers'
import { useLinkPresentationStore } from '@/stores/linkPresentationStore'
import { graphScopeOf } from '@/types/graphScopeId'
import { toLinkId } from '@/types/linkId'
import { UNASSIGNED_NODE_ID } from '@/types/nodeId'

function makeLink(id = 1): LLink {
  return new LLink(toLinkId(id), 'MODEL', 4, 0, 5, 0)
}

describe('graph link presentation serialization', () => {
  it.for([
    { version: 0.4, label: 'Backbone' },
    { version: 1, label: 'Backbone' },
    { version: 0.4, label: '' },
    { version: 1, label: '' }
  ])('round-trips $label through schema $version', ({ version, label }) => {
    const graph = new LGraph()
    const link = makeLink()
    graph._addLink(link)
    const store = useLinkPresentationStore()
    store.patch(graphScopeOf(graph), link.id, { hidden: true, label })

    const serialized =
      version === 0.4 ? graph.serialize() : graph.asSerialisable()
    const restored = new LGraph()
    restored.configure(structuredClone(serialized))

    expect(restored.getLink(link.id)).toBeDefined()
    expect(store.getPresentation(graphScopeOf(restored), link.id)).toEqual({
      hidden: true,
      label
    })
  })

  it('omits the sidecar again when all presentation fields are cleared', () => {
    const graph = new LGraph()
    const link = makeLink()
    graph._addLink(link)
    const store = useLinkPresentationStore()
    const scope = graphScopeOf(graph)
    const before = graph.serialize()

    store.patch(scope, link.id, { hidden: true, label: 'Backbone' })

    expect(graph.serialize().extra?.linkPresentation).toEqual({
      '1': { hidden: true, label: 'Backbone' }
    })
    expect(graph.serialize().extra).not.toHaveProperty('linkExtensions')

    store.patch(scope, link.id, { hidden: false, label: undefined })

    expect(graph.serialize()).toEqual(before)
  })

  it('loads an old workflow without presentation fields', () => {
    const graph = new LGraph()
    const link = makeLink()
    graph._addLink(link)
    const serialized = graph.serialize()
    const restored = new LGraph()

    restored.configure(structuredClone(serialized))

    expect(restored.getLink(link.id)?.asSerialisable()).toEqual(
      link.asSerialisable()
    )
    expect(
      useLinkPresentationStore().getPresentation(
        graphScopeOf(restored),
        link.id
      )
    ).toBeUndefined()
    expect(restored.serialize().extra).not.toHaveProperty('linkPresentation')
  })

  it('clears stale presentation when reconfiguring without the sidecar', () => {
    const graph = new LGraph()
    const link = makeLink()
    graph._addLink(link)
    const serialized = graph.serialize()
    const store = useLinkPresentationStore()
    store.patch(graphScopeOf(graph), link.id, { hidden: true, label: 'Stale' })

    graph.configure(structuredClone(serialized))

    expect(graph.getLink(link.id)).toBeDefined()
    expect(store.getPresentation(graphScopeOf(graph), link.id)).toBeUndefined()
  })

  it('does not attach noncanonical sidecar keys to an existing link', () => {
    const graph = new LGraph()
    const link = makeLink()
    graph._addLink(link)
    const serialized = graph.serialize()
    serialized.extra = { linkPresentation: { '01': { hidden: true } } }

    graph.configure(serialized)

    expect(
      useLinkPresentationStore().getPresentation(graphScopeOf(graph), link.id)
    ).toBeUndefined()
  })

  it('a duplicate serialized link cannot overwrite the first link presentation', () => {
    vi.spyOn(console, 'error').mockImplementation(() => {})
    const graph = new LGraph()
    const link = makeLink()
    const serialized = {
      ...graph.asSerialisable(),
      links: [
        { ...link.asSerialisable(), label: 'First' },
        { ...link.asSerialisable(), label: 'Duplicate' }
      ]
    }

    graph.configure(serialized)

    expect(
      useLinkPresentationStore().getPresentation(graphScopeOf(graph), link.id)
    ).toEqual({ label: 'First' })
  })

  it('round-trips an interior link through root graph definitions', () => {
    const rootGraph = createTestRootGraph()
    const subgraph = createTestSubgraph({ rootGraph })
    rootGraph.subgraphs.set(subgraph.id, subgraph)
    const source = createTestNode(subgraph, ['MODEL'], ['MODEL'])
    const target = createTestNode(subgraph, ['MODEL'], ['MODEL'])
    const link = source.connect(0, target, 0)
    if (!link) throw new Error('Failed to connect link presentation test nodes')
    const store = useLinkPresentationStore()
    store.patch(graphScopeOf(subgraph), link.id, {
      hidden: true,
      label: 'Interior'
    })
    rootGraph.add(createTestSubgraphNode(subgraph, { parentGraph: rootGraph }))

    const serialized = rootGraph.asSerialisable()
    expect(serialized.definitions?.subgraphs?.[0].links?.[0]).toMatchObject({
      hidden: true,
      label: 'Interior'
    })

    const restored = createTestRootGraph()
    onTestFinished(enableSubgraphNodeCreation(restored))
    restored.configure(structuredClone(serialized))
    const restoredSubgraph = restored.subgraphs.get(subgraph.id)
    if (!restoredSubgraph) throw new Error('Expected restored subgraph')

    expect(
      store.getPresentation(graphScopeOf(restoredSubgraph), link.id)
    ).toEqual({
      hidden: true,
      label: 'Interior'
    })
    expect(
      store.getPresentation(graphScopeOf(restored), link.id)
    ).toBeUndefined()
  })

  it('loads floating-link presentation under its reminted ID', () => {
    const graph = new LGraph()
    const link = makeLink()
    graph._addLink(link)
    const serialized = {
      ...graph.asSerialisable(),
      floatingLinks: [
        {
          ...link.asSerialisable(),
          target_id: UNASSIGNED_NODE_ID,
          target_slot: -1,
          hidden: true,
          label: 'Floating'
        }
      ]
    }

    graph.configure(serialized)

    const floatingLink = graph.floatingLinks.values().next().value
    if (!floatingLink) throw new Error('Expected restored floating link')
    const store = useLinkPresentationStore()
    const scope = graphScopeOf(graph)
    expect(floatingLink.id).not.toBe(link.id)
    expect(store.getPresentation(scope, link.id)).toBeUndefined()
    expect(store.getPresentation(scope, floatingLink.id)).toEqual({
      hidden: true,
      label: 'Floating'
    })
    expect(graph.asSerialisable().floatingLinks?.[0]).toMatchObject({
      hidden: true,
      label: 'Floating'
    })
  })
})

describe('link presentation ownership', () => {
  it('drops orphaned presentation entries when the graph is cleared', () => {
    const graph = new LGraph()
    const scope = graphScopeOf(graph)
    const store = useLinkPresentationStore()
    store.patch(scope, toLinkId(999), { hidden: true })

    graph.clear()

    expect(store.getPresentation(scope, toLinkId(999))).toBeUndefined()
  })

  it('removing a link clears its presentation before the ID is reused', () => {
    const graph = new LGraph()
    const link = makeLink()
    graph._addLink(link)
    const store = useLinkPresentationStore()
    const scope = graphScopeOf(graph)
    store.patch(scope, link.id, { hidden: true })

    graph._removeLink(link.id)
    graph._addLink(makeLink())

    expect(store.getPresentation(scope, link.id)).toBeUndefined()
  })

  it('moves presentation explicitly between root scopes', () => {
    const graphA = new LGraph()
    const graphB = new LGraph()
    const link = makeLink()
    graphA._addLink(link)
    const store = useLinkPresentationStore()
    store.patch(graphScopeOf(graphA), link.id, { hidden: true, label: 'Moved' })

    const presentation = store.take(graphScopeOf(graphA), link.id)
    graphA._removeLink(link.id)
    if (graphB._addLink(link) && presentation) {
      store.patch(graphScopeOf(graphB), link.id, presentation)
    }

    expect(store.getPresentation(graphScopeOf(graphA), link.id)).toBeUndefined()
    expect(store.getPresentation(graphScopeOf(graphB), link.id)).toEqual({
      hidden: true,
      label: 'Moved'
    })
  })

  it('keeps identical link IDs isolated between roots', () => {
    const graphA = new LGraph()
    const graphB = new LGraph()
    const linkA = makeLink()
    const linkB = makeLink()
    graphA._addLink(linkA)
    graphB._addLink(linkB)
    const store = useLinkPresentationStore()
    store.patch(graphScopeOf(graphA), linkA.id, { label: 'A' })
    store.patch(graphScopeOf(graphB), linkB.id, { label: 'B' })

    graphA._removeLink(linkA.id)

    expect(store.getPresentation(graphScopeOf(graphB), linkB.id)).toEqual({
      label: 'B'
    })
  })

  it('rejects a same-id replacement and keeps the incumbent presentation', () => {
    const error = vi.spyOn(console, 'error').mockImplementation(() => {})
    const graph = new LGraph()
    const incumbent = makeLink()
    graph._addLink(incumbent)
    const store = useLinkPresentationStore()
    const scope = graphScopeOf(graph)
    store.patch(scope, incumbent.id, { hidden: true, label: 'Kept' })

    expect(replaceLinkTopology(graph, incumbent, makeLink())).toBe(false)

    expect(store.getPresentation(scope, incumbent.id)).toEqual({
      hidden: true,
      label: 'Kept'
    })
    expect(error).toHaveBeenCalledOnce()
  })
})
