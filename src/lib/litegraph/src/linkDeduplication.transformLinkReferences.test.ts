import { describe, expect, it } from 'vitest'

import { toLinkId } from '@/types/linkId'

import { normalizeConfiguredTopology } from './linkDeduplication'
import type { ExportedSubgraph, SerialisableGraph } from './types/serialisation'

/**
 * Parametrized coverage for the id-rewrite that `normalizeConfiguredTopology`
 * performs (via `remapLinkReferences`) across every serialized
 * reference-location kind: node `input.link`, node `output.links`, subgraph
 * boundary `linkIds`, reroute `linkIds`, and `linkExtensions`. Each location
 * is exercised under both drop modes:
 *
 * - "replace": the two links at the contested target share an origin, so the
 *   duplicate is a redundant same-origin copy. Its id is remapped to the
 *   survivor's id everywhere it is referenced.
 * - "remove": the two links at the contested target have different origins,
 *   so the loser names a connection the file recorded that must not survive.
 *   Its id is still remapped away (to the winner's id) rather than left
 *   dangling, so every other reference collapses onto the surviving link.
 *
 * A location handled in only one call site inside `remapLinkReferences` (or
 * omitted) leaves a stale id behind after either mode and fails the
 * corresponding case here.
 */

type Graph = SerialisableGraph & Partial<ExportedSubgraph>
type Mode = 'replace' | 'remove'

const SURVIVOR_ORIGIN_ID = 1
const TARGET_ID = 3
const SURVIVOR_LINK_ID = 1
const DUPLICATE_LINK_ID = 2

/** Origin node id for the duplicate link: same node in "replace", a different node in "remove". */
function duplicateOriginId(mode: Mode): number {
  return mode === 'replace' ? SURVIVOR_ORIGIN_ID : 2
}

function originNode(id: number, links: number[]) {
  return {
    id,
    type: 'test/Node',
    pos: [0, id * 150] as [number, number],
    size: [100, 100] as [number, number],
    flags: {},
    order: 0,
    mode: 0,
    inputs: [],
    outputs: [{ name: 'out', type: 'number', links }],
    properties: {}
  }
}

function targetNode() {
  return {
    id: TARGET_ID,
    type: 'test/Node',
    pos: [300, 0] as [number, number],
    size: [100, 100] as [number, number],
    flags: {},
    order: 2,
    mode: 0,
    // The input references the survivor link, so a different-origin
    // duplicate at the same slot is the one dropped, not the survivor.
    inputs: [{ name: 'in', type: 'number', link: SURVIVOR_LINK_ID }],
    outputs: [],
    properties: {}
  }
}

/**
 * Builds a graph with two links contending for the same target slot: the
 * survivor (from `SURVIVOR_ORIGIN_ID`) and a duplicate whose origin depends
 * on `mode`. `attachExtraLocation` additionally references the duplicate's
 * id through the reference-location kind under test.
 */
function buildGraph(
  mode: Mode,
  attachExtraLocation: (graph: Graph, originId: number) => void
): Graph {
  const originId = duplicateOriginId(mode)
  const nodes =
    mode === 'replace'
      ? [originNode(SURVIVOR_ORIGIN_ID, [SURVIVOR_LINK_ID]), targetNode()]
      : [
          originNode(SURVIVOR_ORIGIN_ID, [SURVIVOR_LINK_ID]),
          originNode(originId, []),
          targetNode()
        ]

  const graph: Graph = {
    id: 'll000000-0000-4000-8000-000000000001',
    version: 1,
    revision: 0,
    state: { lastNodeId: 3, lastLinkId: 2, lastGroupId: 0, lastRerouteId: 0 },
    nodes,
    links: [
      {
        id: SURVIVOR_LINK_ID,
        origin_id: SURVIVOR_ORIGIN_ID,
        origin_slot: 0,
        target_id: TARGET_ID,
        target_slot: 0,
        type: 'number'
      },
      {
        id: DUPLICATE_LINK_ID,
        origin_id: originId,
        origin_slot: 0,
        target_id: TARGET_ID,
        target_slot: 0,
        type: 'number'
      }
    ],
    groups: [],
    extra: {}
  }

  attachExtraLocation(graph, originId)
  return graph
}

interface LocationCase {
  name: string
  attach: (graph: Graph, originId: number) => void
  read: (graph: Graph, originId: number) => number[]
}

const locations: LocationCase[] = [
  {
    name: 'node input.link',
    attach: (graph, originId) => {
      // Only override in "replace" mode (survivor and duplicate share an
      // origin): there, links[] order — not which id input.link names —
      // decides the survivor, so pointing the input at the duplicate still
      // exercises a genuine remap. In "remove" mode, referencing the
      // duplicate instead of the survivor would flip which link wins under
      // remapLinkReferences' referencedInputLinks swap, changing what the
      // fixture is testing.
      if (originId === SURVIVOR_ORIGIN_ID) {
        graph.nodes!.find((n) => n.id === TARGET_ID)!.inputs![0].link =
          DUPLICATE_LINK_ID
      }
    },
    read: (graph) => {
      const link = graph.nodes!.find((n) => n.id === TARGET_ID)!.inputs![0].link
      return link == null ? [] : [link]
    }
  },
  {
    name: 'node output.links',
    attach: (graph, originId) => {
      const origin = graph.nodes!.find((n) => n.id === originId)!
      origin.outputs![0].links = [
        ...(origin.outputs![0].links ?? []),
        DUPLICATE_LINK_ID
      ]
    },
    read: (graph, originId) =>
      graph.nodes!.find((n) => n.id === originId)!.outputs![0].links ?? []
  },
  {
    name: 'subgraph boundary linkIds',
    attach: (graph) => {
      graph.outputs = [
        {
          id: 'aa000000-0000-4000-8000-000000000002',
          name: 'boundary_out',
          type: 'number',
          linkIds: [DUPLICATE_LINK_ID]
        }
      ]
    },
    read: (graph) => graph.outputs![0].linkIds ?? []
  },
  {
    name: 'reroute linkIds',
    attach: (graph) => {
      graph.reroutes = [{ id: 1, pos: [0, 0], linkIds: [DUPLICATE_LINK_ID] }]
    },
    read: (graph) => graph.reroutes![0].linkIds
  },
  {
    name: 'linkExtensions',
    attach: (graph) => {
      graph.extra = {
        linkExtensions: [
          { id: toLinkId(DUPLICATE_LINK_ID), parentId: undefined }
        ]
      }
    },
    read: (graph) =>
      (graph.extra!.linkExtensions ?? []).map((extension) => extension.id)
  }
]

describe('normalizeConfiguredTopology reference-location coverage (#15973)', () => {
  it.for(locations)(
    '$name replace mode: same-origin duplicate id is remapped to the survivor everywhere',
    ({ attach, read }) => {
      const graph = buildGraph('replace', attach)

      const result = normalizeConfiguredTopology(graph)

      const ids = read(result, duplicateOriginId('replace'))
      expect(ids).not.toContain(DUPLICATE_LINK_ID)
      expect(ids.every((id) => id === SURVIVOR_LINK_ID)).toBe(true)
    }
  )

  it.for(locations)(
    '$name remove mode: different-origin duplicate id is pruned from every reference',
    ({ attach, read }) => {
      const graph = buildGraph('remove', attach)

      const result = normalizeConfiguredTopology(graph)

      const ids = read(result, duplicateOriginId('remove'))
      expect(ids).not.toContain(DUPLICATE_LINK_ID)
    }
  )
})
