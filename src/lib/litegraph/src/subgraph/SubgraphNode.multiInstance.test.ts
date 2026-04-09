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
  it('preserves per-instance widget values after configure', () => {
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

    const widgets1 = instance1.widgets!
    const widgets2 = instance2.widgets!

    expect(widgets1.length).toBeGreaterThan(0)
    expect(widgets2.length).toBeGreaterThan(0)
    expect(widgets1[0].value).toBe(10)
    expect(widgets2[0].value).toBe(20)
    expect(widgets1[0].serializeValue!(instance1, 0)).toBe(10)
    expect(widgets2[0].serializeValue!(instance2, 0)).toBe(20)
    expect(instance1.serialize().widgets_values).toEqual([10])
    expect(instance2.serialize().widgets_values).toEqual([20])
  })

  it('round-trips per-instance widget values through serialize and configure', () => {
    const subgraph = createTestSubgraph({
      inputs: [{ name: 'value', type: 'number' }]
    })

    const { node } = createNodeWithWidget('TestNode', 0)
    subgraph.add(node)
    subgraph.inputNode.slots[0].connect(node.inputs[0], node)

    const originalInstance = createTestSubgraphNode(subgraph, { id: 301 })
    originalInstance.configure({
      id: 301,
      type: subgraph.id,
      pos: [100, 100],
      size: [200, 100],
      inputs: [],
      outputs: [],
      mode: 0,
      order: 0,
      flags: {},
      properties: { proxyWidgets: [['-1', 'widget']] },
      widgets_values: [33]
    })

    const serialized = originalInstance.serialize()

    const restoredInstance = createTestSubgraphNode(subgraph, { id: 302 })
    restoredInstance.configure({
      ...serialized,
      id: 302,
      type: subgraph.id
    })

    const restoredWidget = restoredInstance.widgets?.[0]
    expect(restoredWidget?.value).toBe(33)
    expect(restoredWidget?.serializeValue?.(restoredInstance, 0)).toBe(33)
  })

  it('skips non-serializable source widgets during serialize', () => {
    const subgraph = createTestSubgraph({
      inputs: [{ name: 'value', type: 'number' }]
    })

    const { node, widget } = createNodeWithWidget('TestNode', 10)
    subgraph.add(node)
    subgraph.inputNode.slots[0].connect(node.inputs[0], node)

    // Mark the source widget as non-persistent (e.g. preview widget)
    widget.serialize = false

    const instance = createTestSubgraphNode(subgraph, { id: 501 })
    instance.configure({
      id: 501,
      type: subgraph.id,
      pos: [100, 100],
      size: [200, 100],
      inputs: [],
      outputs: [],
      mode: 0,
      order: 0,
      flags: {},
      properties: { proxyWidgets: [['-1', 'widget']] },
      widgets_values: []
    })

    const serialized = instance.serialize()
    expect(serialized.widgets_values).toBeUndefined()
  })
})
