import { afterEach, beforeEach, describe, expect, it } from 'vitest'

import { LGraph, LGraphNode, LiteGraph } from '@/lib/litegraph/src/litegraph'

import {
  captureWidgetRestorationSlots,
  clearWidgetRestorationSlots,
  getWidgetRestorationSlot
} from './widgetsView'

describe('restoring values onto a node that refused a widget', () => {
  const namedValuesRestore = LiteGraph.namedValuesRestore

  beforeEach(() => {
    class Pinned extends LGraphNode {
      constructor(title?: string) {
        super(title ?? 'Pinned')
        this.serialize_widgets = true
        this.addWidget('number', 'a', 0, () => {})
        const duplicate = this.addWidget('number', 'a', 0, () => {})
        Object.defineProperty(duplicate, 'name', {
          value: 'a',
          writable: false,
          configurable: false,
          enumerable: true
        })
        this.addWidget('number', 'b', 0, () => {})
      }
    }

    class Renamable extends LGraphNode {
      constructor(title?: string) {
        super(title ?? 'Renamable')
        this.serialize_widgets = true
        this.addWidget('number', 'a', 0, () => {})
        this.addWidget('number', 'a', 0, () => {})
        this.addWidget('number', 'b', 0, () => {})
      }
    }

    LiteGraph.registerNodeType('test/pinned-duplicate', Pinned)
    LiteGraph.registerNodeType('test/renamable-duplicate', Renamable)
  })

  afterEach(() => {
    LiteGraph.namedValuesRestore = namedValuesRestore
  })

  function load(type: string, named?: Record<string, number>) {
    const graph = new LGraph()
    graph.configure({
      ...graph.asSerialisable(),
      nodes: [
        {
          id: 1,
          type,
          pos: [0, 0],
          size: [200, 100],
          flags: {},
          order: 0,
          mode: 0,
          widgets_values: [1, 2, 3],
          ...(named ? { widgets_values_named: named } : {})
        }
      ]
    })
    const node = graph.nodes[0]

    return {
      graph,
      node,
      names: (node.widgets ?? []).map((widget) => widget.name),
      values: (node.widgets ?? []).map((widget) => widget.value)
    }
  }

  it('keeps every saved value when the duplicate could be renamed apart', () => {
    const { names, values } = load('test/renamable-duplicate')

    expect({ names, values }).toEqual({
      names: ['a', 'a#1', 'b'],
      values: [1, 2, 3]
    })
  })

  it('does not override ordinary positional restoration without a refusal', () => {
    const node = new LGraphNode('ordinary')
    node.addWidget('number', 'a', 0, () => {})
    const b = node.addWidget('number', 'b', 0, () => {})
    captureWidgetRestorationSlots(node)

    expect(getWidgetRestorationSlot(node, b, 0, 2)).toBe(0)
    clearWidgetRestorationSlots(node)
  })

  it('restores the right value from a name register, refusal or not', () => {
    LiteGraph.namedValuesRestore = true

    const { names, values } = load('test/pinned-duplicate', { a: 1, b: 3 })

    expect({ names, values }).toEqual({
      names: ['a', 'b'],
      values: [1, 3]
    })
  })

  it('preserves surviving widget positions when a duplicate is refused during load', () => {
    LiteGraph.namedValuesRestore = false
    const { names, values } = load('test/pinned-duplicate')

    expect({ names, values }).toEqual({
      names: ['a', 'b'],
      values: [1, 3]
    })
  })

  it('does not retain the refused-slot mapping after the load', () => {
    LiteGraph.namedValuesRestore = false
    const { node } = load('test/pinned-duplicate')

    node.configure({
      id: node.id,
      type: node.type,
      pos: [0, 0],
      size: [200, 100],
      flags: {},
      order: 0,
      mode: 0,
      widgets_values: [4, 5]
    })

    expect(node.widgets?.map((widget) => widget.value)).toEqual([4, 5])
  })

  it('round trips the compacted values after refusing the duplicate', () => {
    LiteGraph.namedValuesRestore = false
    const { graph } = load('test/pinned-duplicate')
    const serialized = graph.serialize()

    graph.configure(serialized)

    expect(graph.nodes[0].widgets?.map((widget) => widget.value)).toEqual([
      1, 3
    ])
  })
})
