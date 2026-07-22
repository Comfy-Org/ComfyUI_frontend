import { describe, expect, it, vi } from 'vitest'

import { LGraphNode } from '@/lib/litegraph/src/litegraph'
import type { IBaseWidget } from '@/lib/litegraph/src/types/widgets'
import { useTextareaWidget } from '@/renderer/extensions/vueNodes/widgets/composables/useTextareaWidget'
import type { InputSpec } from '@/schemas/nodeDef/nodeDefSchemaV2'

function createMockNode(): {
  node: LGraphNode
  addWidget: ReturnType<typeof vi.spyOn>
} {
  const node = new LGraphNode('TestTextareaNode')
  const addWidget = vi
    .spyOn(node, 'addWidget')
    .mockImplementation((type, name, value, _callback, options) => {
      const widget = {
        type,
        name,
        value,
        options: typeof options === 'string' ? { property: options } : options,
        y: 0
      } as IBaseWidget
      node.widgets ??= []
      node.widgets.push(widget)
      return widget
    })
  return { node, addWidget }
}

function createTextareaSpec(
  overrides: Partial<{
    default: string
    rows: number
    cols: number
  }> = {}
): InputSpec {
  return { type: 'TEXTAREA', name: 'text', ...overrides } as InputSpec
}

describe('useTextareaWidget', () => {
  it('uses the declared default, rows, and cols from the input spec', () => {
    const { node, addWidget } = createMockNode()

    const widget = useTextareaWidget()(
      node,
      createTextareaSpec({ default: 'hello', rows: 10, cols: 80 })
    )

    expect(addWidget).toHaveBeenCalledWith(
      'textarea',
      'text',
      'hello',
      expect.any(Function),
      { serialize: true, rows: 10, cols: 80 }
    )
    expect(widget.value).toBe('hello')
  })

  it('falls back to an empty default with 5 rows and 50 cols', () => {
    const { node, addWidget } = createMockNode()

    const widget = useTextareaWidget()(node, createTextareaSpec())

    expect(addWidget).toHaveBeenCalledWith(
      'textarea',
      'text',
      '',
      expect.any(Function),
      { serialize: true, rows: 5, cols: 50 }
    )
    expect(widget.type).toBe('textarea')
  })

  it('throws when the input spec is not a textarea spec', () => {
    const { node } = createMockNode()
    const inputSpec = { type: 'STRING', name: 'text' } as unknown as InputSpec

    expect(() => useTextareaWidget()(node, inputSpec)).toThrow(
      'Invalid input spec for textarea widget'
    )
  })
})
