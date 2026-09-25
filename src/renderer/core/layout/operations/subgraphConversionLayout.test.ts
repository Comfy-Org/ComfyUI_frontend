import { beforeEach, describe, expect, it, onTestFinished } from 'vitest'

import type {
  LGraph,
  Positionable,
  Subgraph
} from '@/lib/litegraph/src/litegraph'
import { createTestNode } from '@/lib/litegraph/src/__fixtures__/nodeHelpers'
import {
  createTestRootGraph,
  enableSubgraphNodeCreation,
  resetSubgraphFixtureState
} from '@/lib/litegraph/src/subgraph/__fixtures__/subgraphHelpers'
import { layoutStore } from '@/renderer/core/layout/store/layoutStore'

import { setNodePosition } from './graphLayoutAttachment'

beforeEach(() => {
  resetSubgraphFixtureState()
  layoutStore.resetForTests()
})

function interiorGeometry(
  rootGraph: LGraph,
  definition: Subgraph
): Record<string, { x: number; y: number } | null> {
  return Object.fromEntries(
    definition.nodes.map((node) => [
      String(node.id),
      layoutStore.getNodeLayout(rootGraph.id, node.id)?.position ?? null
    ])
  )
}

describe('Convert to Subgraph and the layout records of a nested definition', () => {
  it('leaves each interior node at its own distinct position', () => {
    const rootGraph = createTestRootGraph()
    onTestFinished(enableSubgraphNodeCreation(rootGraph))

    const origin = createTestNode(rootGraph, [], ['number'])
    const target = createTestNode(rootGraph, ['number'])
    origin.connect(0, target, 0)
    setNodePosition(origin, [110, 220])
    setNodePosition(target, [330, 440])

    const { subgraph: inner, node: innerHost } = rootGraph.convertToSubgraph(
      new Set<Positionable>([origin, target])
    )
    const before = interiorGeometry(rootGraph, inner)

    rootGraph.convertToSubgraph(
      new Set<Positionable>([innerHost, createTestNode(rootGraph)])
    )

    expect({ before, after: interiorGeometry(rootGraph, inner) }).toEqual({
      before: {
        [origin.id]: { x: 110, y: 220 },
        [target.id]: { x: 330, y: 440 }
      },
      after: {
        [origin.id]: { x: 110, y: 220 },
        [target.id]: { x: 330, y: 440 }
      }
    })
  })
})
