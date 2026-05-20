import { fromAny } from '@total-typescript/shoehorn'
import { describe, expect, it, vi } from 'vitest'

import type { LGraphNode } from '@/lib/litegraph/src/litegraph'
import type {
  IBaseWidget,
  IColorWidget
} from '@/lib/litegraph/src/types/widgets'
import type { ColorInputSpec } from '@/schemas/nodeDef/nodeDefSchemaV2'
import { useColorWidget } from '@/renderer/extensions/vueNodes/widgets/composables/useColorWidget'

function createMockNode() {
  const addWidget = vi.fn(
    (
      type: string,
      name: string,
      value: unknown,
      _callback: unknown,
      options: Record<string, unknown>
    ): IBaseWidget =>
      ({
        type,
        name,
        value,
        options,
        y: 0
      }) as unknown as IBaseWidget
  )
  const node = fromAny<LGraphNode, unknown>({ addWidget })
  return { node, addWidget }
}

describe('useColorWidget', () => {
  it('uses the top-level default produced by the V1 → V2 migration', () => {
    const { node, addWidget } = createMockNode()
    const inputSpec = fromAny<ColorInputSpec, unknown>({
      type: 'COLOR',
      name: 'color',
      default: '#00ff00'
    })

    const widget = useColorWidget()(node, inputSpec) as IColorWidget

    expect(addWidget).toHaveBeenCalledWith(
      'color',
      'color',
      '#00ff00',
      expect.any(Function),
      { serialize: true }
    )
    expect(widget.value).toBe('#00ff00')
  })

  it('uses options.default when the spec follows the V2 nested shape', () => {
    const { node, addWidget } = createMockNode()
    const inputSpec: ColorInputSpec = {
      type: 'COLOR',
      name: 'color',
      options: { default: '#abcdef' }
    }

    useColorWidget()(node, inputSpec)

    expect(addWidget.mock.calls[0]![2]).toBe('#abcdef')
  })

  it('prefers the top-level default when both locations are present', () => {
    const { node, addWidget } = createMockNode()
    const inputSpec = fromAny<ColorInputSpec, unknown>({
      type: 'COLOR',
      name: 'color',
      default: '#111111',
      options: { default: '#222222' }
    })

    useColorWidget()(node, inputSpec)

    expect(addWidget.mock.calls[0]![2]).toBe('#111111')
  })

  it('falls back to black when no default is provided', () => {
    const { node, addWidget } = createMockNode()
    const inputSpec: ColorInputSpec = {
      type: 'COLOR',
      name: 'color'
    }

    useColorWidget()(node, inputSpec)

    expect(addWidget.mock.calls[0]![2]).toBe('#000000')
  })
})
