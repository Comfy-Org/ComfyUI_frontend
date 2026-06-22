import { describe, expect, it } from 'vitest'

import type { LGraphState } from './LGraph'
import type { SerialisedLLinkArray } from './LLink'
import { normalizeStringNodeIds } from './nodeIdNormalization'
import type {
  ISerialisedGraph,
  ISerialisedNode,
  SerialisableGraph
} from './types/serialisation'

function createState(lastNodeId = 0): LGraphState {
  return { lastNodeId, lastLinkId: 0, lastGroupId: 0, lastRerouteId: 0 }
}

function node(id: unknown): ISerialisedNode {
  return { id } as unknown as ISerialisedNode
}

function v04Graph(
  nodes: ISerialisedNode[],
  links: (string | number)[][],
  lastNodeId = 0
): ISerialisedGraph {
  return {
    id: 'test',
    revision: 0,
    version: 0.4,
    config: {},
    last_node_id: lastNodeId,
    last_link_id: 0,
    groups: [],
    nodes,
    links: links as unknown as SerialisedLLinkArray[]
  } as unknown as ISerialisedGraph
}

describe('normalizeStringNodeIds', () => {
  it('returns the input untouched when all ids are numeric', () => {
    const data = v04Graph([node(1), node(2)], [])
    expect(normalizeStringNodeIds(data, createState())).toBe(data)
  })

  it('remaps non-integer string ids and patches v0.4 array links', () => {
    const data = v04Graph(
      [node('CheckpointLoaderSimple.0'), node('KSampler.0')],
      [[10, 'CheckpointLoaderSimple.0', 0, 'KSampler.0', 0, 'MODEL']]
    )

    const state = createState()
    const result = normalizeStringNodeIds(data, state)

    expect(result).not.toBe(data)
    expect(result.nodes.map((n) => n.id)).toEqual([1, 2])
    expect(result.nodes.every((n) => typeof n.id === 'number')).toBe(true)
    expect(result.links[0][1]).toBe(1)
    expect(result.links[0][3]).toBe(2)
    expect(state.lastNodeId).toBe(2)
    expect(result.last_node_id).toBe(2)
  })

  it('does not mutate the caller input', () => {
    const data = v04Graph([node('A.0')], [[10, 'A.0', 0, 'A.0', 1, 'STRING']])

    normalizeStringNodeIds(data, createState())

    expect(data.nodes[0].id).toBe('A.0')
    expect(data.links[0][1]).toBe('A.0')
  })

  it('allocates ids that do not collide with existing numeric ids', () => {
    const data = v04Graph([node('A.0'), node(10)], [], 5)

    const result = normalizeStringNodeIds(data, createState())

    expect(result.nodes[0].id).toBe(11)
    expect(result.nodes[1].id).toBe(10)
  })

  it('leaves newer numeric-id schemas untouched', () => {
    const data: SerialisableGraph = {
      id: 'test',
      revision: 0,
      version: 1,
      config: {},
      state: { lastNodeId: 0, lastLinkId: 0, lastGroupId: 0, lastRerouteId: 0 },
      nodes: [node(1), node(2)],
      links: [],
      groups: []
    }
    expect(normalizeStringNodeIds(data, createState())).toBe(data)
  })
})
