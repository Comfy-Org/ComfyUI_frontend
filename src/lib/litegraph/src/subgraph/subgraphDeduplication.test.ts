import {
  SUBGRAPH_INPUT_ID,
  SUBGRAPH_OUTPUT_ID
} from '@/lib/litegraph/src/constants'
import { describe, expect, it, vi } from 'vitest'

import type { LGraphState } from '@/lib/litegraph/src/LGraph'
import { toLinkId } from '@/types/linkId'
import { toRerouteId } from '@/types/rerouteId'

import type { ExportedSubgraph, ISerialisedNode } from '../types/serialisation'

import {
  deduplicateSubgraphNodeIds,
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

describe('deduplicateSubgraphNodeIds', () => {
  it('remaps duplicate IDs in nodes, links, promoted widgets, and root proxy widgets', () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {})
    const subgraph = makeSubgraph('inner')
    subgraph.nodes = [
      {
        id: 1,
        type: 'Source',
        pos: [0, 0],
        size: [100, 100],
        flags: {},
        order: 0,
        mode: 0,
        inputs: [],
        outputs: [],
        properties: {}
      },
      {
        id: 2,
        type: 'Target',
        pos: [0, 0],
        size: [100, 100],
        flags: {},
        order: 1,
        mode: 0,
        inputs: [],
        outputs: [],
        properties: {}
      }
    ]
    subgraph.links = [
      {
        id: 1,
        origin_id: 1,
        origin_slot: 0,
        target_id: 2,
        target_slot: 0,
        type: '*'
      }
    ]
    subgraph.widgets = [
      {
        id: 1,
        name: 'text'
      }
    ]
    const rootNodes: ISerialisedNode[] = [
      {
        id: 10,
        type: 'inner',
        pos: [0, 0],
        size: [100, 100],
        flags: {},
        order: 0,
        mode: 0,
        inputs: [],
        outputs: [],
        properties: {
          proxyWidgets: [[1, 'text'], 'not-an-entry']
        }
      },
      {
        id: 11,
        type: 'Other',
        pos: [0, 0],
        size: [100, 100],
        flags: {},
        order: 1,
        mode: 0,
        inputs: [],
        outputs: [],
        properties: {
          proxyWidgets: [[1, 'text']]
        }
      }
    ]
    const state: LGraphState = {
      lastNodeId: 2,
      lastLinkId: toLinkId(0),
      lastGroupId: 0,
      lastRerouteId: toRerouteId(0)
    }

    const result = deduplicateSubgraphNodeIds(
      [subgraph],
      new Set([1]),
      state,
      rootNodes
    )

    expect(result.subgraphs[0].nodes?.[0].id).toBe(3)
    expect(result.subgraphs[0].links?.[0]).toMatchObject({
      origin_id: 3,
      target_id: 2
    })
    expect(result.subgraphs[0].widgets?.[0].id).toBe(3)
    expect(result.rootNodes?.[0].properties?.proxyWidgets).toEqual([
      ['3', 'text'],
      'not-an-entry'
    ])
    expect(result.rootNodes?.[1].properties?.proxyWidgets).toEqual([
      [1, 'text']
    ])
    expect(subgraph.nodes?.[0].id).toBe(1)
    expect(rootNodes[0].properties?.proxyWidgets).toEqual([
      [1, 'text'],
      'not-an-entry'
    ])
    expect(state.lastNodeId).toBe(3)
    expect(warn).toHaveBeenCalledWith(
      'LiteGraph: duplicate subgraph node ID 1 remapped to 3'
    )

    warn.mockRestore()
  })

  it('tracks numeric IDs without root nodes and ignores non-numeric IDs', () => {
    const subgraph = makeSubgraph('ids')
    subgraph.nodes = [
      {
        id: '9',
        type: 'NumericString',
        pos: [0, 0],
        size: [100, 100],
        flags: {},
        order: 0,
        mode: 0,
        inputs: [],
        outputs: [],
        properties: {}
      },
      {
        id: 'alpha',
        type: 'NamedNode',
        pos: [0, 0],
        size: [100, 100],
        flags: {},
        order: 1,
        mode: 0,
        inputs: [],
        outputs: [],
        properties: {}
      }
    ]
    const state: LGraphState = {
      lastNodeId: 1,
      lastLinkId: toLinkId(0),
      lastGroupId: 0,
      lastRerouteId: toRerouteId(0)
    }

    const result = deduplicateSubgraphNodeIds([subgraph], new Set(), state)

    expect(result.rootNodes).toBeUndefined()
    expect(result.subgraphs[0].nodes?.map((node) => node.id)).toEqual([
      '9',
      'alpha'
    ])
    expect(state.lastNodeId).toBe(9)
  })

  it('throws when the numeric node ID space is exhausted', () => {
    const subgraph = makeSubgraph('full')
    subgraph.nodes = [
      {
        id: 1,
        type: 'Duplicate',
        pos: [0, 0],
        size: [100, 100],
        flags: {},
        order: 0,
        mode: 0,
        inputs: [],
        outputs: [],
        properties: {}
      }
    ]
    const state: LGraphState = {
      lastNodeId: 100_000_000,
      lastLinkId: toLinkId(0),
      lastGroupId: 0,
      lastRerouteId: toRerouteId(0)
    }

    expect(() =>
      deduplicateSubgraphNodeIds([subgraph], new Set([1]), state)
    ).toThrow('Node ID space exhausted')
  })
})

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

  it('returns original order when dependencies contain a cycle', () => {
    const a = makeSubgraph('a', ['b'])
    const b = makeSubgraph('b', ['a'])

    expect(topologicalSortSubgraphs([a, b])).toEqual([a, b])
  })
})
