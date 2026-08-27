import {
  SUBGRAPH_INPUT_ID,
  SUBGRAPH_OUTPUT_ID
} from '@/lib/litegraph/src/constants'
import { describe, expect, it } from 'vitest'

import { toLinkId } from '@/types/linkId'
import { toRerouteId } from '@/types/rerouteId'
import { isUuidShapedSubgraphId } from '@/schemas/subgraphIdSchema'

import type { LGraphState } from '../LGraph'
import type {
  ExportedSubgraph,
  ISerialisedGroup,
  SerialisableLLink,
  SerialisableReroute
} from '../types/serialisation'

import {
  deduplicateSubgraphGroupIds,
  deduplicateSubgraphLinkIds,
  deduplicateSubgraphNodeIds,
  deduplicateSubgraphRerouteIds,
  normalizeSubgraphDefinitions,
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

  it('preserves original order for cyclic definitions', () => {
    const a = makeSubgraph('a', ['b'])
    const b = makeSubgraph('b', ['a'])

    expect(topologicalSortSubgraphs([b, a])).toEqual([b, a])
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

function group(id: number): ISerialisedGroup {
  return { id, title: `group-${id}`, bounding: [0, 0, 100, 100] }
}

describe('deduplicateSubgraphNodeIds', () => {
  it('patches floating link endpoints when remapping a node', () => {
    const subgraph = makeSubgraph('sg', ['dummy'])
    subgraph.floatingLinks = [chainedLink(1)]
    const state = freshState()

    const result = deduplicateSubgraphNodeIds([subgraph], new Set([1]), state)

    const remappedNodeId = result.subgraphs[0].nodes?.[0].id
    expect(result.subgraphs[0].floatingLinks?.[0].origin_id).toBe(
      remappedNodeId
    )
  })
})

describe('deduplicateSubgraphLinkIds', () => {
  it('patches every reference to a remapped regular link', () => {
    const subgraph = makeSubgraph('sg', ['dummy'])
    const node = subgraph.nodes?.[0]
    expect(node).toBeDefined()
    if (!node) return
    node.inputs = [{ name: 'in', type: 'INT', link: 1 }]
    node.outputs = [{ name: 'out', type: 'INT', links: [1] }]
    subgraph.links = [chainedLink(1)]
    subgraph.inputs = [{ id: 'input', name: 'in', type: 'INT', linkIds: [1] }]
    subgraph.outputs = [
      { id: 'output', name: 'out', type: 'INT', linkIds: [1] }
    ]
    subgraph.reroutes = [reroute(1, undefined, [1])]
    subgraph.extra = {
      linkExtensions: [{ id: toLinkId(1), parentId: toRerouteId(1) }]
    }
    const state = freshState()

    deduplicateSubgraphLinkIds([subgraph], new Set([1]), state)

    const remappedLinkId = subgraph.links[0].id
    expect(remappedLinkId).not.toBe(1)
    expect(node.inputs?.[0].link).toBe(remappedLinkId)
    expect(node.outputs?.[0].links).toEqual([remappedLinkId])
    expect(subgraph.inputs[0].linkIds).toEqual([remappedLinkId])
    expect(subgraph.outputs[0].linkIds).toEqual([remappedLinkId])
    expect(subgraph.reroutes[0].linkIds).toEqual([remappedLinkId])
    expect(subgraph.extra.linkExtensions?.[0].id).toBe(remappedLinkId)
  })

  it('keeps already unique regular and floating links unchanged', () => {
    const subgraph = makeSubgraph('sg')
    subgraph.links = [chainedLink(1)]
    subgraph.floatingLinks = [chainedLink(2)]
    deduplicateSubgraphLinkIds([subgraph], new Set(), freshState())

    expect(subgraph.links.map((link) => link.id)).toEqual([toLinkId(1)])
    expect(subgraph.floatingLinks.map((link) => link.id)).toEqual([toLinkId(2)])
  })
})

describe('normalizeSubgraphDefinitions', () => {
  it('maps repeated legacy definition IDs and their references to one UUID', () => {
    const first = makeSubgraph('legacy-id')
    first.name = 'first'
    const duplicate = makeSubgraph('legacy-id')
    duplicate.name = 'duplicate'
    const parent = makeSubgraph('parent', ['legacy-id'])
    const rootNode = makeSubgraph('root', ['legacy-id']).nodes![0]

    const result = normalizeSubgraphDefinitions(
      [first, duplicate, parent],
      {
        nodeIds: new Set(),
        groupIds: new Set(),
        linkIds: new Set(),
        rerouteIds: new Set()
      },
      freshState(),
      [rootNode]
    )
    const normalizedLegacyId = result.subgraphs[0].id

    expect(result.subgraphs).toHaveLength(2)
    expect(result.subgraphs[0].name).toBe('first')
    expect(isUuidShapedSubgraphId(normalizedLegacyId)).toBe(true)
    expect(result.subgraphs[1].nodes![0].type).toBe(normalizedLegacyId)
    expect(result.rootNodes![0].type).toBe(normalizedLegacyId)
  })

  it('keeps the first same-owner link across regular and floating links', () => {
    const subgraph = makeSubgraph('sg')
    subgraph.links = [chainedLink(1)]
    subgraph.floatingLinks = [chainedLink(1)]
    subgraph.inputs = [{ id: 'input', name: 'in', type: 'INT', linkIds: [1] }]

    const result = normalizeSubgraphDefinitions(
      [subgraph],
      {
        nodeIds: new Set(),
        groupIds: new Set(),
        linkIds: new Set(),
        rerouteIds: new Set()
      },
      freshState()
    ).subgraphs[0]

    expect(result.links).toHaveLength(1)
    expect(result.floatingLinks).toHaveLength(0)
    expect(result.links![0].id).toBe(toLinkId(1))
    expect(result.inputs![0].linkIds).toEqual([toLinkId(1)])
    expect(subgraph.floatingLinks).toHaveLength(1)
  })
})

describe('deduplicateSubgraphGroupIds', () => {
  it('remaps ids that collide with root groups', () => {
    const subgraph = makeSubgraph('sg')
    subgraph.groups = [group(1)]
    const state = freshState()

    deduplicateSubgraphGroupIds([subgraph], new Set([1]), state)

    expect(subgraph.groups[0].id).not.toBe(1)
    expect(state.lastGroupId).toBe(subgraph.groups[0].id)
  })

  it('keeps sibling subgraph group ids unique', () => {
    const first = makeSubgraph('first')
    first.groups = [group(1)]
    const second = makeSubgraph('second')
    second.groups = [group(1)]
    const state = freshState()

    deduplicateSubgraphGroupIds([first, second], new Set(), state)

    expect(first.groups[0].id).toBe(1)
    expect(second.groups[0].id).not.toBe(1)
  })

  it('skips ids already reserved by later groups', () => {
    const subgraph = makeSubgraph('sg')
    subgraph.groups = [group(1)]
    const state = freshState()

    deduplicateSubgraphGroupIds([subgraph], new Set([1, 2]), state)

    expect([1, 2]).not.toContain(subgraph.groups[0].id)
    expect(state.lastGroupId).toBe(subgraph.groups[0].id)
  })
})
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
