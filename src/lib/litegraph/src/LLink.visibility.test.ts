import { createTestingPinia } from '@pinia/testing'
import { setActivePinia } from 'pinia'
import { beforeEach, describe, expect, it, vi } from 'vitest'

import { LGraph } from '@/lib/litegraph/src/litegraph'
import { createTestNode } from '@/lib/litegraph/src/__fixtures__/nodeHelpers'
import { LLink, replaceLinkTopology } from '@/lib/litegraph/src/LLink'
import {
  createTestRootGraph,
  createTestSubgraph,
  createTestSubgraphNode,
  registerTestSubgraphNodeTypes,
  resetSubgraphFixtureState
} from '@/lib/litegraph/src/subgraph/__fixtures__/subgraphHelpers'
import { useLinkPresentationStore } from '@/stores/linkPresentationStore'
import { graphScopeOf } from '@/types/graphScopeId'
import { toLinkId } from '@/types/linkId'

function makeLink(id = 1): LLink {
  return new LLink(toLinkId(id), 'MODEL', 4, 0, 5, 0)
}

beforeEach(() => {
  setActivePinia(createTestingPinia({ stubActions: false }))
  resetSubgraphFixtureState()
})

describe('LLink visibility serialization', () => {
  it('round-trips hidden and label through asSerialisable and create', () => {
    const link = makeLink()
    link.hidden = true
    link.label = 'Checkpoint'

    const restored = LLink.create(link.asSerialisable())

    expect(restored.hidden).toBe(true)
    expect(restored.label).toBe('Checkpoint')
  })

  it('omits hidden and label when unset', () => {
    const serialized = makeLink().asSerialisable()

    expect(serialized).not.toHaveProperty('hidden')
    expect(serialized).not.toHaveProperty('label')
  })

  it('copies hidden and label through configure', () => {
    const source = makeLink()
    source.hidden = true
    source.label = 'Latent'
    const target = makeLink(2)

    target.configure(source.asSerialisable())

    expect(target.hidden).toBe(true)
    expect(target.label).toBe('Latent')
  })

  it('copies presentation when configured from another LLink instance', () => {
    const source = makeLink()
    source.hidden = true
    source.label = 'Latent'
    const target = makeLink(2)

    target.configure(source)

    expect(target.id).toBe(source.id)
    expect(target.origin_id).toBe(source.origin_id)
    expect(target.target_id).toBe(source.target_id)
    expect(target.hidden).toBe(true)
    expect(target.label).toBe('Latent')
  })

  it('clears the label when set to an empty string', () => {
    const link = makeLink()
    link.label = 'Named'

    link.label = ''

    expect(link.label).toBeUndefined()
  })

  it('clears stale visibility fields when configured from a 0.4 array', () => {
    const link = makeLink()
    link.hidden = true
    link.label = 'Latent'

    link.configure(makeLink(2).serialize())

    expect(link.hidden).toBe(false)
    expect(link.label).toBeUndefined()
  })

  it('round-trips 0.4 link visibility without reroutes', () => {
    const graph = new LGraph()
    const link = makeLink()
    link.hidden = true
    link.label = 'Backbone'
    graph._addLink(link)

    const serialized = graph.serialize()

    expect(serialized.extra?.reroutes).toBeUndefined()
    expect(serialized.extra).not.toHaveProperty('linkExtensions')
    expect(serialized.extra?.linkPresentation).toEqual({
      [String(link.id)]: { hidden: true, label: 'Backbone' }
    })

    const restored = new LGraph()
    restored.configure(structuredClone(serialized))

    expect(restored.getLink(link.id)?.hidden).toBe(true)
    expect(restored.getLink(link.id)?.label).toBe('Backbone')
  })

  it('loads an old 0.4 workflow without visibility fields', () => {
    const graph = new LGraph()
    const link = makeLink()
    graph._addLink(link)
    const serialized = graph.serialize()

    const restored = new LGraph()

    expect(() => restored.configure(structuredClone(serialized))).not.toThrow()
    expect(restored.getLink(link.id)?.hidden).toBe(false)
    expect(restored.getLink(link.id)?.label).toBeUndefined()
  })

  it('clears stale presentation when reconfiguring without the record', () => {
    const graph = new LGraph()
    const link = makeLink()
    link.hidden = true
    link.label = 'Stale'
    graph._addLink(link)
    const serialized = graph.serialize()
    if (!serialized.extra) throw new Error('Expected serialized graph extra')
    delete serialized.extra.linkPresentation

    graph.configure(structuredClone(serialized))

    expect(graph.getLink(link.id)?.hidden).toBe(false)
    expect(graph.getLink(link.id)?.label).toBeUndefined()
  })

  it('round-trips an interior link through root graph definitions', () => {
    const rootGraph = createTestRootGraph()
    const subgraph = createTestSubgraph({ rootGraph })
    rootGraph.subgraphs.set(subgraph.id, subgraph)
    const source = createTestNode(subgraph, ['MODEL'], ['MODEL'])
    const target = createTestNode(subgraph, ['MODEL'], ['MODEL'])
    const link = source.connect(0, target, 0)
    if (!link) throw new Error('Failed to connect link visibility test nodes')
    link.hidden = true
    link.label = 'Interior'
    rootGraph.add(createTestSubgraphNode(subgraph, { parentGraph: rootGraph }))

    const serialized = rootGraph.asSerialisable()
    const serializedLink = serialized.definitions?.subgraphs?.[0].links?.[0]
    expect(serializedLink?.hidden).toBe(true)
    expect(serializedLink?.label).toBe('Interior')

    const restored = createTestRootGraph()
    registerTestSubgraphNodeTypes(restored)
    restored.configure(structuredClone(serialized))
    const restoredLink = restored.subgraphs
      .get(subgraph.id)
      ?.links.values()
      .next().value

    expect(restoredLink?.hidden).toBe(true)
    expect(restoredLink?.label).toBe('Interior')
  })
})

