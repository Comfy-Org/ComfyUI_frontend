import { createTestingPinia } from '@pinia/testing'
import { setActivePinia } from 'pinia'
import { beforeEach, describe, expect, it } from 'vitest'

import {
  SUBGRAPH_INPUT_ID,
  SUBGRAPH_OUTPUT_ID
} from '@/lib/litegraph/src/constants'
import type { ExportedSubgraph, LGraph } from '@/lib/litegraph/src/litegraph'
import { toLinkId } from '@/types/linkId'
import { toRerouteId } from '@/types/rerouteId'

import {
  createTestSubgraph,
  createTestSubgraphNode
} from './subgraph/__fixtures__/subgraphHelpers'

function configureBoundaryLink(
  subgraph: LGraph,
  parentId: number,
  keepOld = false
): void {
  const data = subgraph.asSerialisable() as ExportedSubgraph
  data.state.lastLinkId = toLinkId(1)
  data.state.lastRerouteId = toRerouteId(parentId)
  data.links = [
    {
      id: toLinkId(1),
      type: '*',
      origin_id: SUBGRAPH_INPUT_ID,
      origin_slot: 0,
      target_id: SUBGRAPH_OUTPUT_ID,
      target_slot: 0,
      parentId: toRerouteId(parentId)
    }
  ]
  data.reroutes = [
    {
      id: toRerouteId(parentId),
      pos: [parentId, parentId],
      linkIds: [toLinkId(1)]
    }
  ]

  subgraph.configure(data, keepOld)
}

describe('LLink topology adoption identity reproduction', () => {
  beforeEach(() => setActivePinia(createTestingPinia({ stubActions: false })))

  it.fails('two subgraph definitions with identical input-to-output links keep independent reroute chains', () => {
    const first = createTestSubgraph({ inputCount: 1, outputCount: 1 })
    const rootGraph = first.rootGraph
    rootGraph.add(createTestSubgraphNode(first))
    configureBoundaryLink(first, 101)

    const second = createTestSubgraph({
      rootGraph,
      inputCount: 1,
      outputCount: 1
    })
    rootGraph.add(createTestSubgraphNode(second))

    configureBoundaryLink(second, 202)

    expect(second._links.get(toLinkId(1))?.parentId).toBe(toRerouteId(202))
  })

  it.fails('reloading a workflow with keep_old preserves the serialized reroute chain', () => {
    const subgraph = createTestSubgraph({ inputCount: 1, outputCount: 1 })
    subgraph.rootGraph.add(createTestSubgraphNode(subgraph))
    configureBoundaryLink(subgraph, 101)

    configureBoundaryLink(subgraph, 202, true)

    expect(subgraph._links.get(toLinkId(1))?.parentId).toBe(toRerouteId(202))
  })
})
