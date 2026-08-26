import { createTestingPinia } from '@pinia/testing'
import { setActivePinia } from 'pinia'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'

import { LiteGraph, SubgraphNode } from '@/lib/litegraph/src/litegraph'

import {
  cleanupComplexPromotionFixtureNodeType,
  createNestedSubgraphs,
  createTestRootGraph,
  createTestSubgraph,
  createTestSubgraphData,
  enableSubgraphNodeCreation,
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
    const { graph, subgraph, hostNode } = setupComplexPromotionFixture()

    expect(graph.id).toBe('00000000-0000-4000-8000-000000000001')
    expect(subgraph.rootGraph).toBe(graph)
    expect(hostNode.graph).toBe(graph)
    expect(hostNode.subgraph).toBe(subgraph)
    expect(graph.getNodeById(hostNode.id)).toBe(hostNode)
  })
})

describe('enableSubgraphNodeCreation', () => {
  beforeEach(() => {
    setActivePinia(createTestingPinia({ stubActions: false }))
    resetSubgraphFixtureState()
  })

  it('makes new subgraphs resolvable by type until disposed', () => {
    const rootGraph = createTestRootGraph()
    const dispose = enableSubgraphNodeCreation(rootGraph)

    const subgraph = rootGraph.createSubgraph(createTestSubgraphData())

    expect(LiteGraph.createNode(subgraph.id)).toBeInstanceOf(SubgraphNode)

    dispose()

    expect(LiteGraph.createNode(subgraph.id)).toBeNull()

    const laterSubgraph = rootGraph.createSubgraph(createTestSubgraphData())
    expect(LiteGraph.createNode(laterSubgraph.id)).toBeNull()
  })

  it('only removes registrations owned by its invocation', () => {
    const firstRoot = createTestRootGraph()
    const secondRoot = createTestRootGraph()
    const disposeFirst = enableSubgraphNodeCreation(firstRoot)
    const disposeSecond = enableSubgraphNodeCreation(secondRoot)
    const data = createTestSubgraphData()
    firstRoot.createSubgraph(data)
    const secondSubgraph = secondRoot.createSubgraph(data)

    disposeFirst()

    expect(LiteGraph.createNode(data.id)).toMatchObject({
      subgraph: secondSubgraph
    })

    disposeSecond()
    expect(LiteGraph.createNode(data.id)).toBeNull()
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
