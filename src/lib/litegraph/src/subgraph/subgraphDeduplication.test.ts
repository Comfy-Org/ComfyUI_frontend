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
  SerialisableLLink,
  SerialisableReroute
} from '../types/serialisation'

import {
  deduplicateSubgraphRerouteIds,
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

function reroute(
  id: number,
  parentId?: number,
  linkIds: number[] = []
): SerialisableReroute {
  return { id, parentId, pos: [0, 0], linkIds }
}

function chainedLink(id: number, parentId?: number): SerialisableLLink {
  return {
    id: toLinkId(id),
    origin_id: 1,
    origin_slot: 0,
    target_id: 2,
    target_slot: 0,
    type: 'INT',
    parentId: parentId === undefined ? undefined : toRerouteId(parentId)
  }
}

function freshState(lastRerouteId = 0): LGraphState {
  return {
    lastGroupId: 0,
    lastNodeId: 0,
    lastLinkId: toLinkId(0),
    lastRerouteId: toRerouteId(lastRerouteId)
  }
}

describe('deduplicateSubgraphRerouteIds', () => {
  it('remaps colliding reroute ids and patches parentId references', () => {
    const subgraph = makeSubgraph('sg')
    subgraph.reroutes = [reroute(1, undefined, [1]), reroute(2, 1, [1])]
    subgraph.links = [chainedLink(1, 2)]
    const state = freshState(1)

    deduplicateSubgraphRerouteIds([subgraph], new Set([1]), state)

    const [first, second] = subgraph.reroutes
    expect(first.id).not.toBe(1)
    expect(second.parentId).toBe(first.id)
    expect(subgraph.links[0].parentId).toBe(second.id)
    expect(Number(state.lastRerouteId)).toBeGreaterThanOrEqual(first.id)
  })

  it('remaps chained collisions created by the remap itself', () => {
    const subgraph = makeSubgraph('sg')
    subgraph.reroutes = [reroute(1), reroute(2, 1)]
    subgraph.links = [chainedLink(1, 2)]
    const state = freshState(1)

    deduplicateSubgraphRerouteIds([subgraph], new Set([1, 2]), state)

    const ids = subgraph.reroutes.map((r) => r.id)
    expect(new Set(ids).size).toBe(2)
    expect(ids).not.toContain(1)
    expect(ids).not.toContain(2)
    expect(subgraph.reroutes[1].parentId).toBe(subgraph.reroutes[0].id)
    expect(subgraph.links[0].parentId).toBe(subgraph.reroutes[1].id)
  })

  it('keeps sibling subgraphs from colliding with each other', () => {
    const first = makeSubgraph('first')
    first.reroutes = [reroute(1)]
    const second = makeSubgraph('second')
    second.reroutes = [reroute(1)]
    const state = freshState(0)

    deduplicateSubgraphRerouteIds([first, second], new Set(), state)

    expect(first.reroutes[0].id).toBe(1)
    expect(second.reroutes[0].id).not.toBe(1)
  })

  it('patches floating link parentId references', () => {
    const subgraph = makeSubgraph('sg')
    subgraph.reroutes = [reroute(1)]
    subgraph.floatingLinks = [chainedLink(1, 1)]
    const state = freshState(1)

    deduplicateSubgraphRerouteIds([subgraph], new Set([1]), state)

    expect(subgraph.floatingLinks[0].parentId).toBe(subgraph.reroutes[0].id)
  })

  it('reserves non-colliding ids and advances the shared counter', () => {
    const subgraph = makeSubgraph('sg')
    subgraph.reroutes = [reroute(7)]
    const state = freshState(0)

    deduplicateSubgraphRerouteIds([subgraph], new Set(), state)

    expect(subgraph.reroutes[0].id).toBe(7)
    expect(Number(state.lastRerouteId)).toBe(7)
  })
})
