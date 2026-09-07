import { createTestingPinia } from '@pinia/testing'
import { setActivePinia } from 'pinia'
import { beforeEach, describe, expect, test, vi } from 'vitest'
import { computed, effect, nextTick, stop, watch } from 'vue'

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

  test('reading an upgraded slot does not notify again', async () => {
    const node = new LGraphNode('test')
    const slots = computed(() => [...node.inputs])
    const onChange = vi.fn()
    watch(slots, onChange)
    expect(slots.value).toEqual([])

    node.inputs[0] = {
      name: 'input',
      type: 'INT',
      link: null,
      boundingRect: new Float64Array(4)
    }
    await nextTick()
    expect(onChange).toHaveBeenCalledOnce()

    void node.inputs
    void node.inputs
    await nextTick()

    expect(onChange).toHaveBeenCalledOnce()
  })

  test('preserves widget slot position identity when geometry is unchanged', () => {
    const graph = new LGraph()
    const node = new LGraphNode('test')
    let spacerHeight = 20
    const spacer = node.addWidget('number', 'spacer', 0, () => undefined, {})
    spacer.computeSize = () => [100, spacerHeight]
    const widget = node.addWidget('number', 'value', 0, () => undefined, {})
    const input = node.addInput('value', 'INT')
    input.widget = { name: widget.name }
    input._widget = widget
    graph.add(node)
    node._setConcreteSlots()

    node.arrange()
    const slot = node.inputs[0]
    const initialPosition = slot.pos
    node.arrange()

    expect(slot.pos).toBe(initialPosition)

    spacerHeight = 40
    node.arrange()

    expect(slot.pos).not.toBe(initialPosition)
    expect(slot.pos?.[1]).toBeGreaterThan(initialPosition?.[1] ?? 0)
  })

  test('preserves widget-backed slot position identity', () => {
    const graph = new LGraph()
    const node = new LGraphNode('test')
    graph.add(node)
    const widget = node.addWidget('text', 'value', '', null)
    const input = node.addInput('value', 'STRING')
    input.widget = { name: 'value' }
    node._setConcreteSlots()

    let runs = 0
    const runner = effect(() => {
      runs++
      void input.pos
    })

    node.arrange()
    const position = input.pos
    expect(position).toBeDefined()
    if (!position) throw new Error('Expected widget-backed slot position')
    expect(position[1]).toBe(widget.y + 10)
    expect(runs).toBe(2)

    position[0] = 33
    expect(input.pos).toBe(position)
    expect(position[0]).toBe(33)
    expect(runs).toBe(2)
    stop(runner)
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
