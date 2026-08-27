import { createTestingPinia } from '@pinia/testing'
import { setActivePinia } from 'pinia'
import { beforeEach, describe, expect, it } from 'vitest'

import { LGraph, LGraphNode } from '@/lib/litegraph/src/litegraph'
import type { IBaseWidget } from '@/lib/litegraph/src/types/widgets'
import { LegacyWidget } from '@/lib/litegraph/src/widgets/LegacyWidget'
import { useWidgetValueStore } from '@/stores/widgetValueStore'

function createNodeWithWidgets(values: Record<string, number>) {
  const graph = new LGraph()
  const node = new LGraphNode('test')
  graph.add(node)
  for (const [name, value] of Object.entries(values)) {
    node.addWidget('number', name, value, () => undefined, {})
  }
  return { node, widgets: [...node.widgets!] }
}

function storedOrder(node: LGraphNode): string[] {
  return useWidgetValueStore()
    .getNodeWidgets(node.graph!.rootGraph.id, node.id)
    .map((widget) => widget.name)
}

function storedValue(widget: IBaseWidget) {
  return useWidgetValueStore().getWidget(widget.widgetId!)?.value
}

/** Node packs rebuild `node.widgets` by writing to the array directly. */
describe('widgets view', () => {
  beforeEach(() => {
    setActivePinia(createTestingPinia({ stubActions: false }))
  })

  it('restores order and value when a widget is spliced out and pushed back', () => {
    const { node, widgets } = createNodeWithWidgets({ a: 10, b: 20, c: 30 })
    const [removed] = widgets

    node.widgets!.splice(0, 1)
    node.widgets!.push(removed)

    expect(storedOrder(node)).toEqual(['b', 'c', 'a'])
    expect(storedValue(removed)).toBe(10)
  })

  it('commits order when a slot is assigned by index', () => {
    const { node, widgets } = createNodeWithWidgets({ a: 10, b: 20, c: 30 })

    node.widgets![0] = widgets[2]
    node.widgets![2] = widgets[0]

    expect(storedOrder(node)).toEqual(['c', 'b', 'a'])
  })

  it('commits order when the array is truncated by length', () => {
    const { node, widgets } = createNodeWithWidgets({ a: 10, b: 20, c: 30 })

    node.widgets!.length = 2

    expect(storedOrder(node)).toEqual(['a', 'b'])
    expect(storedValue(widgets[2])).toBe(30)
  })

  it('clears order but keeps values when widgets are unset', () => {
    const { node, widgets } = createNodeWithWidgets({ a: 10, b: 20 })

    node.widgets = undefined

    expect(node.widgets).toBeUndefined()
    expect(storedOrder(node)).toEqual([])
    expect(storedValue(widgets[0])).toBe(10)
  })

  it('commits order when widgets are assigned back after being unset', () => {
    const { node, widgets } = createNodeWithWidgets({ a: 10, b: 20 })

    node.widgets = undefined
    node.widgets = [widgets[1], widgets[0]]

    expect(storedOrder(node)).toEqual(['b', 'a'])
  })

  it('normalizes a plain widget pushed into the live array', () => {
    const graph = new LGraph()
    const node = new LGraphNode('test')
    graph.add(node)
    const widget: IBaseWidget = {
      name: 'custom',
      type: 'legacy_test',
      value: 10,
      options: {},
      y: 0
    }

    node.widgets ||= []
    node.widgets!.push(widget)

    expect(node.widgets![0]).toBe(widget)
    expect(widget).toBeInstanceOf(LegacyWidget)
    expect(storedOrder(node)).toEqual(['custom'])
    expect(storedValue(widget)).toBe(10)
  })
})
