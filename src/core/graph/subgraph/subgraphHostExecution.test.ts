import { createTestingPinia } from '@pinia/testing'
import { setActivePinia } from 'pinia'
import { beforeEach, describe, expect, it } from 'vitest'

import {
  createTestRootGraph,
  createTestSubgraph,
  createTestSubgraphNode
} from '@/lib/litegraph/src/subgraph/__fixtures__/subgraphHelpers'
import { createNodeExecutionId } from '@/types/nodeIdentification'

import {
  findSubgraphHostAncestorExecutionId,
  findUniqueSubgraphHostExecutionId,
  resolveEnteredSubgraphHostExecutionId
} from './subgraphHostExecution'

describe('subgraph host execution context', () => {
  beforeEach(() => {
    setActivePinia(createTestingPinia({ stubActions: false }))
  })

  it('resolves a definition with one host instance', () => {
    const rootGraph = createTestRootGraph()
    const subgraph = createTestSubgraph({ rootGraph })
    const host = createTestSubgraphNode(subgraph, { id: 11 })
    rootGraph.add(host)

    expect(findUniqueSubgraphHostExecutionId(rootGraph, subgraph)).toBe('11')
  })

  it('does not choose between two host instances of one definition', () => {
    const rootGraph = createTestRootGraph()
    const subgraph = createTestSubgraph({ rootGraph })
    rootGraph.add(createTestSubgraphNode(subgraph, { id: 11 }))
    rootGraph.add(createTestSubgraphNode(subgraph, { id: 12 }))

    expect(
      findUniqueSubgraphHostExecutionId(rootGraph, subgraph)
    ).toBeUndefined()
  })

  it('treats a nested host under two shared outer instances as ambiguous', () => {
    const rootGraph = createTestRootGraph()
    const outerSubgraph = createTestSubgraph({ rootGraph })
    const innerSubgraph = createTestSubgraph({ rootGraph })
    outerSubgraph.add(
      createTestSubgraphNode(innerSubgraph, {
        parentGraph: outerSubgraph,
        id: 22
      })
    )
    rootGraph.add(createTestSubgraphNode(outerSubgraph, { id: 11 }))
    rootGraph.add(createTestSubgraphNode(outerSubgraph, { id: 12 }))

    expect(
      findUniqueSubgraphHostExecutionId(rootGraph, innerSubgraph)
    ).toBeUndefined()
  })

  it('preserves an exact ancestor when navigating back outward', () => {
    const rootGraph = createTestRootGraph()
    const outerSubgraph = createTestSubgraph({ rootGraph })
    const innerSubgraph = createTestSubgraph({ rootGraph })
    outerSubgraph.add(
      createTestSubgraphNode(innerSubgraph, {
        parentGraph: outerSubgraph,
        id: 22
      })
    )
    rootGraph.add(createTestSubgraphNode(outerSubgraph, { id: 11 }))
    rootGraph.add(createTestSubgraphNode(outerSubgraph, { id: 12 }))

    expect(
      findSubgraphHostAncestorExecutionId(
        rootGraph,
        createNodeExecutionId([12, 22]),
        outerSubgraph
      )
    ).toBe('12')
  })

  it('uses the selected host when entering from the root graph', () => {
    const rootGraph = createTestRootGraph()
    const subgraph = createTestSubgraph({ rootGraph })
    rootGraph.add(createTestSubgraphNode(subgraph, { id: 11 }))
    const selectedHost = createTestSubgraphNode(subgraph, { id: 12 })
    rootGraph.add(selectedHost)

    expect(
      resolveEnteredSubgraphHostExecutionId(
        rootGraph,
        undefined,
        rootGraph,
        selectedHost
      )
    ).toBe('12')
  })

  it('extends the exact path when entering a nested subgraph', () => {
    const rootGraph = createTestRootGraph()
    const outerSubgraph = createTestSubgraph({ rootGraph })
    const innerSubgraph = createTestSubgraph({ rootGraph })
    const innerHost = createTestSubgraphNode(innerSubgraph, {
      parentGraph: outerSubgraph,
      id: 22
    })
    outerSubgraph.add(innerHost)
    rootGraph.add(createTestSubgraphNode(outerSubgraph, { id: 12 }))

    expect(
      resolveEnteredSubgraphHostExecutionId(
        rootGraph,
        createNodeExecutionId([12]),
        outerSubgraph,
        innerHost
      )
    ).toBe('12:22')
    expect(
      resolveEnteredSubgraphHostExecutionId(
        rootGraph,
        undefined,
        outerSubgraph,
        innerHost
      )
    ).toBeUndefined()
  })
})
