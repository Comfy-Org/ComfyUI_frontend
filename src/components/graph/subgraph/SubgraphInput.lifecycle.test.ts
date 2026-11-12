import { assert, describe, expect, it } from 'vitest'

import { LGraphNode } from '@/lib/litegraph/src/litegraph'
import {
  createTestSubgraph,
  createTestSubgraphNode
} from '@/lib/litegraph/src/subgraph/__fixtures__/subgraphHelpers'
import { useWidgetValueStore } from '@/stores/widgetValueStore'

function target(value: number, max = 100) {
  const node = new LGraphNode('Value')
  const input = node.addInput('value', 'INT')
  input.widget = { name: 'value' }
  node.addWidget('number', 'value', value, () => {}, { min: 0, max, step2: 1 })
  return { node, input }
}

describe('subgraph input widget lifecycle', () => {
  it('disconnects every fanout link without leaving orphaned target connections', () => {
    const graph = createTestSubgraph({
      inputs: [{ name: 'number', type: 'INT' }]
    })
    const a = target(17)
    const b = target(29)
    graph.add(a.node)
    graph.add(b.node)
    const slot = graph.inputs[0]
    slot.connect(a.input, a.node)
    slot.connect(b.input, b.node)
    expect(graph.links.size).toBe(2)

    slot.disconnect()

    expect(graph.links.size).toBe(0)
    expect([a.input.link, b.input.link]).toEqual([null, null])
    expect(slot.linkIds).toEqual([])
  })

  it('keeps the host value and adopts the new target constraints when a disconnected input is reconnected', async () => {
    const graph = createTestSubgraph({
      inputs: [{ name: 'number', type: 'INT' }]
    })
    const host = createTestSubgraphNode(graph)
    graph.rootGraph.add(host)
    const a = target(17)
    const b = target(29, 500)
    graph.add(a.node)
    graph.add(b.node)
    const slot = graph.inputs[0]
    slot.connect(a.input, a.node)
    const id = host.inputs[0].widgetId
    assert.exists(id)
    const store = useWidgetValueStore()
    store.setValue(id, 77)

    slot.disconnect()
    await Promise.resolve()

    expect(host.inputs[0].widgetId).toBeUndefined()
    slot.connect(b.input, b.node)
    const nextId = host.inputs[0].widgetId
    assert.exists(nextId)
    const current = store.getWidget(nextId)
    expect(current?.value).toBe(77)
    expect(current?.options.max).toBe(500)
    expect(graph.inputNode.allSlots.at(-1)).toBe(graph.inputNode.emptySlot)
  })
})
