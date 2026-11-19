import { describe, expect, it } from 'vitest'

import { LGraphNode } from '@/lib/litegraph/src/litegraph'
import type { IBaseWidget } from '@comfyorg/graph-model/widgets'
import { toNodeId } from '@comfyorg/graph-model/nodeId'

import { searchWidgets, searchWidgetsAndNodes } from './widgetSearch'
import type { NodeWidgetsListList } from './widgetSections'

describe('searchWidgets', () => {
  function createWidget(
    name: string,
    type: string,
    value?: string,
    label?: string
  ): { widget: IBaseWidget } {
    return {
      widget: {
        name,
        options: {},
        type,
        value,
        label,
        y: 0
      }
    }
  }

  it('should return all widgets when query is empty', () => {
    const widgets = [
      createWidget('width', 'number', '100'),
      createWidget('height', 'number', '200')
    ]
    const result = searchWidgets(widgets, '')
    expect(result).toEqual(widgets)
  })

  it('should filter widgets by name, label, type, or value', () => {
    const widgets = [
      createWidget('width', 'number', '100', 'Size Control'),
      createWidget('height', 'slider', '200', 'Image Height'),
      createWidget('quality', 'text', 'high', 'Quality')
    ]

    expect(searchWidgets(widgets, 'width')).toHaveLength(1)
    expect(searchWidgets(widgets, 'slider')).toHaveLength(1)
    expect(searchWidgets(widgets, 'image')).toHaveLength(1)
  })

  it('should support fuzzy matching (e.g., "high" matches both "height" and value "high")', () => {
    const widgets = [
      createWidget('width', 'number', '100', 'Size Control'),
      createWidget('height', 'slider', '200', 'Image Height'),
      createWidget('quality', 'text', 'high', 'Quality')
    ]

    const results = searchWidgets(widgets, 'high')
    expect(results).toHaveLength(2)
    expect(results.some((r) => r.widget.name === 'height')).toBe(true)
    expect(results.some((r) => r.widget.name === 'quality')).toBe(true)
  })

  it('should handle multiple search words', () => {
    const widgets = [
      createWidget('width', 'number', '100', 'Image Width'),
      createWidget('height', 'number', '200', 'Image Height')
    ]
    const result = searchWidgets(widgets, 'image width')
    expect(result).toHaveLength(1)
    expect(result[0].widget.name).toBe('width')
  })

  it('should be case insensitive', () => {
    const widgets = [createWidget('Width', 'Number', '100', 'Image Width')]
    const result = searchWidgets(widgets, 'IMAGE width')
    expect(result).toHaveLength(1)
  })

  it('searches a legacy widget with no type by name', () => {
    const widget = createWidget('width', 'number')
    Reflect.deleteProperty(widget.widget, 'type')

    expect(searchWidgets([widget], 'width')).toEqual([widget])
  })
})

describe('searchWidgetsAndNodes', () => {
  function createWidget(name: string): IBaseWidget {
    return {
      name,
      options: {},
      type: 'number',
      y: 0
    }
  }

  function createNodeSection(
    id: number,
    title: string,
    widgetNames: string[]
  ): NodeWidgetsListList[number] {
    const node = new LGraphNode(title)
    node.id = toNodeId(id)
    const widgets = widgetNames.map((name) => ({
      node,
      widget: createWidget(name)
    }))

    return { node, widgets }
  }

  it('keeps all widgets for matching nodes and filters widgets for other nodes', () => {
    const matchingNode = createNodeSection(1, 'Image Size', ['width', 'height'])
    const matchingWidget = createNodeSection(2, 'Sampler', [
      'seed',
      'imageQuality'
    ])
    const hiddenNode = createNodeSection(3, 'Preview', ['scale'])

    const result = searchWidgetsAndNodes(
      [matchingNode, matchingWidget, hiddenNode],
      'image'
    )

    expect(result).toEqual([
      matchingNode,
      {
        ...matchingWidget,
        widgets: [matchingWidget.widgets[1]]
      }
    ])
  })
})
