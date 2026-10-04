import { describe, expect, it } from 'vitest'

import { LGraph, LGraphNode } from '@/lib/litegraph/src/litegraph'
import type { IBaseWidget } from '@/lib/litegraph/src/types/widgets'
import { useWidgetValueStore } from '@/stores/widgetValueStore'
import { widgetId } from '@/types/widgetId'

/**
 * A widget can register under a unique name and only later be pinned onto a
 * name another widget holds — `Object.defineProperty` bypasses the setter, so
 * the store entry stays under the earlier name while the node refuses the
 * widget. `registerWidget` keeps an existing value for a same-type
 * re-registration, so that entry would hand its value to the next widget of
 * that name.
 */
describe('the store entry of a refused widget', () => {
  function pinName(widget: IBaseWidget, name: string): void {
    Object.defineProperty(widget, 'name', {
      value: name,
      writable: false,
      configurable: false,
      enumerable: true
    })
  }

  function nodeWithRefusedWidget() {
    const graph = new LGraph()
    const node = new LGraphNode('test')
    graph.add(node)
    const kept = node.addWidget('number', 'seed', 1, () => {})
    const refused = node.addWidget('number', 'seed', 2, () => {})
    refused.value = 42
    const registeredName = refused.name
    pinName(refused, 'seed')
    node.addWidget('number', 'steps', 0, () => {})

    return {
      node,
      kept,
      registeredName,
      graphId: node.graph!.rootGraph.id
    }
  }

  it('is released, so a later widget of that name keeps its own value', () => {
    const { node, registeredName, graphId } = nodeWithRefusedWidget()

    expect(
      useWidgetValueStore().getWidget(
        widgetId(graphId, node.id, registeredName)
      )
    ).toBeUndefined()
    expect(node.addWidget('number', registeredName, 7, () => {}).value).toBe(7)
  })

  it('is released without disturbing the widget that kept the name', () => {
    const { node, kept, graphId } = nodeWithRefusedWidget()

    expect(kept.value).toBe(1)
    expect(
      useWidgetValueStore().getWidget(widgetId(graphId, node.id, 'seed'))?.value
    ).toBe(1)
    expect((node.widgets ?? []).map((widget) => widget.name)).toEqual([
      'seed',
      'steps'
    ])
  })
})
