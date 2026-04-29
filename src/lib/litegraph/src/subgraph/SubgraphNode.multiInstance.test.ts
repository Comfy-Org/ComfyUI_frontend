import { createTestingPinia } from '@pinia/testing'
import { setActivePinia } from 'pinia'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

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

afterEach(() => {
  vi.restoreAllMocks()
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
    const innerNodeId = String(node.id)

    // Per-instance values are inlined as the optional {value} state on
    // each proxyWidgets entry so identity and value cannot desync.
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
      properties: {
        proxyWidgets: [[innerNodeId, 'widget', null, { value: 10 }]]
      }
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
      properties: {
        proxyWidgets: [[innerNodeId, 'widget', null, { value: 20 }]]
      }
    })

    const widgets1 = instance1.widgets!
    const widgets2 = instance2.widgets!

    expect(widgets1).toHaveLength(1)
    expect(widgets2).toHaveLength(1)
    expect(widgets1[0].value).toBe(10)
    expect(widgets2[0].value).toBe(20)
    expect(widgets1[0].serializeValue!(instance1, 0)).toBe(10)
    expect(widgets2[0].serializeValue!(instance2, 0)).toBe(20)

    const serialized1 = instance1.serialize()
    const serialized2 = instance2.serialize()
    expect(serialized1.widgets_values).toBeUndefined()
    expect(serialized2.widgets_values).toBeUndefined()
    expect(serialized1.properties?.proxyWidgets).toEqual([
      [innerNodeId, 'widget', null, { value: 10 }]
    ])
    expect(serialized2.properties?.proxyWidgets).toEqual([
      [innerNodeId, 'widget', null, { value: 20 }]
    ])
  })

  it('migrates legacy widgets_values per instance without sharing sibling state', () => {
    const subgraph = createTestSubgraph({
      inputs: [{ name: 'value', type: 'number' }]
    })

    const { node } = createNodeWithWidget('TestNode', 0)
    subgraph.add(node)
    subgraph.inputNode.slots[0].connect(node.inputs[0], node)

    const instance1 = createTestSubgraphNode(subgraph, { id: 203 })
    const instance2 = createTestSubgraphNode(subgraph, { id: 204 })

    instance1.configure({
      id: 203,
      type: subgraph.id,
      pos: [100, 100],
      size: [200, 100],
      inputs: [],
      outputs: [],
      mode: 0,
      order: 0,
      flags: {},
      properties: { proxyWidgets: [['-1', 'value']] },
      widgets_values: [10]
    })

    instance2.configure({
      id: 204,
      type: subgraph.id,
      pos: [400, 100],
      size: [200, 100],
      inputs: [],
      outputs: [],
      mode: 0,
      order: 1,
      flags: {},
      properties: { proxyWidgets: [['-1', 'value']] },
      widgets_values: [20]
    })

    expect(instance1.widgets?.[0].value).toBe(10)
    expect(instance2.widgets?.[0].value).toBe(20)
    expect(instance1.widgets?.[0].serializeValue?.(instance1, 0)).toBe(10)
    expect(instance2.widgets?.[0].serializeValue?.(instance2, 0)).toBe(20)
  })

  it('round-trips per-instance widget values through serialize and configure', () => {
    const subgraph = createTestSubgraph({
      inputs: [{ name: 'value', type: 'number' }]
    })

    const { node } = createNodeWithWidget('TestNode', 0)
    subgraph.add(node)
    subgraph.inputNode.slots[0].connect(node.inputs[0], node)

    const originalInstance = createTestSubgraphNode(subgraph, { id: 301 })
    const innerNodeId = String(node.id)
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
      properties: {
        proxyWidgets: [[innerNodeId, 'widget', null, { value: 33 }]]
      }
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

  it('keeps restored scoped value when the inner source widget changes directly', () => {
    const subgraph = createTestSubgraph({
      inputs: [{ name: 'value', type: 'number' }]
    })

    const { node, widget } = createNodeWithWidget('TestNode', 0)
    subgraph.add(node)
    subgraph.inputNode.slots[0].connect(node.inputs[0], node)

    const originalInstance = createTestSubgraphNode(subgraph, { id: 601 })
    const innerNodeId = String(node.id)
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
      properties: {
        proxyWidgets: [[innerNodeId, 'widget', null, { value: 33 }]]
      }
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

    expect(restoredInstance.widgets?.[0].value).toBe(33)
    expect(
      restoredInstance.widgets?.[0].serializeValue?.(restoredInstance, 0)
    ).toBe(33)
  })

  it('clears stale scoped values when reconfigured without inline value state', () => {
    const subgraph = createTestSubgraph({
      inputs: [{ name: 'value', type: 'number' }]
    })

    const { node, widget } = createNodeWithWidget('TestNode', 5)
    subgraph.add(node)
    subgraph.inputNode.slots[0].connect(node.inputs[0], node)

    const instance = createTestSubgraphNode(subgraph, { id: 701 })
    instance.graph!.add(instance)
    const innerNodeId = String(node.id)

    const promotedWidget = instance.widgets?.[0]
    promotedWidget!.value = 11
    widget.value = 17

    const serialized = instance.serialize()
    delete serialized.widgets_values
    serialized.properties = {
      ...serialized.properties,
      proxyWidgets: [[innerNodeId, 'widget']]
    }

    instance.configure({
      ...serialized,
      id: instance.id,
      type: subgraph.id
    })

    expect(instance.widgets?.[0].value).toBe(17)
    expect(instance.widgets?.[0].serializeValue?.(instance, 0)).toBe(17)
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
      properties: { proxyWidgets: [['-1', 'value']] },
      widgets_values: []
    })

    const serialized = instance.serialize()
    expect(serialized.widgets_values).toBeUndefined()
  })

  it('does not write widgets_values on SubgraphNode (fix for #10849 template corruption regression)', () => {
    const subgraph = createTestSubgraph({
      inputs: [{ name: 'value', type: 'number' }]
    })

    const { node } = createNodeWithWidget('TestNode', 42)
    subgraph.add(node)
    subgraph.inputNode.slots[0].connect(node.inputs[0], node)

    const instance = createTestSubgraphNode(subgraph, { id: 801 })
    instance.graph!.add(instance)

    expect(instance.serialize().widgets_values).toBeUndefined()
  })

  it('migrates aligned legacy widgets_values into scoped promoted state on load', () => {
    const subgraph = createTestSubgraph({
      inputs: [{ name: 'value', type: 'number' }]
    })

    const SOURCE_DEFAULT = 42
    const LEGACY_VALUE = 999

    const { node } = createNodeWithWidget('TestNode', SOURCE_DEFAULT)
    subgraph.add(node)
    subgraph.inputNode.slots[0].connect(node.inputs[0], node)

    const instance = createTestSubgraphNode(subgraph, { id: 802 })
    instance.configure({
      id: 802,
      type: subgraph.id,
      pos: [100, 100],
      size: [200, 100],
      inputs: [],
      outputs: [],
      mode: 0,
      order: 0,
      flags: {},
      properties: { proxyWidgets: [['-1', 'value']] },
      widgets_values: [LEGACY_VALUE]
    })

    const widget = instance.widgets?.[0]
    expect(widget?.value).toBe(LEGACY_VALUE)
    expect(widget?.serializeValue?.(instance, 0)).toBe(LEGACY_VALUE)

    const serialized = instance.serialize()
    expect(serialized.widgets_values).toBeUndefined()
    expect(serialized.properties?.proxyWidgets).toEqual([
      [String(node.id), 'widget', null, { value: LEGACY_VALUE }]
    ])
  })

  it('does not corrupt unbound promoted widgets when widgets_values length mismatches view count (regression for #10849)', () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {})
    const subgraph = createTestSubgraph({
      inputs: [{ name: 'value', type: 'number' }]
    })

    const SOURCE_DEFAULT = 42
    const LEGACY_NOISE_A = 111
    const LEGACY_NOISE_B = 222

    const { node } = createNodeWithWidget('TestNode', SOURCE_DEFAULT)
    subgraph.add(node)
    subgraph.inputNode.slots[0].connect(node.inputs[0], node)

    const instance = createTestSubgraphNode(subgraph, { id: 803 })
    instance.configure({
      id: 803,
      type: subgraph.id,
      pos: [100, 100],
      size: [200, 100],
      inputs: [],
      outputs: [],
      mode: 0,
      order: 0,
      flags: {},
      properties: { proxyWidgets: [['-1', 'value']] },
      widgets_values: [LEGACY_NOISE_A, LEGACY_NOISE_B]
    })

    const widget = instance.widgets?.[0]
    expect(widget?.value).toBe(SOURCE_DEFAULT)
    expect(widget?.value).not.toBe(LEGACY_NOISE_A)
    expect(warn).toHaveBeenCalledWith(
      '[SubgraphNode] Legacy widgets_values length (2) does not match proxyWidgets length (1); dropping legacy values for instance 803.'
    )
  })

  it('rejects uncloneable promoted widget values', () => {
    const subgraph = createTestSubgraph({
      inputs: [{ name: 'value', type: 'number' }]
    })
    const { node, widget } = createNodeWithWidget('TestNode', 0)
    subgraph.add(node)
    subgraph.inputNode.slots[0].connect(node.inputs[0], node)

    const instance = createTestSubgraphNode(subgraph, { id: 901 })
    instance.graph!.add(instance)

    const uncloneable = { fn: () => 'nope' }
    const promotedWidget = instance.widgets![0]

    expect(() => {
      promotedWidget.value = uncloneable as unknown as typeof widget.value
    }).toThrow()
  })
})
