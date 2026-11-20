import { describe, expect, it, vi } from 'vitest'

import { LGraph } from '@/lib/litegraph/src/litegraph'
import {
  createTestSubgraph,
  createTestSubgraphNode
} from '@/lib/litegraph/src/subgraph/__fixtures__/subgraphHelpers'

import { createDocumentHandles, isReissuable } from './documentHandles'
import type { GraphResolver } from './documentHandles'

interface GraphProbe {
  resolveGraph: GraphResolver
}

const graphProbe = (resolveGraph: GraphResolver): GraphProbe => ({
  resolveGraph
})

function handlesWithProbes(
  exists: (graph: LGraph, key: string) => boolean = () => true,
  reissuable?: (graph: LGraph, key: string) => boolean
) {
  const handles = createDocumentHandles()
  const cache = handles.createCache<GraphProbe, LGraph>(reissuable)
  const probes = {
    handleFor: (
      graph: LGraph,
      key: string,
      make: (resolveGraph: GraphResolver) => GraphProbe
    ) =>
      cache.handleFor(
        graph,
        key,
        (current) => (exists(current, key) ? current : undefined),
        (_locate, resolveGraph) => make(resolveGraph)
      ),
    locator: cache.locator
  }
  return { handles, probes }
}

function rootWithPlacedSubgraph() {
  const root = new LGraph()
  const subgraph = createTestSubgraph({ rootGraph: root })
  root.subgraphs.set(subgraph.id, subgraph)
  root.add(createTestSubgraphNode(subgraph, { parentGraph: root }))
  return { root, subgraph }
}

