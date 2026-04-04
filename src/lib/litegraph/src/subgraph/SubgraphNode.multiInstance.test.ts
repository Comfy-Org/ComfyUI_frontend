import { createTestingPinia } from '@pinia/testing'
import { setActivePinia } from 'pinia'
import { beforeEach, describe, expect, it } from 'vitest'

import type { ISlotType } from '@/lib/litegraph/src/litegraph'
import { BaseWidget, LGraphNode } from '@/lib/litegraph/src/litegraph'

import {
  createTestSubgraph,
  createTestSubgraphNode,
  resetSubgraphFixtureState
} from './__fixtures__/subgraphHelpers'

function createNodeWithWidget(
  title: string,
  widgetValue: unknown = 42,
  slotType: ISlotType = 'number'
) {
  const node = new LGraphNode(title)
  const input = node.addInput('value', slotType)
  node.addOutput('out', slotType)

  // @ts-expect-error Abstract class instantiation
  const widget = new BaseWidget({
    name: 'widget',
    type: 'number',
    value: widgetValue,
    y: 0,
    options: { min: 0, max: 100, step: 1 },
    node
  })
  node.widgets = [widget]
  input.widget = { name: widget.name }

  return { node, widget, input }
}

beforeEach(() => {
  setActivePinia(createTestingPinia({ stubActions: false }))
  resetSubgraphFixtureState()
})

describe('SubgraphNode multi-instance widget isolation', () => {
  it('preserves distinct promoted widget values across instances of the same blueprint', () => {
    const subgraph = createTestSubgraph({
      inputs: [{ name: 'value', type: 'number' }]
    })

    const { node } = createNodeWithWidget('TestNode', 10)
    subgraph.add(node)
    subgraph.inputNode.slots[0].connect(node.inputs[0], node)

    // Create two instances of the same subgraph
    const instance1 = createTestSubgraphNode(subgraph, { id: 101 })
    const instance2 = createTestSubgraphNode(subgraph, { id: 102 })

    // Both should have promoted widgets
    expect(instance1.widgets).toHaveLength(1)
    expect(instance2.widgets).toHaveLength(1)

    // Set different values on each instance
    instance1.widgets![0].value = 10
    instance2.widgets![0].value = 20

    // BUG: instance1's value should still be 10, but because both instances
    // write to the same shared inner node's widget, instance2's configure
    // overwrites instance1's value
    expect(instance1.widgets![0].value).toBe(10)
    expect(instance2.widgets![0].value).toBe(20)
  })

  it('preserves promoted widget values after configure with different widgets_values', () => {
    const subgraph = createTestSubgraph({
      inputs: [{ name: 'value', type: 'number' }]
    })

    const { node } = createNodeWithWidget('TestNode', 0)
    subgraph.add(node)
    subgraph.inputNode.slots[0].connect(node.inputs[0], node)

    const instance1 = createTestSubgraphNode(subgraph, { id: 201 })
    const instance2 = createTestSubgraphNode(subgraph, { id: 202 })

    // Simulate what LGraph.configure does: call configure with different widgets_values
    instance1.configure({
      id: 201,
      type: subgraph.id,
      pos: [100, 100],
      size: [200, 100],
      inputs: [],
      outputs: [],
      mode: 0,
      order: 0,
      flags: {},
      properties: { proxyWidgets: [['-1', 'widget']] },
      widgets_values: [10]
    })

    instance2.configure({
      id: 202,
      type: subgraph.id,
      pos: [400, 100],
      size: [200, 100],
      inputs: [],
      outputs: [],
      mode: 0,
      order: 1,
      flags: {},
      properties: { proxyWidgets: [['-1', 'widget']] },
      widgets_values: [20]
    })

    // BUG: After configuring both, instance1 should still be 10
    // but instance2's configure overwrites the shared inner widget
    expect(instance1.widgets?.[0]?.value).toBe(10)
    expect(instance2.widgets?.[0]?.value).toBe(20)
  })
})
