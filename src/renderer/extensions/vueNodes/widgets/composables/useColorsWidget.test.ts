import { describe, expect, it, vi } from 'vitest'

import type { LGraphNode } from '@/lib/litegraph/src/litegraph'
import type { InputSpec } from '@/schemas/nodeDef/nodeDefSchemaV2'

import { useColorsWidget } from './useColorsWidget'

const widgetOptions = { serialize: true, canvasOnly: false }

function mockNode() {
  return { addWidget: vi.fn(() => ({})) } as unknown as LGraphNode & {
    addWidget: ReturnType<typeof vi.fn>
  }
}

describe('useColorsWidget', () => {
  it('adds a colors widget seeded with the spec default', () => {
    const node = mockNode()
    useColorsWidget()(node, {
      type: 'COLORS',
      name: 'palette',
      default: ['#fff']
    } as InputSpec)
    expect(node.addWidget).toHaveBeenCalledWith(
      'colors',
      'palette',
      ['#fff'],
      null,
      widgetOptions
    )
  })

  it('defaults to an empty palette', () => {
    const node = mockNode()
    useColorsWidget()(node, { type: 'COLORS', name: 'palette' } as InputSpec)
    expect(node.addWidget).toHaveBeenCalledWith(
      'colors',
      'palette',
      [],
      null,
      widgetOptions
    )
  })

  it('copies the spec default so widgets never share its reference', () => {
    const node = mockNode()
    const shared = ['#fff']
    useColorsWidget()(node, {
      type: 'COLORS',
      name: 'palette',
      default: shared
    } as InputSpec)
    expect(node.addWidget.mock.calls[0][2]).not.toBe(shared)
  })
})
