import {
  assert,
  beforeEach,
  describe,
  expect,
  it,
  onTestFinished,
  vi
} from 'vitest'

import type { Positionable } from '@/lib/litegraph/src/litegraph'
import { createTestNode } from '@/lib/litegraph/src/__fixtures__/nodeHelpers'
import { reportError } from '@/platform/telemetry/reportError'

import {
  createTestRootGraph,
  enableSubgraphNodeCreation,
  resetSubgraphFixtureState
} from './__fixtures__/subgraphHelpers'

vi.mock(import('@/platform/telemetry/reportError'), () => ({
  reportError: vi.fn()
}))

beforeEach(() => {
  resetSubgraphFixtureState()
})

describe('Convert to Subgraph with a nested subgraph host in the selection', () => {
  it('keeps the nested definition serialisable after its only host moves into the new subgraph', () => {
    const rootGraph = createTestRootGraph()
    onTestFinished(enableSubgraphNodeCreation(rootGraph))

    const origin = createTestNode(rootGraph, [], ['number'])
    const target = createTestNode(rootGraph, ['number'])
    origin.connect(0, target, 0)
    const { subgraph: inner, node: innerHost } = rootGraph.convertToSubgraph(
      new Set<Positionable>([origin, target])
    )
    const sibling = createTestNode(rootGraph)

    const { subgraph: outer } = rootGraph.convertToSubgraph(
      new Set<Positionable>([innerHost, sibling])
    )

    const serialized = rootGraph.serialize()

    expect(reportError).not.toHaveBeenCalled()
    const definitions = new Map(
      (serialized.definitions?.subgraphs ?? []).map((s) => [s.id, s])
    )
    const innerDefinition = definitions.get(inner.id)
    const outerDefinition = definitions.get(outer.id)
    assert(innerDefinition?.nodes)
    assert(outerDefinition?.nodes)
    expect(innerDefinition.nodes.map((node) => node.type).sort()).toEqual(
      [origin.type, target.type].sort()
    )
    expect(outerDefinition.nodes.map((node) => node.type)).toContain(inner.id)
  })
})
