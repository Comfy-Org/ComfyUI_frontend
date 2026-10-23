import { describe, expect, it } from 'vitest'

import {
  LGraph,
  LGraphEventMode,
  LGraphNode
} from '@/lib/litegraph/src/litegraph'
import { app } from '@/scripts/app'
import { graphToPrompt } from '@/utils/executionUtil'

import { customWidgetsExtension } from './customWidgets'

describe('PrimitiveFloat widget type bridging', () => {
  function createMockNodeAndWidget() {
    const properties: Record<string, unknown> = {}
    const options: Record<string, unknown> = {
      min: -Infinity,
      max: Infinity
    }
    const widget = { type: 'number', options, value: 0, callback: undefined }
    return { properties, widget }
  }

  function applyFloatPropertyBridges(
    properties: Record<string, unknown>,
    widget: { type: string; options: Record<string, unknown> }
  ) {
    const DISPLAY_WIDGET_TYPES = new Set(['gradientslider', 'slider', 'knob'])

    let baseType = widget.type
    Object.defineProperty(widget, 'type', {
      get: () => {
        const display = properties.display as string | undefined
        if (display && DISPLAY_WIDGET_TYPES.has(display)) return display
        return baseType
      },
      set: (v: string) => {
        baseType = v
      }
    })

    Object.defineProperty(widget.options, 'gradient_stops', {
      enumerable: true,
      get: () => properties.gradient_stops,
      set: (v) => {
        properties.gradient_stops = v
      }
    })
  }

  it('returns base type when display property is not set', () => {
    const { properties, widget } = createMockNodeAndWidget()
    applyFloatPropertyBridges(properties, widget)

    expect(widget.type).toBe('number')
  })

  it('returns gradientslider when display property is set', () => {
    const { properties, widget } = createMockNodeAndWidget()
    applyFloatPropertyBridges(properties, widget)

    properties.display = 'gradientslider'
    expect(widget.type).toBe('gradientslider')
  })

  it('returns slider when display property is slider', () => {
    const { properties, widget } = createMockNodeAndWidget()
    applyFloatPropertyBridges(properties, widget)

    properties.display = 'slider'
    expect(widget.type).toBe('slider')
  })

  it('returns base type for unknown display values', () => {
    const { properties, widget } = createMockNodeAndWidget()
    applyFloatPropertyBridges(properties, widget)

    properties.display = 'unknown'
    expect(widget.type).toBe('number')
  })

  it('bridges gradient_stops from properties to options', () => {
    const { properties, widget } = createMockNodeAndWidget()
    applyFloatPropertyBridges(properties, widget)

    expect(widget.options.gradient_stops).toBeUndefined()

    const stops = [
      { offset: 0, color: [255, 0, 0] },
      { offset: 1, color: [0, 0, 255] }
    ]
    properties.gradient_stops = stops
    expect(widget.options.gradient_stops).toBe(stops)
  })

  it('gradient_stops survives object spread', () => {
    const { properties, widget } = createMockNodeAndWidget()
    applyFloatPropertyBridges(properties, widget)

    const stops = [
      { offset: 0, color: [0, 255, 255] },
      { offset: 1, color: [255, 0, 0] }
    ]
    properties.gradient_stops = stops

    const spread = { ...widget.options }
    expect(spread.gradient_stops).toBe(stops)
  })

  it('writes gradient_stops back to properties', () => {
    const { properties, widget } = createMockNodeAndWidget()
    applyFloatPropertyBridges(properties, widget)

    const stops = [
      { offset: 0, color: [0, 0, 0] },
      { offset: 1, color: [255, 255, 255] }
    ]
    widget.options.gradient_stops = stops
    expect(properties.gradient_stops).toBe(stops)
  })

  it('allows type to be set and overridden', () => {
    const { properties, widget } = createMockNodeAndWidget()
    applyFloatPropertyBridges(properties, widget)

    widget.type = 'slider'
    expect(widget.type).toBe('slider')

    properties.display = 'gradientslider'
    expect(widget.type).toBe('gradientslider')
  })
})

describe('Branch node', () => {
  it('serializes branch_names aligned with the autogrow inputs that reach the prompt', async () => {
    const widgets = await customWidgetsExtension.getCustomWidgets?.(app)
    const graph = new LGraph()
    const branch = new LGraphNode('BranchNode')
    branch.comfyClass = 'BranchNode'
    graph.add(branch)
    for (const name of ['branch0', 'branch1', 'branch2'])
      branch.addInput(`autogrow.${name}`, 'IMAGE')
    widgets?.COMFY_BRANCH_INPUT_NAMES(
      branch,
      'branch_names',
      ['COMFY_BRANCH_INPUT_NAMES', {}],
      app
    )

    for (const slot of [0, 1, 2]) {
      const source = new LGraphNode('Source')
      source.comfyClass = 'Source'
      source.addOutput('IMAGE', 'IMAGE')
      graph.add(source)
      source.connect(0, branch, slot)
      if (slot === 0) source.mode = LGraphEventMode.NEVER
    }

    const { output } = await graphToPrompt(graph)
    const { inputs } = output[String(branch.id)]

    expect(inputs.branch_names).toEqual({
      __value__: ['autogrow.branch1', 'autogrow.branch2']
    })
    expect(
      Object.keys(inputs).filter((k) => k.startsWith('autogrow.'))
    ).toEqual(['autogrow.branch1', 'autogrow.branch2'])
  })
})
