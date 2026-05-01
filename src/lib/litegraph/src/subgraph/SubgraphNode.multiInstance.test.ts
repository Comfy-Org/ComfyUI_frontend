import { createTestingPinia } from '@pinia/testing'
import { setActivePinia } from 'pinia'
import { beforeEach, describe, expect, it, vi } from 'vitest'

import type { ISlotType } from '@/lib/litegraph/src/litegraph'
import { LGraphNode } from '@/lib/litegraph/src/litegraph'

import {
  createTestSubgraph,
  createTestSubgraphNode,
  resetSubgraphFixtureState
} from './__fixtures__/subgraphHelpers'

function createNodeWithWidget(
  title: string,
  widgetValue: number = 42,
  slotType: ISlotType = 'number'
) {
  const node = new LGraphNode(title)
  const input = node.addInput('value', slotType)
  node.addOutput('out', slotType)

  const widget = node.addWidget('number', 'widget', widgetValue, () => {}, {
    min: 0,
    max: 100,
    step: 1
  })
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

  it('keeps fresh sibling instances isolated before save or reload', () => {
    const subgraph = createTestSubgraph({
      inputs: [{ name: 'value', type: 'number' }]
    })

    const { node } = createNodeWithWidget('TestNode', 7)
    subgraph.add(node)
    subgraph.inputNode.slots[0].connect(node.inputs[0], node)

    const instance1 = createTestSubgraphNode(subgraph, { id: 401 })
    const instance2 = createTestSubgraphNode(subgraph, { id: 402 })
    instance1.graph!.add(instance1)
    instance2.graph!.add(instance2)

    const widget1 = instance1.widgets?.[0]
    const widget2 = instance2.widgets?.[0]

    expect(widget1?.value).toBe(7)
    expect(widget2?.value).toBe(7)

    widget1!.value = 10

    expect(widget1?.value).toBe(10)
    expect(widget2?.value).toBe(7)
    expect(widget1?.serializeValue?.(instance1, 0)).toBe(10)
    expect(widget2?.serializeValue?.(instance2, 0)).toBe(7)
  })

  it('keeps per-instance override sticky when the inner source widget changes directly', () => {
    const subgraph = createTestSubgraph({
      inputs: [{ name: 'value', type: 'number' }]
    })

    const { node, widget } = createNodeWithWidget('TestNode', 0)
    subgraph.add(node)
    subgraph.inputNode.slots[0].connect(node.inputs[0], node)

    const originalInstance = createTestSubgraphNode(subgraph, { id: 601 })
    originalInstance.configure({
      id: 601,
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

    const restoredInstance = createTestSubgraphNode(subgraph, { id: 602 })
    restoredInstance.configure({
      ...serialized,
      id: 602,
      type: subgraph.id
    })

    expect(restoredInstance.widgets?.[0].value).toBe(33)

    widget.value = 45

    // Override remains sticky — interior change does not leak across the
    // per-instance boundary.
    expect(restoredInstance.widgets?.[0].value).toBe(33)
    expect(
      restoredInstance.widgets?.[0].serializeValue?.(restoredInstance, 0)
    ).toBe(33)
  })

  it('preserves per-instance values when reconfigured without widgets_values', () => {
    const subgraph = createTestSubgraph({
      inputs: [{ name: 'value', type: 'number' }]
    })

    const { node, widget } = createNodeWithWidget('TestNode', 5)
    subgraph.add(node)
    subgraph.inputNode.slots[0].connect(node.inputs[0], node)

    const instance = createTestSubgraphNode(subgraph, { id: 701 })
    instance.graph!.add(instance)

    const promotedWidget = instance.widgets?.[0]
    promotedWidget!.value = 11
    widget.value = 17

    const serialized = instance.serialize()
    delete serialized.widgets_values

    instance.configure({
      ...serialized,
      id: instance.id,
      type: subgraph.id
    })

    // Symmetric with super.configure(): absent widgets_values is a no-op
    // for widget values; the per-instance override is preserved.
    expect(instance.widgets?.[0].value).toBe(11)
    expect(instance.widgets?.[0].serializeValue?.(instance, 0)).toBe(11)
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

  it('serializes nested promoted widgets from the concrete source widget serialize state', () => {
    const leafSubgraph = createTestSubgraph({
      inputs: [{ name: 'value', type: 'number' }]
    })
    const concreteNode = new LGraphNode('ConcreteNode')
    const concreteInput = concreteNode.addInput('value', 'number')
    const concreteWidget = concreteNode.addWidget(
      'number',
      'value',
      5,
      () => {}
    )
    concreteInput.widget = { name: 'value' }
    leafSubgraph.add(concreteNode)
    leafSubgraph.inputNode.slots[0].connect(concreteInput, concreteNode)

    const middleNode = createTestSubgraphNode(leafSubgraph, { id: 901 })
    const middleSubgraph = createTestSubgraph({
      inputs: [{ name: 'value', type: 'number' }]
    })
    middleSubgraph.add(middleNode)
    middleNode._internalConfigureAfterSlots()
    middleSubgraph.inputNode.slots[0].connect(middleNode.inputs[0], middleNode)

    const innerHostNode = createTestSubgraphNode(middleSubgraph, { id: 902 })
    const outerSubgraph = createTestSubgraph({
      inputs: [{ name: 'value', type: 'number' }]
    })
    outerSubgraph.add(innerHostNode)
    innerHostNode._internalConfigureAfterSlots()
    outerSubgraph.inputNode.slots[0].connect(
      innerHostNode.inputs[0],
      innerHostNode
    )

    const outerHostNode = createTestSubgraphNode(outerSubgraph, { id: 903 })
    outerHostNode.graph!.add(outerHostNode)
    outerHostNode.widgets[0].value = 123

    expect(outerHostNode.serialize().widgets_values).toEqual([123])

    concreteWidget.serialize = false

    expect(outerHostNode.serialize().widgets_values).toBeUndefined()
  })

  it('does not clobber super.serialize() values when a concrete source widget is non-serializable', () => {
    const subgraph = createTestSubgraph({
      inputs: [{ name: 'value', type: 'number' }]
    })

    const { node, widget } = createNodeWithWidget('TestNode', 0)
    // Mark the concrete source widget non-serializable so the merge loop skips
    // index 0, letting super's value survive.
    widget.serialize = false
    subgraph.add(node)
    subgraph.inputNode.slots[0].connect(node.inputs[0], node)

    const instance = createTestSubgraphNode(subgraph, { id: 801 })
    instance.graph!.add(instance)

    // Stub super.serialize to simulate a native widget contributing a
    // positional value at index 0 (a slot the promoted view would own
    // if it were serializable, but this view skips because serialize:false).
    const SuperProto = Object.getPrototypeOf(Object.getPrototypeOf(instance))
    const originalSerialize = SuperProto.serialize as () => {
      widgets_values?: unknown[]
    }
    vi.spyOn(SuperProto, 'serialize').mockImplementationOnce(
      function (this: typeof instance) {
        const out = originalSerialize.call(this)
        out.widgets_values = ['native-value']
        return out
      }
    )

    const out = instance.serialize()

    expect(out.widgets_values?.[0]).toBe('native-value')
  })

  it('round-trips Date widget values via structuredClone (preserves type)', () => {
    const subgraph = createTestSubgraph({
      inputs: [{ name: 'value', type: 'number' }]
    })

    const { node } = createNodeWithWidget('TestNode', 0)
    subgraph.add(node)
    subgraph.inputNode.slots[0].connect(node.inputs[0], node)

    const instance = createTestSubgraphNode(subgraph, { id: 901 })
    instance.graph!.add(instance)

    const date = new Date('2025-01-01T00:00:00.000Z')
    instance.widgets[0].value = { when: date }

    const out = instance.serialize()
    const cloned = out.widgets_values?.[0] as { when: Date } | undefined
    expect(cloned?.when).toBeInstanceOf(Date)
    expect(cloned?.when.getTime()).toBe(date.getTime())
  })
})
