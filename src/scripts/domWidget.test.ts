import { afterEach, beforeEach, describe, expect, test, vi } from 'vitest'

import { LGraph, LGraphNode } from '@/lib/litegraph/src/litegraph'
import type { Subgraph } from '@/lib/litegraph/src/litegraph'
import {
  createTestSubgraph,
  createTestSubgraphNode
} from '@/lib/litegraph/src/subgraph/__fixtures__/subgraphHelpers'
import type { IBaseWidget } from '@comfyorg/graph-model/widgets'
import {
  addWidget,
  DOMWidgetImpl,
  registerDomWidgets,
  unregisterDomWidgets
} from '@/scripts/domWidget'
import { useDomWidgetStore } from '@/stores/domWidgetStore'
import { generateUUID } from '@/utils/formatUtil'

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

describe('root graph DOM widget registration', () => {
  let widgetSequence = 0
  beforeEach(() => {
    vi.mocked(generateUUID).mockImplementation(
      () => `widget-${++widgetSequence}`
    )
  })
  afterEach(() => {
    vi.mocked(generateUUID).mockImplementation(() => 'test-uuid')
  })

  function domWidgetOn(graph: LGraph | Subgraph) {
    const node = new LGraphNode('test-node')
    graph.add(node)
    return node.addDOMWidget('text', 'custom', document.createElement('div'))
  }

  function registeredIds() {
    return [...useDomWidgetStore().widgetStates.keys()].sort()
  }

  test('swaps the widgets of a whole graph tree when the root graph changes', () => {
    const shown = new LGraph()
    const shownWidget = domWidgetOn(shown)
    const subgraph = createTestSubgraph({ rootGraph: shown })
    shown.add(createTestSubgraphNode(subgraph))
    const nestedWidget = domWidgetOn(subgraph)
    const hidden = new LGraph()
    const hiddenWidget = domWidgetOn(hidden)
    const shownIds = [shownWidget.id, nestedWidget.id].sort()

    unregisterDomWidgets(shown)
    expect(registeredIds()).toEqual([hiddenWidget.id])

    unregisterDomWidgets(hidden)
    registerDomWidgets(shown)
    expect(registeredIds()).toEqual(shownIds)
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
