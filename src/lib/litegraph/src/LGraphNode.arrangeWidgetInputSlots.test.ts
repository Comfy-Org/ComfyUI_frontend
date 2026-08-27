import { createTestingPinia } from '@pinia/testing'
import { setActivePinia } from 'pinia'
import { beforeEach, describe, expect, it } from 'vitest'
import { nextTick, watch } from 'vue'

import { LGraph, LGraphNode } from '@/lib/litegraph/src/litegraph'

function createWidgetInputNode(graph: LGraph): LGraphNode {
  const node = new LGraphNode('WidgetInput')
  node.pos = [0, 0]
  node.size = [200, 120]
  node.addWidget('number', 'value', 0, () => {})
  const input = node.addInput('value', 'FLOAT')
  input.widget = { name: 'value' }
  graph.add(node)
  node._setConcreteSlots()
  return node
}

describe('LGraphNode widget input slot arrangement', () => {
  let graph: LGraph
  let node: LGraphNode

  beforeEach(() => {
    setActivePinia(createTestingPinia({ stubActions: false }))
    graph = new LGraph()
    node = createWidgetInputNode(graph)
  })

  it('keeps the same pos array when the widget row has not moved', () => {
    node.arrange()
    const firstPos = node.inputs[0].pos

    node.arrange()

    expect(node.inputs[0].pos).toBe(firstPos)
  })

  it('does not notify slot position subscribers on an unchanged re-arrange', async () => {
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
    node.arrange()
    const firstPos = node.inputs[0].pos

    node.widgets_start_y = (node.widgets_start_y ?? 0) + 40
    node.arrange()
    await nextTick()

    expect(node.inputs[0].pos).not.toBe(firstPos)
    expect(node.inputs[0].pos![1]).not.toBe(firstPos![1])
  })
})
