import { describe, expect, it } from 'vitest'

import { createTestNode } from '@/lib/litegraph/src/__fixtures__/nodeHelpers'
import { LGraph } from '@/lib/litegraph/src/litegraph'
import type { LGraphNode } from '@/lib/litegraph/src/litegraph'
import type { ISerialisedNode } from '@/lib/litegraph/src/types/serialisation'

import type { PromotionAwareInputSlot } from '@/lib/litegraph/src/node/slotUtils'

function createFallbackSlot(node: LGraphNode): PromotionAwareInputSlot {
  const slot = node.addInput('seed', 'INT', { widget: { name: 'seed' } })
  return Object.assign(slot, { _createdByPromotion: true })
}

describe('LGraphNode promotion-created input pruning', () => {
  it('removes a promotion-created input once its last link disconnects', async () => {
    const graph = new LGraph()
    const source = createTestNode(graph, [], ['INT'])
    const target = createTestNode(graph, [])
    const slot = createFallbackSlot(target)
    const slotIndex = target.inputs.indexOf(slot)
    source.connect(0, target, slotIndex)

    target.disconnectInput(slotIndex)
    await Promise.resolve()

    expect(target.inputs).not.toContain(slot)
  })

  it('keeps the input when a replacement link lands in the same tick', async () => {
    const graph = new LGraph()
    const source = createTestNode(graph, [], ['INT'])
    const other = createTestNode(graph, [], ['INT'])
    const target = createTestNode(graph, [])
    const slot = createFallbackSlot(target)
    const slotIndex = target.inputs.indexOf(slot)
    source.connect(0, target, slotIndex)

    target.disconnectInput(slotIndex, true)
    other.connect(0, target, slotIndex)
    await Promise.resolve()

    expect(target.inputs).toContain(slot)
    expect(target.isInputConnected(slotIndex)).toBe(true)
  })

  it('prunes a restored promotion-created input after save and reload', async () => {
    const graph = new LGraph()
    const source = createTestNode(graph, [], ['INT'])
    const target = createTestNode(graph, [])
    createFallbackSlot(target)
    const restored = createTestNode(graph, [])
    restored.configure(
      JSON.parse(JSON.stringify(target.serialize())) as ISerialisedNode
    )
    expect(
      (restored.inputs[0] as PromotionAwareInputSlot)._createdByPromotion
    ).toBe(true)
    source.connect(0, restored, 0)

    restored.disconnectInput(0)
    await Promise.resolve()

    expect(restored.inputs).toHaveLength(0)
  })

  it('keeps a declared input when its link disconnects', async () => {
    const graph = new LGraph()
    const source = createTestNode(graph, [], ['INT'])
    const target = createTestNode(graph, ['INT'])
    source.connect(0, target, 0)

    target.disconnectInput(0)
    await Promise.resolve()

    expect(target.inputs).toHaveLength(1)
  })
})
