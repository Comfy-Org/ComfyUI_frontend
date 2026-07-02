import { describe, expect, it, vi } from 'vitest'

import { LGraphNode } from '@/lib/litegraph/src/litegraph'
import type { IBaseWidget } from '@/lib/litegraph/src/types/widgets'

interface TestWidgetOptions {
  name: string
  type: string
  default?: unknown
  multiline?: boolean
}

function createWidgetFactory() {
  return (node: LGraphNode, options: TestWidgetOptions): IBaseWidget => {
    const widget = {
      name: options.name,
      type: options.type,
      value: options.default,
      options
    } as IBaseWidget
    node.widgets = [...(node.widgets ?? []), widget]
    return widget
  }
}

vi.mock(
  '@/renderer/extensions/vueNodes/widgets/composables/useStringWidget',
  () => ({
    useStringWidget: () => createWidgetFactory()
  })
)

vi.mock(
  '@/renderer/extensions/vueNodes/widgets/composables/useFloatWidget',
  () => ({
    useFloatWidget: () => createWidgetFactory()
  })
)

vi.mock(
  '@/renderer/extensions/vueNodes/widgets/composables/useBooleanWidget',
  () => ({
    useBooleanWidget: () => createWidgetFactory()
  })
)

import './errorNodeWidgets'

describe('errorNodeWidgets', () => {
  it('restores widgets from serialized values on error nodes', () => {
    const node = new LGraphNode('BrokenNode')
    const longText = 'serialized value with more than twenty chars'
    node.has_errors = true

    node.onConfigure?.({
      widgets_values: {
        length: 5,
        0: 'short text',
        1: longText,
        2: 12,
        3: true,
        4: { nested: 'value' }
      }
    })

    expect(node.widgets).toHaveLength(5)
    expect(node.widgets?.map((widget) => widget.name)).toEqual([
      'UNKNOWN',
      'UNKNOWN_1',
      'UNKNOWN_2',
      'UNKNOWN_3',
      'UNKNOWN_4'
    ])
    expect(node.widgets?.map((widget) => widget.label)).toEqual([
      'UNKNOWN',
      'UNKNOWN',
      'UNKNOWN',
      'UNKNOWN',
      'UNKNOWN'
    ])
    expect(node.widgets?.map((widget) => widget.value)).toEqual([
      'short text',
      longText,
      12,
      true,
      '{"nested":"value"}'
    ])
    expect(node.serialize_widgets).toBe(true)
  })

  it('leaves normal nodes unchanged', () => {
    const node = new LGraphNode('HealthyNode')

    node.onConfigure?.({
      widgets_values: ['ignored']
    })

    expect(node.widgets).toBeUndefined()
    expect(node.serialize_widgets).toBeUndefined()
  })
})
