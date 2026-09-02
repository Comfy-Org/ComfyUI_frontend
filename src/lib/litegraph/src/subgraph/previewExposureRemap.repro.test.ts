import { describe, expect, it } from 'vitest'

import { createLGraphState } from '../idAllocation'
import type { ExportedSubgraph, ISerialisedNode } from '../types/serialisation'
import { deduplicateSubgraphNodeIds } from './subgraphDeduplication'

const DB = 'bbbbbbbb-1111-4111-8111-00000000000b'
const DA = 'aaaaaaaa-2222-4222-8222-00000000000a'

function sampler(id: number) {
  return { id, type: 'KSampler', pos: [0, 0], size: [10, 10] }
}

function definition(id: string, nodeId: number) {
  return {
    id,
    name: id,
    nodes: [sampler(nodeId)]
  } as unknown as ExportedSubgraph
}

describe('load-time subgraph id dedup vs previewExposures', () => {
  it('remaps a host previewExposures entry when its interior node id is reassigned', () => {
    // Both definitions use interior id 3, so the second one gets remapped.
    const subgraphs = [definition(DB, 3), definition(DA, 3)]
    const rootNodes = [
      {
        id: 1,
        type: DA,
        properties: {
          previewExposures: [
            {
              name: '$$canvas-image-preview',
              sourceNodeId: '3',
              sourcePreviewName: '$$canvas-image-preview'
            }
          ]
        }
      },
      { id: 2, type: DB, properties: {} }
    ] as unknown as ISerialisedNode[]

    const result = deduplicateSubgraphNodeIds(
      subgraphs,
      new Set([1, 2]),
      createLGraphState(),
      rootNodes
    )

    const hostA = result.rootNodes?.find((node) => node.type === DA)
    const defA = result.subgraphs.find((subgraph) => subgraph.id === DA)
    const interiorId = String(defA?.nodes?.[0]?.id)

    const exposures = hostA?.properties?.previewExposures as
      | { sourceNodeId: string }[]
      | undefined

    // The interior node was renumbered ...
    expect(interiorId).not.toBe('3')
    // ... so the exposure that points at it must follow.
    expect(exposures?.[0]?.sourceNodeId).toBe(interiorId)
  })
})
