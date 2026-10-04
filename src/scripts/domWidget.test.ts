import { describe, expect, test, vi } from 'vitest'

import { LGraph, LGraphNode } from '@/lib/litegraph/src/litegraph'
import type { IBaseWidget } from '@/lib/litegraph/src/types/widgets'
import {
  addWidget,
  ComponentWidgetImpl,
  DOMWidgetImpl
} from '@/scripts/domWidget'
import { useDomWidgetStore } from '@/stores/domWidgetStore'

vi.mock(import('@/utils/formatUtil'), () => ({
  generateUUID: () => 'test-uuid'
}))

vi.mock(import('@/platform/telemetry/reportError'))

describe('DOMWidget Y Position Preservation', () => {
  test('ComponentWidgetImpl createCopyForNode preserves Y position and component wiring', () => {
    const mockNode = new LGraphNode('test-node')
    const component = { template: '<div></div>' }
    const inputSpec = { name: 'test', type: 'string' }
    const props = { placeholder: 'hint' }
    const originalWidget = new ComponentWidgetImpl({
      node: mockNode,
      name: 'test-widget',
      component,
      inputSpec,
      props,
      options: {}
    })

    // Set a specific Y position
    originalWidget.y = 66

    const newNode = new LGraphNode('new-node')
    const clonedWidget = originalWidget.createCopyForNode(newNode)

    // Verify Y position is preserved
    expect(clonedWidget.y).toBe(66)
    expect(clonedWidget.node).toBe(newNode)
    expect(clonedWidget.name).toBe('test-widget')
    expect(clonedWidget.component).toBe(component)
    expect(clonedWidget.inputSpec).toBe(inputSpec)
    expect(clonedWidget.props).toBe(props)
  })

  test('DOMWidgetImpl createCopyForNode preserves Y position', () => {
    const mockNode = new LGraphNode('test-node')
    const mockElement = document.createElement('div')

    const originalWidget = new DOMWidgetImpl({
      node: mockNode,
      name: 'test-dom-widget',
      type: 'test',
      element: mockElement,
      options: {}
    })

    // Set a specific Y position
    originalWidget.y = 42

    const newNode = new LGraphNode('new-node')
    const clonedWidget = originalWidget.createCopyForNode(newNode)

    // Verify Y position is preserved
    expect(clonedWidget.y).toBe(42)
    expect(clonedWidget.node).toBe(newNode)
    expect(clonedWidget.element).toBe(mockElement)
    expect(clonedWidget.name).toBe('test-dom-widget')
  })

  test('Y position defaults to 0 when not set', () => {
    const mockNode = new LGraphNode('test-node')
    const originalWidget = new ComponentWidgetImpl({
      node: mockNode,
      name: 'test-widget',
      component: { template: '<div></div>' },
      inputSpec: { name: 'test', type: 'string' },
      options: {}
    })

    // Don't explicitly set Y (should be 0 by default)
    const newNode = new LGraphNode('new-node')
    const clonedWidget = originalWidget.createCopyForNode(newNode)

    // Verify Y position is preserved (should be 0)
    expect(clonedWidget.y).toBe(0)
  })
})

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
  /**
   * How the state is reached in the wild: an extension redefines `name` on an
   * existing widget, so the duplicate cannot be renamed apart and is removed
   * from the node (ADR-ECS-0008).
   */
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
