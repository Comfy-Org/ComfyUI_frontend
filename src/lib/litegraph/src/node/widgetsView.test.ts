import { assert, beforeEach, describe, expect, it, vi } from 'vitest'

import { LGraph, LGraphNode, LiteGraph } from '@/lib/litegraph/src/litegraph'
import type { IBaseWidget } from '@/lib/litegraph/src/types/widgets'
import { LegacyWidget } from '@/lib/litegraph/src/widgets/LegacyWidget'
import { BooleanWidget } from '@/lib/litegraph/src/widgets/BooleanWidget'
import { useWidgetValueStore } from '@/stores/widgetValueStore'
import { widgetId } from '@/types/widgetId'

const foreignBehavior = Symbol('foreignBehavior')

class ForeignWidget implements IBaseWidget {
  [symbol: symbol]: boolean
  private drawResult = 'drawn'
  private storedName = 'foreign'
  private storedValue = 10
  private symbolReads = 0
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
    return this.storedName
  }

  set name(name: string) {
    this.nameWrites++
    this.storedName = name
  }

  get value() {
    this.valueReads++
    return this.storedValue
  }

  set value(value: number) {
    this.valueWrites++
    this.storedValue = value
  }

  get [foreignBehavior]() {
    this.symbolReads++
    return this.symbolReads > 0
  }

  draw() {
    return this.drawResult
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

function nonExtensibleWidget(onRemove?: IBaseWidget['onRemove']): IBaseWidget {
  return Object.preventExtensions<IBaseWidget>({
    name: 'wrapped',
    type: 'number',
    value: 10,
    options: {},
    y: 0,
    onRemove
  })
}

/** Node packs rebuild `node.widgets` by writing to the array directly. */
describe('widgets view', () => {
  beforeEach(() => {
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
    node.widgets.push(widget)

    expect(node.widgets[0]).toBe(widget)
    expect(widget).toBeInstanceOf(LegacyWidget)
    expect(storedOrder(node)).toEqual(['custom'])
    expect(storedValue(widget)).toBe(10)
  })

  it('deduplicates a raw source inserted before its installed wrapper', () => {
    const node = new LGraphNode('test')
    const source = nonExtensibleWidget()
    node.widgets = [source]
    const wrapped = node.widgets[0]

    node.widgets.unshift(source)

    expect(node.widgets).toEqual([wrapped])
  })

  it('deduplicates repeated direct pushes of one legacy source', () => {
    const node = new LGraphNode('test')
    const source = nonExtensibleWidget()

    node.widgets = [source, source]

    expect(node.widgets).toHaveLength(1)
  })

  it('rebuilds a wrapper removed directly through the widgets view', () => {
    const node = new LGraphNode('test')
    const source = nonExtensibleWidget()
    node.widgets = [source]
    const first = node.widgets[0]

    node.widgets.splice(0, 1)
    source.value = 20
    const second = node.addCustomWidget(source)

    expect(second).not.toBe(first)
    expect(second.value).toBe(20)
  })

  it('keeps a wrapped legacy widget during an in-place reorder', () => {
    const node = new LGraphNode('test')
    const source = nonExtensibleWidget()
    node.widgets = [source]
    const wrapped = node.widgets[0]
    const other = node.addWidget('number', 'other', 20, null)

    node.widgets[1] = wrapped
    node.widgets[0] = other

    expect(node.widgets).toEqual([other, wrapped])
  })

  it('retains source identity while a wrapper is reordered', () => {
    const node = new LGraphNode('test')
    const source = nonExtensibleWidget()
    node.widgets = [source]
    const wrapped = node.widgets[0]
    const other = node.addWidget('number', 'other', 20, null)

    node.widgets.splice(0, 1)
    node.widgets.push(wrapped)
    node.addCustomWidget(source)

    expect(node.widgets).toEqual([other, wrapped])
  })

  it('refreshes a wrapper when its source type changes', () => {
    const node = new LGraphNode('test')
    const onRemove = vi.fn()
    const source = nonExtensibleWidget(onRemove)
    const original = node.addCustomWidget(source)
    const input = node.addInput('wrapped', 'number', {
      widget: { name: 'wrapped' },
      _widget: original
    })

    source.type = 'toggle'
    const refreshed = node.addCustomWidget(source)

    expect(refreshed).toBeInstanceOf(BooleanWidget)
    expect(node.widgets).toEqual([refreshed])
    expect(input._widget).toBe(refreshed)
    expect(onRemove).not.toHaveBeenCalled()

    node.removeWidget(refreshed)
    expect(onRemove).toHaveBeenCalledOnce()
  })

  it('retains an installed wrapper whose local type changes', () => {
    const node = new LGraphNode('test')
    const source = nonExtensibleWidget()
    const installed = node.addCustomWidget(source)

    installed.type = 'hidden'
    const returned = node.addCustomWidget(source)

    expect(returned).toBe(installed)
    expect(node.widgets).toEqual([installed])
    expect(installed.type).toBe('hidden')
  })

  it('refreshes a changed raw source in its installed slot', () => {
    const graph = new LGraph()
    const node = new LGraphNode('test')
    graph.add(node)
    const before = node.addWidget('number', 'before', 1, null)
    const onRemove = vi.fn()
    const source = nonExtensibleWidget(onRemove)
    const installed = node.addCustomWidget(source)
    const after = node.addWidget('number', 'after', 2, null)
    const previousId = widgetId(graph.rootGraph.id, node.id, source.name)
    const input = node.addInput('wrapped', 'number', {
      widget: { name: 'wrapped' },
      _widget: installed
    })

    source.name = 'renamed'
    source.type = 'toggle'
    assert.exists(node.widgets)
    node.widgets.unshift(source)

    const refreshed = node.widgets[1]
    expect(node.widgets).toEqual([before, refreshed, after])
    expect(refreshed).toBeInstanceOf(BooleanWidget)
    expect(input._widget).toBe(refreshed)
    expect(onRemove).not.toHaveBeenCalled()
    expect(useWidgetValueStore().getWidget(previousId)).toBeUndefined()
    expect(
      useWidgetValueStore()
        .getNodeWidgets(graph.rootGraph.id, node.id)
        .map((widget) => widget.type)
    ).toEqual(['number', 'toggle', 'number'])

    node.removeWidget(refreshed)
    expect(onRemove).toHaveBeenCalledOnce()
  })

  it.for(
    (
      [
        {
          entry: 'addCustomWidget',
          refresh(node: LGraphNode, source: IBaseWidget) {
            return node.addCustomWidget(source)
          }
        },
        {
          entry: 'widgets.push',
          refresh(node: LGraphNode, source: IBaseWidget) {
            node.widgets?.push(source)
            return node.widgets?.find(
              (widget) => widget instanceof BooleanWidget
            )
          }
        }
      ] as const
    ).flatMap((path) =>
      (
        [
          {
            callback: 'throws',
            implementation: () => {
              throw new Error('extension teardown failed')
            }
          },
          {
            callback: 'mutates the widget list',
            implementation: (node: LGraphNode) => {
              node.widgets?.splice(0, 1)
            }
          }
        ] as const
      ).map((callback) => ({ path, callback }))
    )
  )(
    'does not run source teardown during refresh through $path.entry when it $callback.callback',
    ({ path, callback }) => {
      const graph = new LGraph()
      const node = new LGraphNode('test')
      graph.add(node)
      const before = node.addWidget('number', 'before', 1, null)
      const onRemove = vi.fn(() => callback.implementation(node))
      const source = nonExtensibleWidget(onRemove)
      const installed = node.addCustomWidget(source)
      const after = node.addWidget('number', 'after', 2, null)
      const input = node.addInput('wrapped', 'number', {
        widget: { name: 'wrapped' },
        _widget: installed
      })

      source.type = 'toggle'
      let refreshed: IBaseWidget | undefined
      expect(() => {
        refreshed = path.refresh(node, source)
      }).not.toThrow()

      expect(refreshed).toBeInstanceOf(BooleanWidget)
      expect(node.widgets).toEqual([before, refreshed, after])
      expect(input._widget).toBe(refreshed)
      expect(onRemove).not.toHaveBeenCalled()
      expect(
        useWidgetValueStore()
          .getNodeWidgets(graph.rootGraph.id, node.id)
          .map((widget) => widget.type)
      ).toEqual(['number', 'toggle', 'number'])
    }
  )

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
