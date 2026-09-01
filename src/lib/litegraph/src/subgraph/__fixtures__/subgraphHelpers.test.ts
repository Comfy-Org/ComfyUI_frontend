import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { createTestingPinia } from '@pinia/testing'
import { setActivePinia } from 'pinia'

import { LiteGraph } from '@/lib/litegraph/src/litegraph'

import {
  cleanupComplexPromotionFixtureNodeType,
  createNestedSubgraphs,
  createTestSubgraph,
  resetSubgraphFixtureState,
  setupComplexPromotionFixture
} from './subgraphHelpers'

const FIXTURE_STRING_CONCAT_TYPE = 'Fixture/StringConcatenate'

describe('setupComplexPromotionFixture', () => {
  beforeEach(() => {
    resetSubgraphFixtureState()
  })

  afterEach(() => {
    cleanupComplexPromotionFixtureNodeType()
  })

  it('can clean up the globally registered fixture node type', () => {
    setActivePinia(createTestingPinia({ stubActions: false }))

    setupComplexPromotionFixture()
    expect(
      LiteGraph.registered_node_types[FIXTURE_STRING_CONCAT_TYPE]
    ).toBeDefined()

    cleanupComplexPromotionFixtureNodeType()
    expect(
      LiteGraph.registered_node_types[FIXTURE_STRING_CONCAT_TYPE]
    ).toBeUndefined()
  })

  it('builds a promotion fixture bound to a deterministic root graph', () => {
    setActivePinia(createTestingPinia({ stubActions: false }))

    const { graph, subgraph, hostNode } = setupComplexPromotionFixture()

    expect(graph.id).toBe('00000000-0000-4000-8000-000000000001')
    expect(subgraph.rootGraph).toBe(graph)
    expect(hostNode.graph).toBe(graph)
    expect(hostNode.subgraph).toBe(subgraph)
    expect(graph.getNodeById(hostNode.id)).toBe(hostNode)
  })
})

describe('subgraph fixture graph setup', () => {
  beforeEach(() => {
    resetSubgraphFixtureState()
  })

  it('creates deterministic root and subgraph ids', () => {
    const first = createTestSubgraph()
    const second = createTestSubgraph()

    expect(first.rootGraph.id).toBe('00000000-0000-4000-8000-000000000001')
    expect(first.id).toBe('00000000-0000-4000-8000-000000000002')
    expect(second.rootGraph.id).toBe('00000000-0000-4000-8000-000000000003')
    expect(second.id).toBe('00000000-0000-4000-8000-000000000004')
  })

  it('creates nested subgraphs that share one root graph and valid parent chain', () => {
    const nested = createNestedSubgraphs({
      depth: 3,
      nodesPerLevel: 1,
      inputsPerSubgraph: 1,
      outputsPerSubgraph: 1
    })

    expect(nested.subgraphs).toHaveLength(3)
    expect(nested.subgraphNodes).toHaveLength(3)
    expect(
      nested.subgraphs.every(
        (subgraph) => subgraph.rootGraph === nested.rootGraph
      )
    ).toBe(true)

    expect(nested.subgraphNodes[0].graph).toBe(nested.rootGraph)
    expect(nested.subgraphNodes[1].graph).toBe(nested.subgraphs[0])
    expect(nested.subgraphNodes[2].graph).toBe(nested.subgraphs[1])
  })
})