describe('link presentation store integration', () => {
  it('serializes no presentation sidecar once every link is default again', () => {
    const graph = new LGraph()
    const link = makeLink()
    graph._addLink(link)
    link.hidden = true

    expect(graph.serialize().extra?.linkPresentation).toEqual({
      '1': { hidden: true }
    })

    link.hidden = false

    expect(graph.serialize().extra?.linkPresentation).toBeUndefined()
  })

  it('drops orphaned presentation entries when the graph is cleared', () => {
    const graph = new LGraph()
    const scope = graphScopeOf(graph)
    const store = useLinkPresentationStore()
    store.patch(scope, toLinkId(999), { hidden: true })

    graph.clear()

    expect(store.take(scope, toLinkId(999))).toBeUndefined()
  })

  it('flushes buffered presentation into the store on registration', () => {
    const graph = new LGraph()
    const link = makeLink()
    link.hidden = true
    link.label = 'Buffered'

    graph._addLink(link)

    const scope = graphScopeOf(graph)
    expect(useLinkPresentationStore().getPresentation(scope, link.id)).toEqual({
      hidden: true,
      label: 'Buffered'
    })
    expect(link.hidden).toBe(true)
  })

  it('keeps presentation on an unregistered link and restores it on re-registration', () => {
    const graph = new LGraph()
    const link = makeLink()
    graph._addLink(link)
    link.hidden = true

    graph._removeLink(link.id)

    const scope = graphScopeOf(graph)
    const store = useLinkPresentationStore()
    expect(store.getPresentation(scope, link.id)).toBeUndefined()
    expect(link.hidden).toBe(true)

    graph._addLink(link)

    expect(store.getPresentation(scope, link.id)?.hidden).toBe(true)
  })

  it('carries presentation when a link moves to another root graph', () => {
    const graphA = new LGraph()
    const graphB = new LGraph()
    const link = makeLink()
    graphA._addLink(link)
    link.hidden = true
    link.label = 'Moved'
    graphA._removeLink(link.id)

    graphB._addLink(link)

    const store = useLinkPresentationStore()
    expect(store.getPresentation(graphScopeOf(graphA), link.id)).toBeUndefined()
    expect(store.getPresentation(graphScopeOf(graphB), link.id)).toEqual({
      hidden: true,
      label: 'Moved'
    })
  })

  it('a registration loser cannot plant presentation over the incumbent', () => {
    const error = vi.spyOn(console, 'error').mockImplementation(() => {})
    const graph = new LGraph()
    const winner = makeLink()
    graph._addLink(winner)
    const loser = makeLink()
    expect(graph._addLink(loser)).toBe(false)

    loser.hidden = true

    const scope = graphScopeOf(graph)
    expect(
      useLinkPresentationStore().getPresentation(scope, winner.id)
    ).toBeUndefined()
    expect(winner.hidden).toBe(false)
    expect(loser.hidden).toBe(true)
    expect(error).toHaveBeenCalledOnce()
    error.mockRestore()
  })

  it('rejects a same-id replacement and keeps the incumbent presentation', () => {
    const error = vi.spyOn(console, 'error').mockImplementation(() => {})
    const graph = new LGraph()
    const incumbent = makeLink()
    graph._addLink(incumbent)
    incumbent.hidden = true
    incumbent.label = 'Kept'
    const replacement = makeLink()

    expect(replaceLinkTopology(graph, incumbent, replacement)).toBe(false)

    const scope = graphScopeOf(graph)
    expect(
      useLinkPresentationStore().getPresentation(scope, incumbent.id)
    ).toEqual({ hidden: true, label: 'Kept' })
    expect(incumbent.hidden).toBe(true)
    expect(error).toHaveBeenCalledOnce()
    error.mockRestore()
  })
})
