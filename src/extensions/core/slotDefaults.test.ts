import { respondToFetch } from '@comfyorg/test-utils/fetch'
import { describe, expect, it, vi } from 'vitest'

import { slotDefaultsExtension } from '@/extensions/core/slotDefaults'
import { LGraphNode, LiteGraph } from '@/lib/litegraph/src/litegraph'
import { reportError } from '@/platform/telemetry/reportError'
import { app } from '@/scripts/app'

vi.mock(import('@/platform/telemetry/reportError'))

function objectInfoEntry(name: string, image: unknown): unknown {
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
    input: { required: { image } }
  }
}

describe('Comfy.SlotDefaults', () => {
  it('suggests the remaining node defs when one def cannot be read', async () => {
    respondToFetch(/\/object_info$/, () =>
      Response.json({
        BrokenNode: objectInfoEntry('BrokenNode', null),
        PreviewImage: objectInfoEntry('PreviewImage', ['IMAGE', {}])
      })
    )
    const defs = await app.getNodeDefs()

    await slotDefaultsExtension.beforeRegisterNodeDef?.(
      LGraphNode,
      defs.BrokenNode,
      app
    )
    await slotDefaultsExtension.beforeRegisterNodeDef?.(
      LGraphNode,
      defs.PreviewImage,
      app
    )

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
