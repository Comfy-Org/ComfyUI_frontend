import { describe, expect, it } from 'vitest'

import { LGraph } from '@/lib/litegraph/src/litegraph'
import {
  createTestSubgraph,
  createTestSubgraphNode
} from '@/lib/litegraph/src/subgraph/__fixtures__/subgraphHelpers'

import { createDocumentHandles } from './documentHandles'
import type { GraphResolver } from './documentHandles'

interface GraphProbe {
  resolveGraph: GraphResolver
}

const graphProbe = (resolveGraph: GraphResolver): GraphProbe => ({
  resolveGraph
})

function handlesWithProbes(
  exists: (graph: LGraph, key: string) => boolean = () => true
) {
  const handles = createDocumentHandles()
  return { handles, probes: handles.createCache<GraphProbe>(exists) }
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
    const otherKind = handles.createCache<GraphProbe>(() => true)
    const root = new LGraph()

    expect(otherKind.handleFor(root, '1', graphProbe)).not.toBe(
      probes.handleFor(root, '1', graphProbe)
    )
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

    it('retires a handle whose graph is gone', () => {
      const { handles, probes } = handlesWithProbes(() => true)
      const { root, subgraph } = rootWithPlacedSubgraph()
      const inSubgraph = probes.handleFor(subgraph, 'k', graphProbe)
      const inRoot = probes.handleFor(root, 'k', graphProbe)

      root.subgraphs.delete(subgraph.id)
      handles.afterHistoryRestore()
      root.subgraphs.set(subgraph.id, subgraph)

      expect(inSubgraph.resolveGraph()).toBeUndefined()
      expect(inRoot.resolveGraph()).toBe(root)
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
