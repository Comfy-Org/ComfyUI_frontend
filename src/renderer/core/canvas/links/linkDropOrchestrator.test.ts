import { beforeEach, describe, expect, it } from 'vitest'

import { LGraph } from '@/lib/litegraph/src/litegraph'
import {
  createTestSubgraph,
  resetSubgraphFixtureState
} from '@/lib/litegraph/src/subgraph/__fixtures__/subgraphHelpers'
import { applySubgraphIoHoverHighlight } from '@/renderer/core/canvas/links/linkDropOrchestrator'

const inputNodeCenter = (subgraph: ReturnType<typeof createTestSubgraph>) => {
  const r = subgraph.inputNode.boundingRect
  return { x: r[0] + r[2] / 2, y: r[1] + r[3] / 2 }
}

const outputNodeCenter = (subgraph: ReturnType<typeof createTestSubgraph>) => {
  const r = subgraph.outputNode.boundingRect
  return { x: r[0] + r[2] / 2, y: r[1] + r[3] / 2 }
}

describe('applySubgraphIoHoverHighlight', () => {
  beforeEach(resetSubgraphFixtureState)

  it('returns false and is a no-op for a non-subgraph root graph', () => {
    const graph = new LGraph()

    expect(applySubgraphIoHoverHighlight(graph, 0, 0)).toBe(false)
  })

  it('forwards the pointer to both IO nodes when hovering inside one', () => {
    const subgraph = createTestSubgraph({
      inputs: [{ name: 'in', type: 'NUMBER' }],
      outputs: [{ name: 'out', type: 'NUMBER' }]
    })
    subgraph.inputNode.arrange()
    subgraph.outputNode.arrange()
    const center = inputNodeCenter(subgraph)

    const changed = applySubgraphIoHoverHighlight(subgraph, center.x, center.y)

    expect(changed).toBe(true)
    expect(subgraph.inputNode.isPointerOver).toBe(true)
    expect(subgraph.outputNode.isPointerOver).toBe(false)
  })

  it('returns false on subsequent calls when hover state is unchanged', () => {
    const subgraph = createTestSubgraph({
      inputs: [{ name: 'in', type: 'NUMBER' }]
    })
    subgraph.inputNode.arrange()
    const center = inputNodeCenter(subgraph)

    applySubgraphIoHoverHighlight(subgraph, center.x, center.y)
    const second = applySubgraphIoHoverHighlight(subgraph, center.x, center.y)

    expect(second).toBe(false)
  })

  it('returns true and clears hover state when the pointer leaves the IO node', () => {
    const subgraph = createTestSubgraph({
      inputs: [{ name: 'in', type: 'NUMBER' }]
    })
    subgraph.inputNode.arrange()
    const center = inputNodeCenter(subgraph)

    applySubgraphIoHoverHighlight(subgraph, center.x, center.y)
    const left = applySubgraphIoHoverHighlight(subgraph, -9999, -9999)

    expect(left).toBe(true)
    expect(subgraph.inputNode.isPointerOver).toBe(false)
    expect(subgraph.inputNode.allSlots.every((s) => !s.isPointerOver)).toBe(
      true
    )
  })

  it('updates per-slot hover flags when entering a slot', () => {
    const subgraph = createTestSubgraph({
      inputs: [{ name: 'in', type: 'NUMBER' }]
    })
    subgraph.inputNode.arrange()
    const slot = subgraph.inputNode.slots[0]
    const r = slot.boundingRect
    const slotCenter = { x: r[0] + r[2] / 2, y: r[1] + r[3] / 2 }

    applySubgraphIoHoverHighlight(subgraph, slotCenter.x, slotCenter.y)

    expect(slot.isPointerOver).toBe(true)
  })

  it('detects transitions on the output IO node independently', () => {
    const subgraph = createTestSubgraph({
      outputs: [{ name: 'out', type: 'NUMBER' }]
    })
    subgraph.outputNode.arrange()
    const center = outputNodeCenter(subgraph)

    const changed = applySubgraphIoHoverHighlight(subgraph, center.x, center.y)

    expect(changed).toBe(true)
    expect(subgraph.outputNode.isPointerOver).toBe(true)
    expect(subgraph.inputNode.isPointerOver).toBe(false)
  })
})
