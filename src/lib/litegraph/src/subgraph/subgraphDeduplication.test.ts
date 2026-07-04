import {
  SUBGRAPH_INPUT_ID,
  SUBGRAPH_OUTPUT_ID
} from '@/lib/litegraph/src/constants'
import { describe, expect, it } from 'vitest'

import { toLinkId } from '@/types/linkId'
import { toRerouteId } from '@/types/rerouteId'

import type { LGraphState } from '../LGraph'
import type {
  ExportedSubgraph,
  SerialisableLLink
} from '../types/serialisation'

import {
  deduplicateSubgraphLinkIds,
  topologicalSortSubgraphs
} from './subgraphDeduplication'

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
    inputNode: { id: SUBGRAPH_INPUT_ID, bounding: [0, 0, 100, 100] },
    outputNode: { id: SUBGRAPH_OUTPUT_ID, bounding: [0, 0, 100, 100] }
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

function makeState(): LGraphState {
  return {
    lastNodeId: 0,
    lastLinkId: toLinkId(0),
    lastGroupId: 0,
    lastRerouteId: toRerouteId(0)
  }
}

function link(id: number, target: number): SerialisableLLink {
  return {
    id,
    origin_id: 3,
    origin_slot: 0,
    target_id: target,
    target_slot: 0,
    type: 'number'
  }
}

describe('deduplicateSubgraphLinkIds', () => {
  it('remaps colliding link ids and patches every reference', () => {
    const a = makeSubgraph('a')
    a.links = [link(1, 8)]
    a.nodes = [
      {
        id: 8,
        type: 'x',
        pos: [0, 0],
        size: [100, 100],
        flags: {},
        order: 0,
        mode: 0,
        inputs: [{ name: 'in', type: 'number', link: 1 }],
        outputs: [{ name: 'out', type: 'number', links: [1] }]
      }
    ] as ExportedSubgraph['nodes']
    a.inputs = [
      { id: 'io-a', name: 'a', type: 'number', linkIds: [1] }
    ] as ExportedSubgraph['inputs']
    a.reroutes = [{ id: 1, pos: [0, 0], linkIds: [1] }]

    const b = makeSubgraph('b')
    b.links = [link(1, 9)]

    // A root link already uses id 1, so both subgraph copies must be remapped.
    deduplicateSubgraphLinkIds([a, b], new Set([1]), makeState())

    const allIds = [1, a.links[0].id, b.links[0].id]
    expect(new Set(allIds).size).toBe(allIds.length)

    const aId = a.links[0].id
    expect(aId).not.toBe(1)
    expect(a.nodes![0].inputs![0].link).toBe(aId)
    expect(a.nodes![0].outputs![0].links).toEqual([aId])
    expect(a.inputs![0].linkIds).toEqual([aId])
    expect(a.reroutes![0].linkIds).toEqual([aId])
  })

  it('remaps floating-link ids within the same id space as regular links', () => {
    const a = makeSubgraph('a')
    a.links = [link(1, 8)]
    a.floatingLinks = [link(1, 9)]

    deduplicateSubgraphLinkIds([a], new Set([1]), makeState())

    const allIds = [1, a.links[0].id, a.floatingLinks[0].id]
    expect(new Set(allIds).size).toBe(allIds.length)
  })

  it('leaves non-colliding link ids untouched', () => {
    const a = makeSubgraph('a')
    a.links = [link(5, 8)]

    deduplicateSubgraphLinkIds([a], new Set([1, 2]), makeState())

    expect(a.links[0].id).toBe(5)
  })
})
