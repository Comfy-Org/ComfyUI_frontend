import { describe, expect, it } from 'vitest'

import type { ExportedSubgraph } from '../types/serialisation'

import { topologicalSortSubgraphs } from './subgraphDeduplication'

function makeSubgraph(id: string, nodeTypes: string[] = []): ExportedSubgraph {
  return {
    id,
    name: id,
    version: 1,
    revision: 0,
    state: { lastNodeId: 0, lastLinkId: 0, lastGroupId: 0, lastRerouteId: 0 },
    nodes: nodeTypes.map((type, i) => ({
      id: i + 1,
      type,
      pos: [0, 0] as [number, number],
      size: [100, 100] as [number, number],
      flags: {},
      order: i,
      mode: 0,
      inputs: [],
      outputs: [],
      properties: {}
    })),
    inputNode: { id: -10, bounding: [0, 0, 100, 100] },
    outputNode: { id: -20, bounding: [0, 0, 100, 100] }
  } as ExportedSubgraph
}

describe('topologicalSortSubgraphs', () => {
  it('returns original order when there are no dependencies', () => {
    const a = makeSubgraph('a')
    const b = makeSubgraph('b')
    const result = topologicalSortSubgraphs([a, b])
    expect(result).toEqual([a, b])
  })

  it('sorts leaf dependencies before their parents', () => {
    const inner = makeSubgraph('inner', ['StringConcat'])
    const outer = makeSubgraph('outer', ['inner'])
    const result = topologicalSortSubgraphs([outer, inner])
    expect(result.map((s) => s.id)).toEqual(['inner', 'outer'])
  })

  it('handles three-level nesting', () => {
    const leaf = makeSubgraph('leaf', ['StringConcat'])
    const mid = makeSubgraph('mid', ['leaf', 'StringConcat'])
    const top = makeSubgraph('top', ['mid'])
    const result = topologicalSortSubgraphs([top, mid, leaf])
    expect(result.map((s) => s.id)).toEqual(['leaf', 'mid', 'top'])
  })

  it('handles diamond dependencies', () => {
    const shared = makeSubgraph('shared')
    const left = makeSubgraph('left', ['shared'])
    const right = makeSubgraph('right', ['shared'])
    const top = makeSubgraph('top', ['left', 'right'])
    const result = topologicalSortSubgraphs([top, left, right, shared])
    const ids = result.map((s) => s.id)
    expect(ids.indexOf('shared')).toBeLessThan(ids.indexOf('left'))
    expect(ids.indexOf('shared')).toBeLessThan(ids.indexOf('right'))
    expect(ids.indexOf('left')).toBeLessThan(ids.indexOf('top'))
    expect(ids.indexOf('right')).toBeLessThan(ids.indexOf('top'))
  })

  it('returns original order for a single subgraph', () => {
    const only = makeSubgraph('only')
    const result = topologicalSortSubgraphs([only])
    expect(result).toEqual([only])
  })

  it('returns original order for empty array', () => {
    expect(topologicalSortSubgraphs([])).toEqual([])
  })
})
