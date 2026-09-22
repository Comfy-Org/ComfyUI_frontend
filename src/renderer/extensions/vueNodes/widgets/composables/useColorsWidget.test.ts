import { describe, expect, it, vi } from 'vitest'

import { LGraphNode } from '@/lib/litegraph/src/litegraph'
import type { InputSpec } from '@/schemas/nodeDef/nodeDefSchemaV2'

import { useColorsWidget } from './useColorsWidget'

function mockNode() {
  const node = new LGraphNode('Test')
  const addWidget = vi.spyOn(node, 'addWidget')
  return { node, addWidget }
}

describe('useColorsWidget', () => {
  it('adds a colors widget seeded with the spec default', () => {
    const { node, addWidget } = mockNode()
    useColorsWidget()(node, {
      type: 'COLORS',
      name: 'palette',
      default: ['#fff']
    } as InputSpec)
    expect(addWidget).toHaveBeenCalledWith('colors', 'palette', ['#fff'], null)
  })

  it('defaults to an empty palette', () => {
    const { node, addWidget } = mockNode()
    useColorsWidget()(node, { type: 'COLORS', name: 'palette' } as InputSpec)
    expect(addWidget).toHaveBeenCalledWith('colors', 'palette', [], null)
  })

  it('copies the spec default so widgets never share its reference', () => {
    const { node, addWidget } = mockNode()
    const shared = ['#fff']
    useColorsWidget()(node, {
      type: 'COLORS',
      name: 'palette',
      default: shared
    } as InputSpec)
    expect(addWidget.mock.calls[0][2]).not.toBe(shared)
  })
})
