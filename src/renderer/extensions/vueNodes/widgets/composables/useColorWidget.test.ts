import { describe, expect, it, vi } from 'vitest'

import { LGraphNode } from '@/lib/litegraph/src/litegraph'
import type { IBaseWidget } from '@/lib/litegraph/src/types/widgets'
import type { ColorInputSpec } from '@/schemas/nodeDef/nodeDefSchemaV2'
import { useColorWidget } from '@/renderer/extensions/vueNodes/widgets/composables/useColorWidget'

const TOP_LEVEL_DEFAULT = '#00ff00'
const NESTED_DEFAULT = '#abcdef'
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
  it('uses the top-level default produced by the V1 → V2 migration', () => {
    const { node, addWidget } = createMockNode()
    const inputSpec = createColorSpec({ default: TOP_LEVEL_DEFAULT })

    const widget = useColorWidget()(node, inputSpec)

    expect(addWidget).toHaveBeenCalledWith(
      'color',
      'color',
      TOP_LEVEL_DEFAULT,
      expect.any(Function),
      { serialize: true }
    )
    expect(widget.value).toBe(TOP_LEVEL_DEFAULT)
  })

  it('uses options.default when the spec follows the V2 nested shape', () => {
    const { node, addWidget } = createMockNode()
    const inputSpec = createColorSpec({ options: { default: NESTED_DEFAULT } })

    useColorWidget()(node, inputSpec)

    expect(addWidget.mock.calls[0]![2]).toBe(NESTED_DEFAULT)
  })

  it('prefers the top-level default when both locations are present', () => {
    const { node, addWidget } = createMockNode()
    const inputSpec = createColorSpec({
      default: TOP_LEVEL_DEFAULT,
      options: { default: NESTED_DEFAULT }
    })

    useColorWidget()(node, inputSpec)

    expect(addWidget.mock.calls[0]![2]).toBe(TOP_LEVEL_DEFAULT)
  })

  it('still produces a usable widget when no default is supplied', () => {
    const { node, addWidget } = createMockNode()
    const inputSpec = createColorSpec()

    const widget = useColorWidget()(node, inputSpec)

    expect(addWidget).toHaveBeenCalledOnce()
    expect(widget.type).toBe('color')
    expect(widget.name).toBe('color')
    expect(widget.value).toBe(BLACK_FALLBACK)
  })

  it('serializes the widget so its value persists in saved workflows', () => {
    const { node, addWidget } = createMockNode()

    useColorWidget()(node, createColorSpec({ default: TOP_LEVEL_DEFAULT }))

    expect(addWidget.mock.calls[0]![4]).toEqual({ serialize: true })
  })

  it('honours a custom input name from the spec', () => {
    const { node, addWidget } = createMockNode()

    useColorWidget()(
      node,
      createColorSpec({ name: 'bg_color', default: TOP_LEVEL_DEFAULT })
    )

    expect(addWidget.mock.calls[0]![1]).toBe('bg_color')
  })
})
