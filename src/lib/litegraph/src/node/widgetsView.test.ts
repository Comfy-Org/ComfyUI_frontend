import { createTestingPinia } from '@pinia/testing'
import { setActivePinia } from 'pinia'
import { beforeEach, describe, expect, it } from 'vitest'

import { LGraph, LGraphNode, LiteGraph } from '@/lib/litegraph/src/litegraph'
import type { IBaseWidget } from '@/lib/litegraph/src/types/widgets'
import { LegacyWidget } from '@/lib/litegraph/src/widgets/LegacyWidget'
import { useWidgetValueStore } from '@/stores/widgetValueStore'
import { widgetId } from '@/types/widgetId'

const foreignBehavior = Symbol('foreignBehavior')

class ForeignWidget implements IBaseWidget {
  [symbol: symbol]: boolean
  #drawResult = 'drawn'
  #name = 'foreign'
  #value = 10
  #symbolReads = 0
  type = 'foreign_test'
  options = {}
  y = 0
  height = 24
  nameReads = 0
  nameWrites = 0
  valueReads = 0
  valueWrites = 0
  foreignClicks = 0

  get name() {
    this.nameReads++
    return this.#name
  }

  set name(name: string) {
    this.nameWrites++
    this.#name = name
  }

  get value() {
    this.valueReads++
    return this.#value
  }

  set value(value: number) {
    this.valueWrites++
    this.#value = value
  }

  get [foreignBehavior]() {
    this.#symbolReads++
    return this.#symbolReads > 0
  }

  draw() {
    return this.#drawResult
  }

  mouse() {
    return true
  }

  computeSize(): [number, number] {
    return [120, 24]
  }

  onClick() {
    this.foreignClicks++
  }
}

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
    LiteGraph.vueNodesMode = false
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

  it.for(
    ([false, true] as const).flatMap(
      (vueNodesMode) =>
        [
          [
            vueNodesMode,
            'addCustomWidget',
            (node: LGraphNode, widget: ForeignWidget) =>
              node.addCustomWidget(widget)
          ],
          [
            vueNodesMode,
            'widgets.push',
            (node: LGraphNode, widget: ForeignWidget) => {
              node.widgets ||= []
              node.widgets.push(widget)
              return node.widgets.at(-1)
            }
          ]
        ] as const
    )
  )(
    'preserves foreign widget behavior through $1 with VueNodes=$0',
    ([vueNodesMode, , addWidget]) => {
      LiteGraph.vueNodesMode = vueNodesMode
      const graph = new LGraph()
      const node = new LGraphNode('test')
      graph.add(node)
      const widget = new ForeignWidget()
      expect(Object.getOwnPropertyDescriptor(widget, 'height')?.writable).toBe(
        true
      )
      const result = addWidget(node, widget)

      expect(result).toBe(widget)
      expect(() => (widget.height = 48)).not.toThrow()
      expect(widget.height).toBe(48)
      expect(widget.draw()).toBe('drawn')
      expect(widget.mouse()).toBe(true)
      expect(widget.computeSize()).toEqual([120, 24])
      expect(widget[foreignBehavior]).toBe(true)
      widget.onClick()
      expect(widget.foreignClicks).toBe(0)
      expect(storedOrder(node)).toEqual(['foreign'])
      expect(storedValue(widget)).toBe(10)
      const nameReadsAfterNormalization = widget.nameReads
      expect(widget.name).toBe('foreign')
      expect(widget.nameReads).toBe(nameReadsAfterNormalization + 1)
      widget.name = 'renamed'
      expect(widget.nameWrites).toBe(1)
      const graphId = node.graph!.rootGraph.id
      const store = useWidgetValueStore()
      expect(
        store.getWidget(widgetId(graphId, node.id, 'foreign'))
      ).toBeUndefined()
      expect(store.getWidget(widgetId(graphId, node.id, 'renamed'))?.name).toBe(
        'renamed'
      )
      expect(storedOrder(node)).toEqual(['renamed'])
      const valueReadsAfterNormalization = widget.valueReads
      expect(widget.value).toBe(10)
      expect(widget.valueReads).toBe(valueReadsAfterNormalization + 1)

      widget.value = 25
      expect(widget.valueWrites).toBe(1)
      expect(storedValue(widget)).toBe(25)
    }
  )
})
