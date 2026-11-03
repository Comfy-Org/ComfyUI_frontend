import { assert, describe, expect, it } from 'vitest'
import { nextTick, watch } from 'vue'

import { createTestWidgetNode } from '@/lib/litegraph/src/__fixtures__/nodeHelpers'
import { LGraph, LiteGraph } from '@/lib/litegraph/src/litegraph'

function createWidgetInputNode() {
  const node = createTestWidgetNode(new LGraph())
  node.pos = [0, 0]
  node.size = [200, 120]
  node.inputs[0].widget = { name: 'text_widget' }
  node._setConcreteSlots()
  return node
}

describe('LGraphNode widget input slot arrangement', () => {
  it('keeps the same pos array when the widget row has not moved', () => {
    const node = createWidgetInputNode()
    node.arrange()
    const firstPos = node.inputs[0].pos

    node.arrange()

    expect(node.inputs[0].pos).toBe(firstPos)
  })

  it('does not notify slot position subscribers on an unchanged re-arrange', async () => {
    const node = createWidgetInputNode()
    node.arrange()
    await nextTick()

    let notifications = 0
    const stop = watch(
      () => node.inputs[0].pos,
      () => {
        notifications++
      }
    )

    node.arrange()
    await nextTick()
    stop()

    expect(notifications).toBe(0)
  })

  it('writes a new pos when the widget row actually moves', async () => {
    const node = createWidgetInputNode()
    node.arrange()
    const firstPos = node.inputs[0].pos
    assert.exists(firstPos)

    node.widgets_start_y = (node.widgets_start_y ?? 0) + 40
    node.arrange()
    await nextTick()

    const pos = node.inputs[0].pos
    const widget = node.widgets?.[0]
    assert.exists(pos)
    assert.exists(widget)
    expect(pos).not.toBe(firstPos)
    expect(pos[1]).not.toBe(firstPos[1])
    expect(pos[1]).toBe(widget.y + LiteGraph.NODE_SLOT_HEIGHT * 0.5)
  })
})
