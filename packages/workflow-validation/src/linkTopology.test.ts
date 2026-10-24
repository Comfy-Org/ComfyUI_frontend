import { describe, expect, it } from 'vitest'

import { validateLinkTopology } from './linkTopology'
import type { WorkflowGraph } from './linkTopology'

function createValidGraph(): WorkflowGraph {
  return {
    nodes: [
      { id: 1, outputs: [{ links: [7] }] },
      { id: 2, inputs: [{ link: 7 }] }
    ],
    links: [[7, 1, 0, 2, 0, '*']]
  }
}

describe('validateLinkTopology', () => {
  it('accepts a consistent graph without mutating it', () => {
    const graph = createValidGraph()
    const before = structuredClone(graph)
    expect(validateLinkTopology(graph)).toEqual([])
    expect(graph).toEqual(before)
  })

  it('reports inconsistent endpoints', () => {
    const graph = createValidGraph()
    graph.nodes![0].outputs![0].links = []
    graph.nodes![1].inputs![0].link = 8

    expect(validateLinkTopology(graph).map(({ kind }) => kind)).toEqual([
      'origin-link-not-listed',
      'target-link-mismatch'
    ])
  })

  it('validates nested subgraph definitions with their own node namespace', () => {
    const graph: WorkflowGraph = {
      ...createValidGraph(),
      definitions: {
        subgraphs: [
          {
            id: 'nested-id',
            name: 'Nested workflow',
            nodes: [{ id: 'inside', outputs: [{}] }],
            links: [[11, 'inside', 0, 'missing', 0]]
          }
        ]
      }
    }

    expect(validateLinkTopology(graph)).toMatchObject([
      {
        kind: 'missing-target-node',
        link: { graphPath: ['root', 'Nested workflow'], linkId: 11 }
      }
    ])
  })

  it('supports object-form links', () => {
    const validGraph = createValidGraph()
    const graph: WorkflowGraph = {
      nodes: validGraph.nodes,
      links: [
        {
          id: 7,
          origin_id: 1,
          origin_slot: 0,
          target_id: 2,
          target_slot: 0
        }
      ]
    }
    expect(validateLinkTopology(graph)).toEqual([])
  })

  it('reports missing endpoints in object-form links', () => {
    const graph = createValidGraph()
    graph.links = [
      {
        id: 7,
        origin_id: 'missing',
        origin_slot: 0,
        target_id: 2,
        target_slot: 0
      }
    ]

    expect(validateLinkTopology(graph).map(({ kind }) => kind)).toEqual([
      'missing-origin-node'
    ])
  })

  it('reports an origin slot outside the source node bounds', () => {
    const graph = createValidGraph()
    graph.links = [[7, 1, 1, 2, 0]]

    expect(validateLinkTopology(graph).map(({ kind }) => kind)).toEqual([
      'origin-slot-out-of-bounds'
    ])
  })

  it('reports a target slot outside the destination node bounds', () => {
    const graph = createValidGraph()
    graph.links = [[7, 1, 0, 2, 1]]

    expect(validateLinkTopology(graph).map(({ kind }) => kind)).toEqual([
      'target-slot-out-of-bounds'
    ])
  })
})
