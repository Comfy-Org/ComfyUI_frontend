import { describe, expect, test, vi } from 'vitest'

import { LGraph, LGraphNode } from '@/lib/litegraph/src/litegraph'
import type { IBaseWidget } from '@comfyorg/graph-model/widgets'
import { addWidget, DOMWidgetImpl } from '@/scripts/domWidget'
import { useDomWidgetStore } from '@/stores/domWidgetStore'

vi.mock(import('@/utils/formatUtil'), () => ({
  generateUUID: vi.fn(() => 'test-uuid')
}))

describe('BaseDOMWidgetImpl.isVisible', () => {
  test('returns false when the widget is computedDisabled (its input slot is linked)', () => {
    const node = new LGraphNode('test-node')
    const widget = new DOMWidgetImpl({
      node,
      name: 'text',
      type: 'text',
      element: document.createElement('textarea'),
      options: {}
    })

    widget.computedDisabled = true

    expect(widget.isVisible()).toBe(false)
  })
})

describe('addWidget on a node that refuses the widget', () => {
  function pinName(widget: IBaseWidget, name: string): void {
    Object.defineProperty(widget, 'name', {
      value: name,
      writable: false,
      configurable: false,
      enumerable: true
    })
  }

  function refusedDomWidget(node: LGraphNode) {
    const widget = new DOMWidgetImpl({
      node,
      name: 'seed',
      type: 'custom',
      element: document.createElement('div'),
      options: {}
    })
    pinName(widget, 'seed')
    return widget
  }

  test('does not register a widget the attached node refused', () => {
    const graph = new LGraph()
    const node = new LGraphNode('test-node')
    graph.add(node)
    node.addWidget('text', 'seed', '', () => {})
    const widget = refusedDomWidget(node)

    addWidget(node, widget)

    expect(node.widgets).not.toContain(widget)
    expect(useDomWidgetStore().widgetStates.has(widget.id)).toBe(false)
  })

  test('does not register a widget refused when the node joins a graph', () => {
    const node = new LGraphNode('test-node')
    node.addWidget('text', 'seed', '', () => {})
    const widget = refusedDomWidget(node)
    addWidget(node, widget)
    expect(node.widgets).toContain(widget)

    new LGraph().add(node)

    expect(node.widgets).not.toContain(widget)
    expect(useDomWidgetStore().widgetStates.has(widget.id)).toBe(false)
  })
})

describe('addWidget teardown', () => {
  function domWidget(node: LGraphNode) {
    const widget = new DOMWidgetImpl({
      node,
      name: 'preview',
      type: 'custom',
      element: document.createElement('div'),
      options: {}
    })
    addWidget(node, widget)
    return widget
  }

  test('removes a widget once when its node is removed', () => {
    const graph = new LGraph()
    const node = new LGraphNode('test-node')
    graph.add(node)
    const widget = domWidget(node)
    const onRemove = vi.spyOn(widget, 'onRemove')

    graph.remove(node)

    expect(onRemove).toHaveBeenCalledOnce()
  })

  test('does not remove a widget again when its node is removed after the widget', () => {
    const graph = new LGraph()
    const node = new LGraphNode('test-node')
    graph.add(node)
    const widget = domWidget(node)
    const onRemove = vi.spyOn(widget, 'onRemove')

    node.removeWidget(widget)
    graph.remove(node)

    expect(onRemove).toHaveBeenCalledOnce()
  })

  test('still removes a widget taken out of the widget list without removeWidget when its node is removed', () => {
    const graph = new LGraph()
    const node = new LGraphNode('test-node')
    graph.add(node)
    const widget = domWidget(node)
    const onRemove = vi.spyOn(widget, 'onRemove')

    node.widgets?.splice(node.widgets.indexOf(widget), 1)
    graph.remove(node)

    expect(onRemove).toHaveBeenCalledOnce()
    expect(useDomWidgetStore().widgetStates.has(widget.id)).toBe(false)
  })
})

describe('DOM widget value accessors with a non-function getValue/setValue', () => {
  function domWidgetWithStaleAccessors() {
    const widget = new DOMWidgetImpl({
      node: new LGraphNode('test-node'),
      name: 'text',
      type: 'custom',
      element: document.createElement('div'),
      options: {}
    })
    Reflect.set(widget.options, 'getValue', 'stale')
    Reflect.set(widget.options, 'setValue', 'stale')
    return widget
  }

  test('DOMWidgetImpl.value falls back to an empty string instead of throwing', () => {
    const widget = domWidgetWithStaleAccessors()

    expect(widget.value).toBe('')
  })

  test('DOMWidgetImpl.value setter still invokes the callback without throwing', () => {
    const widget = domWidgetWithStaleAccessors()
    const callback = vi.fn()
    widget.callback = callback

    widget.value = 'next'

    expect(callback).toHaveBeenCalledWith('')
  })

  test('addDOMWidget instance value accessors tolerate a non-function getValue/setValue', () => {
    const node = new LGraphNode('test-node')
    const widget = node.addDOMWidget(
      'text',
      'custom',
      document.createElement('div'),
      {}
    )
    Reflect.set(widget.options, 'getValue', 42)
    Reflect.set(widget.options, 'setValue', {})

    expect(widget.value).toBe('')
    expect(() => {
      widget.value = 'next'
    }).not.toThrow()
  })

  test('function getValue/setValue are still called with options as this', () => {
    const node = new LGraphNode('test-node')
    let stored = 'initial'
    const widget = node.addDOMWidget(
      'text',
      'custom',
      document.createElement('div'),
      {
        getValue() {
          expect(this).toBe(widget.options)
          return stored
        },
        setValue(v: string) {
          expect(this).toBe(widget.options)
          stored = v
        }
      }
    )

    expect(widget.value).toBe('initial')
    widget.value = 'next'
    expect(stored).toBe('next')
    expect(widget.value).toBe('next')
  })
})
