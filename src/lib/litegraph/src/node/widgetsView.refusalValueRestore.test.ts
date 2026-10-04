import { afterEach, beforeEach, describe, expect, it } from 'vitest'

import { LGraph, LGraphNode, LiteGraph } from '@/lib/litegraph/src/litegraph'

/**
 * What a refusal does to the values of a workflow saved before it existed.
 * Positional restore counts the widgets the node has *now*, so a removed
 * widget's slot is taken by the next widget. ADR-ECS-0008 records that as
 * accepted and names the conditions; these cases pin it so it stays a decision
 * rather than a surprise.
 */
describe('restoring values onto a node that refused a widget', () => {
  const namedValuesRestore = LiteGraph.namedValuesRestore

  beforeEach(() => {
    class Pinned extends LGraphNode {
      constructor(title?: string) {
        super(title ?? 'Pinned')
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

  /**
   * `LGraph.configure` adds each node and configures it afterwards, so the
   * refusal has already run by the time values are restored.
   */
  function load(type: string, named?: Record<string, number>) {
    const graph = new LGraph()
    const node = LiteGraph.createNode(type)!
    graph.add(node)
    node.configure({
      id: node.id,
      type,
      pos: [0, 0],
      size: [200, 100],
      flags: {},
      order: 0,
      mode: 0,
      widgets_values: [1, 2, 3],
      ...(named ? { widgets_values_named: named } : {})
    })

    return {
      names: (node.widgets ?? []).map((widget) => widget.name),
      values: (node.widgets ?? []).map((widget) => widget.value)
    }
  }

  it('keeps every saved value when the duplicate could be renamed apart', () => {
    expect(load('test/renamable-duplicate')).toEqual({
      names: ['a', 'a#1', 'b'],
      values: [1, 2, 3]
    })
  })

  it('restores the right value from a name register, refusal or not', () => {
    LiteGraph.namedValuesRestore = true

    expect(load('test/pinned-duplicate', { a: 1, b: 3 })).toEqual({
      names: ['a', 'b'],
      values: [1, 3]
    })
  })

  it('shifts the values after a refused widget when only positions were saved', () => {
    LiteGraph.namedValuesRestore = false

    expect(load('test/pinned-duplicate')).toEqual({
      names: ['a', 'b'],
      values: [1, 2]
    })
  })
})
