import { createTestingPinia } from '@pinia/testing'
import { setActivePinia } from 'pinia'
import { beforeEach, describe, expect, it } from 'vitest'

import {
  SUBGRAPH_INPUT_ID,
  SUBGRAPH_OUTPUT_ID
} from '@/lib/litegraph/src/constants'
import type { ExportedSubgraph, LGraph } from '@/lib/litegraph/src/litegraph'
import { useLinkStore } from '@/stores/linkStore'
import { useRerouteStore } from '@/stores/rerouteStore'
import { graphScopeOf } from '@/types/graphScopeId'
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

describe('LLink configure topology rebuild', () => {
  beforeEach(() => setActivePinia(createTestingPinia({ stubActions: false })))

  it('two subgraph definitions with identical input-to-output links keep independent reroute chains', () => {
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

  it('reloading a workflow with keep_old preserves the serialized reroute chain', () => {
    const subgraph = createTestSubgraph({ inputCount: 1, outputCount: 1 })
    subgraph.rootGraph.add(createTestSubgraphNode(subgraph))
    configureBoundaryLink(subgraph, 101)

    configureBoundaryLink(subgraph, 202, true)

    expect(subgraph._links.get(toLinkId(1))?.parentId).toBe(toRerouteId(202))
  })

  it('removes stale owner topology omitted by a keep_old payload', () => {
    const subgraph = createTestSubgraph({ inputCount: 1, outputCount: 1 })
    subgraph.rootGraph.add(createTestSubgraphNode(subgraph))
    configureBoundaryLink(subgraph, 101)
    const data = subgraph.asSerialisable() as ExportedSubgraph
    data.links = []
    data.reroutes = []

    subgraph.configure(data, true)

    const scope = graphScopeOf(subgraph)
    expect([...useLinkStore().graphTopologies(scope)]).toHaveLength(0)
    expect(
      useRerouteStore().getReroute(scope, toRerouteId(101))
    ).toBeUndefined()
    expect(subgraph.links.size).toBe(0)
    expect(subgraph.reroutes.size).toBe(0)
  })

  it('repeatedly rebuilds the same serialized topology deterministically', () => {
    const subgraph = createTestSubgraph({ inputCount: 1, outputCount: 1 })
    subgraph.rootGraph.add(createTestSubgraphNode(subgraph))
    configureBoundaryLink(subgraph, 101)
    const data = structuredClone(subgraph.asSerialisable()) as ExportedSubgraph

    subgraph.configure(data, true)
    const first = subgraph.asSerialisable()
    subgraph.configure(data, true)

    expect(subgraph.asSerialisable()).toEqual(first)
  })
})
