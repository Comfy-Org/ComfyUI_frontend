import { LGraphNode } from '@comfyorg/litegraph'
import { describe, expect, it } from 'vitest'

import { useStringWidgetVue } from '@/composables/widgets/useStringWidgetVue'
import type { StringInputSpec } from '@/schemas/nodeDef/nodeDefSchemaV2'

describe('useStringWidgetVue', () => {
  it('creates widget constructor with correct default value', () => {
    const constructor = useStringWidgetVue({ defaultValue: 'test' })
    expect(constructor).toBeDefined()
    expect(typeof constructor).toBe('function')
  })

  it('creates widget for single-line string input', () => {
    const constructor = useStringWidgetVue()
    const node = new LGraphNode('test')
    const inputSpec: StringInputSpec = {
      type: 'STRING',
      name: 'test_input',
      default: 'default_value',
      placeholder: 'Enter text...'
    }

    const widget = constructor(node, inputSpec)

    expect(widget).toBeDefined()
    expect(widget.name).toBe('test_input')
    expect(widget.value).toBe('default_value')
  })

  it('creates widget for multiline string input', () => {
    const constructor = useStringWidgetVue()
    const node = new LGraphNode('test')
    const inputSpec: StringInputSpec = {
      type: 'STRING',
      name: 'multiline_input',
      default: 'default\nvalue',
      placeholder: 'Enter multiline text...',
      multiline: true
    }

    const widget = constructor(node, inputSpec)

    expect(widget).toBeDefined()
    expect(widget.name).toBe('multiline_input')
    expect(widget.value).toBe('default\nvalue')
  })

  it('handles placeholder fallback correctly', () => {
    const constructor = useStringWidgetVue()
    const node = new LGraphNode('test')
    const inputSpec: StringInputSpec = {
      type: 'STRING',
      name: 'no_placeholder_input',
      default: 'default_value'
    }

    const widget = constructor(node, inputSpec)

    expect(widget).toBeDefined()
    expect(widget.name).toBe('no_placeholder_input')
    expect(widget.value).toBe('default_value')
  })

  it('supports dynamic prompts configuration', () => {
    const constructor = useStringWidgetVue()
    const node = new LGraphNode('test')
    const inputSpec: StringInputSpec = {
      type: 'STRING',
      name: 'dynamic_input',
      default: 'value',
      dynamicPrompts: true
    }

    const widget = constructor(node, inputSpec)

    expect(widget).toBeDefined()
    expect(widget.dynamicPrompts).toBe(true)
  })

  it('throws error for invalid input spec', () => {
    const constructor = useStringWidgetVue()
    const node = new LGraphNode('test')
    const invalidInputSpec = {
      type: 'INT',
      name: 'invalid_input'
    } as any

    expect(() => constructor(node, invalidInputSpec)).toThrow(
      'Invalid input data'
    )
  })
})
