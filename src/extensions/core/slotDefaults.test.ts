import { describe, expect, it, vi } from 'vitest'

import { slotDefaultsExtension } from '@/extensions/core/slotDefaults'
import { LGraphNode, LiteGraph } from '@/lib/litegraph/src/litegraph'
import { reportError } from '@/platform/telemetry/reportError'
import type { ComfyNodeDef, InputSpec } from '@/schemas/nodeDefSchema'
import type { ComfyApp } from '@/scripts/app'

vi.mock(import('@/scripts/app'))
vi.mock(import('@/platform/telemetry/reportError'))

function nodeDef(name: string, image: unknown): ComfyNodeDef {
  return {
    name,
    display_name: name,
    category: 'test',
    python_module: 'nodes',
    description: '',
    output: [],
    output_is_list: [],
    output_name: [],
    output_node: false,
    input: { required: { image: image as InputSpec } }
  }
}

async function register(def: ComfyNodeDef) {
  await slotDefaultsExtension.beforeRegisterNodeDef?.(
    LGraphNode,
    def,
    {} as ComfyApp
  )
}

describe('Comfy.SlotDefaults', () => {
  it('suggests the remaining node defs when one def cannot be read', async () => {
    await register(nodeDef('BrokenNode', null))
    await register(nodeDef('PreviewImage', ['IMAGE', {}]))

    expect(LiteGraph.slot_types_default_out.IMAGE).toEqual([
      'Reroute',
      'PreviewImage'
    ])
    expect(reportError).toHaveBeenCalledWith(
      expect.any(TypeError),
      expect.objectContaining({ errorType: 'error_registering_slot_defaults' })
    )
  })
})
