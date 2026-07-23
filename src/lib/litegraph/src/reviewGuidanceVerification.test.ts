import { describe, expect, it } from 'vitest'

import { LGraph, LGraphNode } from '@/lib/litegraph/src/litegraph'

import { serializesWorkflowWidget } from './reviewGuidanceVerification'

function createGraph() {
  const graph = new LGraph()
  graph.add(new LGraphNode('review-guidance'))
  return graph
}

describe('review guidance verification', () => {
  it('adds a node to a graph', () => {
    expect(createGraph().nodes).toHaveLength(1)
  })

  it('creates isolated graphs', () => {
    expect(createGraph()).not.toBe(createGraph())
  })

  it('serializes workflow widgets', () => {
    expect(serializesWorkflowWidget({ options: { serialize: true } })).toBe(
      true
    )
  })
})
