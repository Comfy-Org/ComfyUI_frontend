import { describe, expect, it, vi } from 'vitest'

import { LGraphNode } from '@/lib/litegraph/src/litegraph'
import type { IBaseWidget } from '@/lib/litegraph/src/types/widgets'
import { useColorWidget } from '@/renderer/extensions/vueNodes/widgets/composables/useColorWidget'
import type { ColorInputSpec } from '@/schemas/nodeDef/nodeDefSchemaV2'

const DECLARED_DEFAULT = '#00ff00'
const BLACK_FALLBACK = '#000000'

function createMockNode(): {
  node: LGraphNode
  addWidget: ReturnType<typeof vi.spyOn>
} {
  const node = new LGraphNode('TestColorNode')
  const addWidget = vi.spyOn(node, 'addWidget').mockImplementation(
    (type, name, value, _callback, options) =>
      ({
        type,
        name,
        value,
        options: typeof options === 'string' ? { property: options } : options,
        y: 0
      }) as IBaseWidget
  )
  return { node, addWidget }
}

function createColorSpec(
  overrides: Partial<ColorInputSpec> = {}
): ColorInputSpec {
  return { type: 'COLOR', name: 'color', ...overrides }
}

describe('useColorWidget', () => {
  it('uses the declared default from the input spec', () => {
    const { node, addWidget } = createMockNode()
    const inputSpec = createColorSpec({ default: DECLARED_DEFAULT })

    const widget = useColorWidget()(node, inputSpec)

    expect(addWidget).toHaveBeenCalledWith(
      'color',
      'color',
      DECLARED_DEFAULT,
      expect.any(Function),
      { serialize: true }
    )
    expect(widget.value).toBe(DECLARED_DEFAULT)
  })

  it('falls back to black when no default is supplied', () => {
    const { node, addWidget } = createMockNode()

    const widget = useColorWidget()(node, createColorSpec())

    expect(addWidget).toHaveBeenCalledOnce()
    expect(widget.type).toBe('color')
    expect(widget.name).toBe('color')
    expect(widget.value).toBe(BLACK_FALLBACK)
  })

  it('serializes the widget so its value persists in saved workflows', () => {
    const { node, addWidget } = createMockNode()

    useColorWidget()(node, createColorSpec({ default: DECLARED_DEFAULT }))

    expect(addWidget.mock.calls[0]![4]).toEqual({ serialize: true })
  })

  it('honours a custom input name from the spec', () => {
    const { node, addWidget } = createMockNode()

    useColorWidget()(
      node,
      createColorSpec({ name: 'bg_color', default: DECLARED_DEFAULT })
    )

    expect(addWidget.mock.calls[0]![1]).toBe('bg_color')
  })
})
