import { describe, expect, it } from 'vitest'

import { validateLinkTopology } from './linkTopology'
import type { WorkflowGraph } from './linkTopology'

const validGraph: WorkflowGraph = {
  nodes: [
    { id: 1, outputs: [{ links: [7] }] },
    { id: 2, inputs: [{ link: 7 }] }
  ],
  links: [[7, 1, 0, 2, 0, '*']]
}

describe('validateLinkTopology', () => {
  it('accepts a consistent graph without mutating it', () => {
    const before = structuredClone(validGraph)
    expect(validateLinkTopology(validGraph)).toEqual([])
    expect(validGraph).toEqual(before)
  })

  it('reports inconsistent endpoints', () => {
    const graph = structuredClone(validGraph)
    graph.nodes![0].outputs![0].links = []
    graph.nodes![1].inputs![0].link = 8

    expect(validateLinkTopology(graph).map(({ kind }) => kind)).toEqual([
      'origin-link-not-listed',
      'target-link-mismatch'
    ])
  })

  it('validates nested subgraph definitions with their own node namespace', () => {
    const graph: WorkflowGraph = {
      ...validGraph,
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
})
