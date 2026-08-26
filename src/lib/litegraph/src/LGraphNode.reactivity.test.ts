import { createTestingPinia } from '@pinia/testing'
import { setActivePinia } from 'pinia'
import { beforeEach, describe, expect, test, vi } from 'vitest'
import { computed, nextTick, watch } from 'vue'

import { LGraph, LGraphNode } from './litegraph'
import type { IBaseWidget } from './types/widgets'
import { useWidgetValueStore } from '@/stores/widgetValueStore'

beforeEach(() => {
  setActivePinia(createTestingPinia({ stubActions: false }))
})

describe('_setConcreteSlots', () => {
  test('per-frame calls do not invalidate slot-array subscribers', async () => {
    const graph = new LGraph()
    const node = new LGraphNode('test')
    node.addInput('a', 'INT')
    node.addInput('b', 'INT')
    graph.add(node)

    const names = computed(() => node.inputs.map((i) => i.name).join(','))
    const onChange = vi.fn()
    watch(names, onChange)
    expect(names.value).toBe('a,b')

    for (let frame = 0; frame < 100; frame++) node._setConcreteSlots()
    await nextTick()

    expect(onChange).not.toHaveBeenCalled()
  })

  test('a real slot change still notifies', async () => {
    const graph = new LGraph()
    const node = new LGraphNode('test')
    node.addInput('a', 'INT')
    graph.add(node)

    const names = computed(() => node.inputs.map((i) => i.name).join(','))
    const onChange = vi.fn()
    watch(names, onChange)
    expect(names.value).toBe('a')

    node.addInput('b', 'INT')
    await nextTick()

    expect(onChange).toHaveBeenCalledTimes(1)
  })
})

describe('widgets array reactivity', () => {
  test('keeps one view and synchronizes direct replacements and mutations', () => {
    const graph = new LGraph()
    const node = new LGraphNode('test')
    node.addWidget('number', 'a', 1, () => undefined, {})
    node.addWidget('number', 'b', 2, () => undefined, {})
    node.addWidget('number', 'c', 3, () => undefined, {})
    graph.add(node)

    const widgets = node.widgets!
    const removedWidgetId = widgets[0].widgetId!
    node.widgets = [widgets[2], widgets[0], widgets[1]]
    node.widgets.splice(1, 1)

    const widgetValueStore = useWidgetValueStore()
    expect(node.widgets).toBe(widgets)
    expect(node.widgets.map((widget) => widget.name)).toEqual(['c', 'b'])
    expect(
      widgetValueStore
        .getNodeWidgets(graph.rootGraph.id, node.id)
        .map((widget) => widget.name)
    ).toEqual(['c', 'b'])
    expect(widgetValueStore.getWidget(removedWidgetId)?.value).toBe(1)
  })

  test('normalizes widget class fields when attaching the node', () => {
    class NodeWithWidgetField extends LGraphNode {
      override widgets: IBaseWidget[] = []
    }
    const graph = new LGraph()
    const node = new NodeWithWidgetField('test')
    node.addWidget('number', 'a', 1, () => undefined, {})
    node.addWidget('number', 'b', 2, () => undefined, {})
    graph.add(node)

    const widgets = node.widgets
    node.widgets.reverse()

    expect(node.widgets).toBe(widgets)
    expect(
      useWidgetValueStore()
        .getNodeWidgets(graph.rootGraph.id, node.id)
        .map((widget) => widget.name)
    ).toEqual(['b', 'a'])
  })

  test('deletes removed widget state instead of restoring it later', () => {
    const graph = new LGraph()
    const node = new LGraphNode('test')
    graph.add(node)
    const removed = node.addWidget('number', 'value', 1, () => undefined, {})
    removed.value = 2

    node.removeWidget(removed)
    const replacement = node.addWidget(
      'number',
      'value',
      3,
      () => undefined,
      {}
    )

    expect(replacement.value).toBe(3)
    const replacementId = replacement.widgetId
    expect(replacementId).toBeDefined()
    if (!replacementId) throw new Error('expected registered widget')
    expect(useWidgetValueStore().getWidget(replacementId)?.value).toBe(3)
  })

  test('notifies readers when a widget is removed in place', async () => {
    const graph = new LGraph()
    const node = new LGraphNode('test')
    node.addWidget('number', 'a', 1, () => undefined, {})
    node.addWidget('number', 'b', 2, () => undefined, {})
    node.addWidget('number', 'c', 3, () => undefined, {})
    graph.add(node)

    const names = computed(() => node.widgets?.map((w) => w.name).join(','))
    const onChange = vi.fn()
    watch(names, onChange)
    expect(names.value).toBe('a,b,c')

    node.widgets!.pop()
    await nextTick()
    expect(names.value).toBe('a,b')
    node.widgets!.splice(0, 1)
    await nextTick()
    expect(names.value).toBe('b')
    node.widgets!.length = 0
    await nextTick()
    expect(names.value).toBe('')
    expect(onChange).toHaveBeenCalledTimes(3)
  })

  test('leaves widgets undefined for a node with none', () => {
    const node = new LGraphNode('test')
    expect(node.widgets).toBeUndefined()
    expect(node.serialize().widgets_values).toBeUndefined()
  })
})