describe('document handles', () => {
  it('gives one handle per key in a graph, and a different one per graph', () => {
    const { probes } = handlesWithProbes()
    const { root, subgraph } = rootWithPlacedSubgraph()

    const first = probes.handleFor(root, '1', graphProbe)

    expect(probes.handleFor(root, '1', graphProbe)).toBe(first)
    expect(probes.handleFor(root, '2', graphProbe)).not.toBe(first)
    expect(probes.handleFor(subgraph, '1', graphProbe)).not.toBe(first)
  })

  it('keeps the handles of each kind apart', () => {
    const { handles, probes } = handlesWithProbes()
    const otherKind = handles.createCache<GraphProbe, LGraph>()
    const root = new LGraph()

    expect(
      otherKind.handleFor(
        root,
        '1',
        (graph) => graph,
        (_locate, resolveGraph) => graphProbe(resolveGraph)
      )
    ).not.toBe(probes.handleFor(root, '1', graphProbe))
  })

  it('finds each graph by its own id', () => {
    const { probes } = handlesWithProbes()
    const { root, subgraph } = rootWithPlacedSubgraph()

    expect(probes.handleFor(root, 'k', graphProbe).resolveGraph()).toBe(root)
    expect(probes.handleFor(subgraph, 'k', graphProbe).resolveGraph()).toBe(
      subgraph
    )
  })

  it('finds a subgraph again after undo rebuilds it as a new object', () => {
    const { probes } = handlesWithProbes()
    const { root, subgraph } = rootWithPlacedSubgraph()
    const handle = probes.handleFor(subgraph, 'k', graphProbe)

    root.configure(root.serialize())
    const rebuilt = root.subgraphs.get(subgraph.id)

    expect(rebuilt).toBeDefined()
    expect(rebuilt).not.toBe(subgraph)
    expect(handle.resolveGraph()).toBe(rebuilt)
  })

  it('loses a subgraph that is removed from its document', () => {
    const { probes } = handlesWithProbes()
    const { root, subgraph } = rootWithPlacedSubgraph()
    const handle = probes.handleFor(subgraph, 'k', graphProbe)

    root.subgraphs.delete(subgraph.id)

    expect(handle.resolveGraph()).toBeUndefined()
  })

  it('loses a cleared root graph until undo brings it back', () => {
    const { probes } = handlesWithProbes()
    const root = new LGraph()
    const handle = probes.handleFor(root, 'k', graphProbe)
    const beforeClear = root.serialize()

    root.clear()

    expect(handle.resolveGraph()).toBeUndefined()

    root.configure(beforeClear)

    expect(handle.resolveGraph()).toBe(root)
  })

  it('retires every earlier handle when another document begins', () => {
    const { handles, probes } = handlesWithProbes()
    const root = new LGraph()
    const earlier = probes.handleFor(root, 'k', graphProbe)

    handles.beginDocument()
    const later = probes.handleFor(root, 'k', graphProbe)

    expect(earlier.resolveGraph()).toBeUndefined()
    expect(later).not.toBe(earlier)
    expect(later.resolveGraph()).toBe(root)
  })

  describe('after an undo or redo', () => {
    it('keeps the handles whose entity is still there', () => {
      const { handles, probes } = handlesWithProbes(() => true)
      const root = new LGraph()
      const kept = probes.handleFor(root, 'k', graphProbe)

      handles.afterHistoryRestore()

      expect(kept.resolveGraph()).toBe(root)
      expect(probes.handleFor(root, 'k', graphProbe)).toBe(kept)
    })

    it('retires a handle whose entity is gone, and makes a new one for the key', () => {
      const present = new Set(['gone', 'stays'])
      const { handles, probes } = handlesWithProbes((_, key) =>
        present.has(key)
      )
      const root = new LGraph()
      const gone = probes.handleFor(root, 'gone', graphProbe)
      const stays = probes.handleFor(root, 'stays', graphProbe)

      present.delete('gone')
      handles.afterHistoryRestore()
      present.add('gone')

      expect(gone.resolveGraph()).toBeUndefined()
      expect(stays.resolveGraph()).toBe(root)
      const replacement = probes.handleFor(root, 'gone', graphProbe)
      expect(replacement).not.toBe(gone)
      expect(replacement.resolveGraph()).toBe(root)
      expect(handles.owns(gone)).toBe(true)
    })

    it('retires a handle whose graph is gone, even one whose key cannot be given again', () => {
      const { handles, probes } = handlesWithProbes(
        () => true,
        () => false
      )
      const { root, subgraph } = rootWithPlacedSubgraph()
      const inSubgraph = probes.handleFor(subgraph, 'k', graphProbe)
      const inRoot = probes.handleFor(root, 'k', graphProbe)

      root.subgraphs.delete(subgraph.id)
      handles.afterHistoryRestore()
      root.subgraphs.set(subgraph.id, subgraph)

      expect(inSubgraph.resolveGraph()).toBeUndefined()
      expect(inRoot.resolveGraph()).toBe(root)
    })

    it('keeps a handle whose entity is gone while its key cannot be given again, until a restore finds that it can', () => {
      const present = new Set<string>()
      const reissuable = new Set<string>()
      const { handles, probes } = handlesWithProbes(
        (_, key) => present.has(key),
        (_, key) => reissuable.has(key)
      )
      const root = new LGraph()
      const handle = probes.handleFor(root, 'k', graphProbe)

      handles.afterHistoryRestore()
      expect(handle.resolveGraph()).toBe(root)
      expect(probes.handleFor(root, 'k', graphProbe)).toBe(handle)

      reissuable.add('k')
      handles.afterHistoryRestore()
      present.add('k')

      expect(handle.resolveGraph()).toBeUndefined()
      expect(probes.handleFor(root, 'k', graphProbe)).not.toBe(handle)
    })
  })

  describe('whether a counter could give an id again', () => {
    it('says no for a counted id at or below the last one given', () => {
      expect(isReissuable('3', 3)).toBe(false)
      expect(isReissuable('0', 3)).toBe(false)
    })

    it('says yes for an id above the last one given, and for one no counter gives', () => {
      expect(isReissuable('4', 3)).toBe(true)
      expect(isReissuable('2.5', 3)).toBe(true)
      expect(isReissuable('named', 3)).toBe(true)
      expect(isReissuable(String(Number.MAX_SAFE_INTEGER + 2), Infinity)).toBe(
        true
      )
    })
  })

  it('knows the handles it made from anything else', () => {
    const { handles, probes } = handlesWithProbes()
    const other = createDocumentHandles()
    const root = new LGraph()
    const handle = probes.handleFor(root, 'k', graphProbe)

    expect(handles.owns(handle)).toBe(true)
    expect(other.owns(handle)).toBe(false)
    expect(handles.owns({ ...handle })).toBe(false)
    expect(handles.owns('1')).toBe(false)
    expect(handles.owns(null)).toBe(false)
  })
})

describe('holding the handles of gone entities', () => {
  class CollectedWeakRef {
    deref(): undefined {
      return undefined
    }
  }

  function cacheOverOneGraph() {
    vi.stubGlobal('WeakRef', CollectedWeakRef)
    const graph = new LGraph()
    const present = new Set(['1', '2'])
    const { handles, probes } = handlesWithProbes(
      (_graph, key) => present.has(key),
      () => false
    )
    const handleFor = (key: string) => probes.handleFor(graph, key, graphProbe)
    return { handles, present, handleFor }
  }

  it("keeps a gone entity's handle until its entity returns, so a WeakMap keyed by it keeps its entry", () => {
    const { handles, present, handleFor } = cacheOverOneGraph()
    const state = new WeakMap([[handleFor('1'), 'kept']])
    present.delete('1')

    handles.afterHistoryRestore()
    for (let key = 3; key < 1000; key++) handleFor(String(key))
    handles.afterHistoryRestore()
    present.add('1')

    expect(state.get(handleFor('1'))).toBe('kept')
  })
})
