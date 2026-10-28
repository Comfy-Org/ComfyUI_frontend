import { respondToFetch } from '@comfyorg/test-utils/fetch'
import { afterEach, describe, expect, it, vi } from 'vitest'

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
  afterEach(() => {
    LiteGraph.flushSlotTypeTables()
    LiteGraph.registered_slot_in_types = {}
    LiteGraph.registered_slot_out_types = {}
    LiteGraph.slot_types_in = []
    LiteGraph.slot_types_out = []
    LiteGraph.slot_types_default_in = {}
    LiteGraph.slot_types_default_out = {}
    slotDefaultsExtension.slot_types_default_in = {}
    slotDefaultsExtension.slot_types_default_out = {}
  })

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

  it('keeps a table an extension replaces after node defs were queued', async () => {
    respondToFetch(/\/object_info$/, () =>
      Response.json({
        PreviewImage: objectInfoEntry('PreviewImage', ['IMAGE', {}])
      })
    )
    const defs = await app.getNodeDefs()
    await slotDefaultsExtension.beforeRegisterNodeDef?.(
      LGraphNode,
      defs.PreviewImage,
      app
    )

    LiteGraph.slot_types_default_out = { IMAGE: ['MyNode'] }

    expect(LiteGraph.slot_types_default_out).toEqual({ IMAGE: ['MyNode'] })
  })

  it('lists a node constructed before the deferred fill only once', async () => {
    respondToFetch(/\/object_info$/, () =>
      Response.json({
        TestNode: objectInfoEntry('TestNode', ['image', {}])
      })
    )
    const defs = await app.getNodeDefs()
    await slotDefaultsExtension.beforeRegisterNodeDef?.(
      LGraphNode,
      defs.TestNode,
      app
    )

    class TestNode extends LGraphNode {
      constructor(title: string) {
        super(title)
        this.addInput('image', 'image')
      }
    }
    LiteGraph.registerNodeType('TestNode', TestNode)
    LiteGraph.createNode('TestNode')

    expect(LiteGraph.registered_slot_in_types.image.nodes).toEqual(['TestNode'])
  })

  it('reports a def whose output is not an array without failing the hook', async () => {
    respondToFetch(/\/object_info$/, () =>
      Response.json({
        BadOutput: {
          ...(objectInfoEntry('BadOutput', null) as object),
          output: 7
        }
      })
    )
    const defs = await app.getNodeDefs()

    expect(() =>
      slotDefaultsExtension.beforeRegisterNodeDef?.(
        LGraphNode,
        defs.BadOutput,
        app
      )
    ).not.toThrow()
  })
})
