import { describe, expect, it, vi } from 'vitest'

import type { LGraphNode } from '@/lib/litegraph/src/litegraph'
import type {
  IColorWidget,
  IWidgetOptions
} from '@/lib/litegraph/src/types/widgets'
import type { InputSpec } from '@/schemas/nodeDef/nodeDefSchemaV2'
import { useColorWidget } from '@/renderer/extensions/vueNodes/widgets/composables/useColorWidget'

function createMockNode(): LGraphNode {
  const widgets: IColorWidget[] = []
  const addWidget = vi.fn(
    (
      type: string,
      name: string,
      value: string,
      _callback: () => void,
      options: IWidgetOptions
    ) => {
      const widget = {
        type,
        name,
        value,
        options,
        callback: _callback
      } as unknown as IColorWidget
      widgets.push(widget)
      return widget
    }
  )

  return { widgets, addWidget } as unknown as LGraphNode
}

const colorSpec: InputSpec = {
  type: 'COLOR',
  name: 'color',
  default: '#ffffff',
  socketless: true
}

describe('useColorWidget', () => {
  it('reads the top-level default from the V2 spec', () => {
    const node = createMockNode()
    const widget = useColorWidget()(node, colorSpec)
    expect(widget.value).toBe('#ffffff')
  })

  it('falls back to nested options.default when top-level default is absent', () => {
    const node = createMockNode()
    const widget = useColorWidget()(node, {
      type: 'COLOR',
      name: 'color',
      options: { default: '#abcdef' }
    } as InputSpec)
    expect(widget.value).toBe('#abcdef')
  })

  it('falls back to #000000 when no default is declared', () => {
    const node = createMockNode()
    const widget = useColorWidget()(node, {
      type: 'COLOR',
      name: 'color'
    } as InputSpec)
    expect(widget.value).toBe('#000000')
  })

  it('returns the existing widget instead of creating a duplicate', () => {
    const node = createMockNode()
    const first = useColorWidget()(node, colorSpec)
    const second = useColorWidget()(node, colorSpec)
    expect(second).toBe(first)
    expect(node.widgets).toHaveLength(1)
  })
})
