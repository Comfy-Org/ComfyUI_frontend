import { describe, expect, it } from 'vitest'

import { createTestSubgraph } from '@/lib/litegraph/src/subgraph/__fixtures__/subgraphHelpers'
import { LayoutSource } from '@/renderer/core/layout/types'
import type { BatchUpdateBoundsOperation } from '@/renderer/core/layout/types'

import { applySubgraphInputLayout } from './subgraphInputLayout'

describe('subgraph input layout commands', () => {
  it('persists an explicit resize without changing port declarations', () => {
    const graph = createTestSubgraph({
      inputs: [{ name: 'value', type: 'STRING' }]
    })
    const before = graph.inputs.map((slot) => slot.asSerialisable())
    const node = graph.inputNode
    node.pinned = true
    const operation: BatchUpdateBoundsOperation = {
      type: 'batchUpdateBounds',
      graphId: graph.id,
      nodeIds: [node.id],
      bounds: { [node.id]: { x: 10, y: 20, width: 424, height: 500 } },
      source: LayoutSource.Vue,
      timestamp: 1
    }

    expect(applySubgraphInputLayout(graph, operation)).toBe(true)
    node.arrange()

    expect(node.asSerialisable().bounding).toEqual([10, 20, 424, 500])
    expect(node.pinned).toBe(true)
    expect(graph.inputs.map((slot) => slot.asSerialisable())).toEqual(before)
  })

  it('rejects a command addressed to another definition without mutation', () => {
    const graph = createTestSubgraph()
    const other = createTestSubgraph()
    const node = graph.inputNode
    const before = node.asSerialisable()

    expect(
      applySubgraphInputLayout(graph, {
        type: 'batchUpdateBounds',
        graphId: other.id,
        nodeIds: [node.id],
        bounds: { [node.id]: { x: 10, y: 20, width: 424, height: 500 } },
        source: LayoutSource.Vue,
        timestamp: 1
      })
    ).toBe(false)

    expect(node.asSerialisable()).toEqual(before)
  })
})
