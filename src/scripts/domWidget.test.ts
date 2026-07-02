import { describe, expect, test, vi } from 'vitest'

import type { LGraph } from '@/lib/litegraph/src/litegraph'
import { LGraphNode } from '@/lib/litegraph/src/litegraph'
import {
  addWidget,
  ComponentWidgetImpl,
  DOMWidgetImpl,
  isComponentWidget,
  isDOMWidget
} from '@/scripts/domWidget'

const { registerWidget, unregisterWidget } = vi.hoisted(() => ({
  registerWidget: vi.fn(),
  unregisterWidget: vi.fn()
}))

vi.mock('@/stores/domWidgetStore', () => ({
  useDomWidgetStore: () => ({
    registerWidget,
    unregisterWidget
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

    originalWidget.y = 66

    const newNode = new LGraphNode('new-node')
    const clonedWidget = originalWidget.createCopyForNode(newNode)

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

    originalWidget.y = 42

    const newNode = new LGraphNode('new-node')
    const clonedWidget = originalWidget.createCopyForNode(newNode)

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

    const newNode = new LGraphNode('new-node')
    const clonedWidget = originalWidget.createCopyForNode(newNode)

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

describe('DOMWidgetImpl', () => {
  test('identifies DOM and component widgets', () => {
    const node = new LGraphNode('test-node')
    const domWidget = new DOMWidgetImpl({
      node,
      name: 'dom',
      type: 'text',
      element: document.createElement('textarea'),
      options: {}
    })
    const componentWidget = new ComponentWidgetImpl({
      node,
      name: 'component',
      component: { template: '<div />' },
      inputSpec: { name: 'component', type: 'STRING' },
      options: {}
    })

    expect(isDOMWidget(domWidget)).toBe(true)
    expect(isDOMWidget(componentWidget)).toBe(false)
    expect(isComponentWidget(componentWidget)).toBe(true)
    expect(isComponentWidget(domWidget)).toBe(false)
  })

  test('uses option-backed values, callbacks, and margins', () => {
    const node = new LGraphNode('test-node')
    let value = 'initial'
    const setValue = vi.fn((next: string) => {
      value = next
    })
    const callback = vi.fn()
    const widget = new DOMWidgetImpl({
      node,
      name: 'text',
      type: 'text',
      element: document.createElement('textarea'),
      options: {
        getValue: () => value,
        setValue,
        margin: 4
      }
    })
    widget.callback = callback

    widget.value = 'next'

    expect(widget.value).toBe('next')
    expect(widget.margin).toBe(4)
    expect(setValue).toHaveBeenCalledWith('next')
    expect(callback).toHaveBeenCalledWith('next')
  })

  test('uses default value and margin when options do not provide them', () => {
    const node = new LGraphNode('test-node')
    const widget = new DOMWidgetImpl({
      node,
      name: 'text',
      type: 'text',
      element: document.createElement('textarea'),
      options: {}
    })

    expect(widget.value).toBe('')
    expect(widget.margin).toBe(10)
  })

  test('draws zoom placeholders and delegates visible draws', () => {
    const node = new LGraphNode('test-node')
    vi.spyOn(node, 'isWidgetVisible').mockReturnValue(true)
    const onDraw = vi.fn()
    const widget = new DOMWidgetImpl({
      node,
      name: 'text',
      type: 'text',
      element: document.createElement('textarea'),
      options: {
        hideOnZoom: true,
        margin: 5,
        onDraw
      }
    })
    const ctx = {
      beginPath: vi.fn(),
      fill: vi.fn(),
      fillStyle: '#000',
      rect: vi.fn()
    } as unknown as CanvasRenderingContext2D

    widget.draw(ctx, node, 100, 10, 40, true)

    expect(ctx.rect).toHaveBeenCalledWith(5, 15, 90, 30)
    expect(ctx.fill).toHaveBeenCalledOnce()
    expect(ctx.fillStyle).toBe('#000')
    expect(onDraw).toHaveBeenCalledWith(widget)
  })

  test('skips placeholder drawing when hidden', () => {
    const node = new LGraphNode('test-node')
    vi.spyOn(node, 'isWidgetVisible').mockReturnValue(false)
    const onDraw = vi.fn()
    const widget = new DOMWidgetImpl({
      node,
      name: 'text',
      type: 'text',
      element: document.createElement('textarea'),
      options: {
        hideOnZoom: true,
        onDraw
      }
    })
    const ctx = {
      beginPath: vi.fn(),
      fill: vi.fn(),
      fillStyle: '#000',
      rect: vi.fn()
    } as unknown as CanvasRenderingContext2D

    widget.draw(ctx, node, 100, 10, 40, true)

    expect(ctx.rect).not.toHaveBeenCalled()
    expect(onDraw).toHaveBeenCalledWith(widget)
  })

  test('computes hidden, option, percent, and fallback layout sizes', () => {
    const node = new LGraphNode('test-node')
    node.size = [100, 200]
    const hiddenWidget = new DOMWidgetImpl({
      node,
      name: 'hidden',
      type: 'hidden',
      element: document.createElement('textarea'),
      options: {}
    })
    const optionWidget = new DOMWidgetImpl({
      node,
      name: 'option',
      type: 'text',
      element: document.createElement('textarea'),
      options: {
        getMinHeight: () => 11,
        getMaxHeight: () => 88,
        getHeight: () => 44
      }
    })
    const percentWidget = new DOMWidgetImpl({
      node,
      name: 'percent',
      type: 'text',
      element: document.createElement('textarea'),
      options: {
        getMinHeight: () => 10,
        getMaxHeight: () => 60,
        getHeight: () => '25%'
      }
    })
    const fallbackWidget = new DOMWidgetImpl({
      node,
      name: 'fallback',
      type: 'text',
      element: document.createElement('textarea'),
      options: {
        getHeight: () => 40
      }
    })

    expect(hiddenWidget.computeLayoutSize(node)).toEqual({
      minHeight: 0,
      maxHeight: 0,
      minWidth: 0
    })
    expect(optionWidget.computeLayoutSize(node)).toEqual({
      minHeight: 11,
      maxHeight: 88,
      minWidth: 0
    })
    expect(percentWidget.computeLayoutSize(node)).toEqual({
      minHeight: 10,
      maxHeight: 60,
      minWidth: 0
    })
    expect(fallbackWidget.computeLayoutSize(node)).toEqual({
      minHeight: 40,
      maxHeight: undefined,
      minWidth: 0
    })
  })

  test('registers widgets immediately and through node lifecycle callbacks', () => {
    registerWidget.mockClear()
    unregisterWidget.mockClear()
    const node = new LGraphNode('test-node')
    node.graph = {} as LGraph
    const beforeResize = vi.fn()
    const afterResize = vi.fn()
    const widget = new DOMWidgetImpl({
      node,
      name: 'text',
      type: 'text',
      element: document.createElement('textarea'),
      options: {
        beforeResize,
        afterResize
      }
    })
    vi.spyOn(node, 'addCustomWidget')

    addWidget(node, widget)
    node.onAdded?.(node.graph)
    node.onResize?.([0, 0])
    node.onRemoved?.()

    expect(node.addCustomWidget).toHaveBeenCalledWith(widget)
    expect(registerWidget).toHaveBeenCalledWith(widget)
    expect(registerWidget).toHaveBeenCalledTimes(2)
    expect(beforeResize).toHaveBeenCalledWith(node)
    expect(afterResize).toHaveBeenCalledWith(node)
    expect(unregisterWidget).toHaveBeenCalledWith(widget.id)
  })

  test('computes component layout and serializes raw values', () => {
    const node = new LGraphNode('test-node')
    const value = { nested: true }
    const widget = new ComponentWidgetImpl({
      node,
      name: 'component',
      component: { template: '<div />' },
      inputSpec: { name: 'component', type: 'STRING' },
      options: {
        getValue: () => value,
        getMinHeight: () => 12,
        getMaxHeight: () => 48
      }
    })

    expect(widget.computeLayoutSize()).toEqual({
      minHeight: 12,
      maxHeight: 48,
      minWidth: 0
    })
    expect(widget.serializeValue()).toEqual({ nested: true })
  })

  test('adds DOM widgets through LGraphNode prototype helper', () => {
    const node = new LGraphNode('test-node')
    const element = document.createElement('textarea')
    let value = 'initial'
    const setValue = vi.fn((next: string) => {
      value = next
    })
    vi.spyOn(node, 'addCustomWidget')

    const widget = node.addDOMWidget('text', 'textarea', element, {
      getValue: () => value,
      setValue
    })
    const callback = vi.fn()
    widget.callback = callback
    widget.value = 'next'

    expect(node.addCustomWidget).toHaveBeenCalledWith(widget)
    expect(widget.element).toBe(element)
    expect(widget.options.hideOnZoom).toBe(true)
    expect(widget.value).toBe('next')
    expect(setValue).toHaveBeenCalledWith('next')
    expect(callback).toHaveBeenCalledWith('next')
  })
})
