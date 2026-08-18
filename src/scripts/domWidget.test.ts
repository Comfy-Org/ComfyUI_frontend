import { describe, expect, test, vi } from 'vitest'

import { LGraphNode } from '@/lib/litegraph/src/litegraph'
import { ComponentWidgetImpl, DOMWidgetImpl } from '@/scripts/domWidget'

vi.mock('@/stores/domWidgetStore', () => ({
  useDomWidgetStore: () => ({
    unregisterWidget: vi.fn()
  })
}))

vi.mock('@/utils/formatUtil', () => ({
  generateUUID: () => 'test-uuid'
}))

describe('DOMWidget Y Position Preservation', () => {
  test('BaseDOMWidgetImpl createCopyForNode preserves Y position', () => {
    const mockNode = new LGraphNode('test-node')
    const originalWidget = new ComponentWidgetImpl({
      node: mockNode,
      name: 'test-widget',
      component: { template: '<div></div>' },
      inputSpec: { name: 'test', type: 'string' },
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
