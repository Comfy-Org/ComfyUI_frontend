import { describe, expect, it, vi } from 'vitest'

import { createDefaultLight } from '@/extensions/core/lightInfo/types'
import type { LGraphNode } from '@/lib/litegraph/src/litegraph'
import type { InputSpec } from '@/schemas/nodeDef/nodeDefSchemaV2'

import { useLightInfoWidget } from './useLightInfoWidget'

const widgetOptions = { serialize: true, hideInPanel: true }

function mockNode() {
  return { addWidget: vi.fn(() => ({})) } as unknown as LGraphNode & {
    addWidget: ReturnType<typeof vi.fn>
  }
}

describe('useLightInfoWidget', () => {
  it('adds a lightInfo widget seeded with the normalized spec default', () => {
    const node = mockNode()
    const lights = [createDefaultLight('spot')]
    useLightInfoWidget()(node, {
      type: 'LIGHT_INFO_PREVIEW',
      name: 'editor_state',
      default: lights
    } as InputSpec)
    expect(node.addWidget).toHaveBeenCalledWith(
      'lightinfo',
      'editor_state',
      lights,
      null,
      widgetOptions
    )
    expect(node.addWidget.mock.calls[0][2]).not.toBe(lights)
  })

  it('defaults to an empty light list and drops invalid entries', () => {
    const node = mockNode()
    useLightInfoWidget()(node, {
      type: 'LIGHT_INFO_PREVIEW',
      name: 'editor_state',
      default: [{ type: 'laser' }, 'junk']
    } as InputSpec)
    expect(node.addWidget).toHaveBeenCalledWith(
      'lightinfo',
      'editor_state',
      [],
      null,
      widgetOptions
    )
  })
})
