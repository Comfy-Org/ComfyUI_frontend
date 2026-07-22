import { describe, expect, it, vi } from 'vitest'

import { convertApiGraphToWorkflow } from '@/platform/workflow/utils/apiGraphConversionUtil'
import type { ComfyNodeDef } from '@/schemas/nodeDefSchema'

function createNodeDef(overrides: Partial<ComfyNodeDef>): ComfyNodeDef {
  return {
    name: 'TestNode',
    display_name: 'Test Node',
    description: '',
    category: 'test',
    output_node: false,
    python_module: 'nodes',
    ...overrides
  }
}

const nodeDefs: Record<string, ComfyNodeDef> = {
  LoadImage: createNodeDef({
    name: 'LoadImage',
    display_name: 'Load Image',
    input: { required: { image: [['a.png', 'b.png'], {}] } },
    input_order: { required: ['image'] },
    output: ['IMAGE', 'MASK'],
    output_name: ['IMAGE', 'MASK']
  }),
  SaveImage: createNodeDef({
    name: 'SaveImage',
    display_name: 'Save Image',
    output_node: true,
    input: {
      required: {
        images: ['IMAGE', {}],
        filename_prefix: ['STRING', { default: 'ComfyUI' }]
      }
    },
    input_order: { required: ['images', 'filename_prefix'] },
    output: []
  })
}

const apiGraph = {
  '1': { class_type: 'LoadImage', inputs: { image: 'a.png' } },
  '2': {
    class_type: 'SaveImage',
    inputs: { images: ['1', 0], filename_prefix: 'out' }
  }
}

describe('convertApiGraphToWorkflow', () => {
  it('synthesizes a schema-valid workflow wiring API-graph links', async () => {
    const workflow = await convertApiGraphToWorkflow(apiGraph, nodeDefs)

    expect(workflow).not.toBeNull()
    expect(workflow!.nodes).toHaveLength(2)
    expect(workflow!.nodes.map((n) => n.type).sort()).toEqual([
      'LoadImage',
      'SaveImage'
    ])
    expect(workflow!.links).toHaveLength(1)
    const [link] = workflow!.links!
    if (!Array.isArray(link)) throw new Error('expected a tuple link')
    const [, originId, originSlot, targetId] = link
    expect(originId).toBe(1)
    expect(originSlot).toBe(0)
    expect(targetId).toBe(2)
  })

  it('carries widget values into the synthesized nodes', async () => {
    const workflow = await convertApiGraphToWorkflow(apiGraph, nodeDefs)

    const saveNode = workflow!.nodes.find((n) => n.type === 'SaveImage')
    expect(saveNode?.widgets_values).toContain('out')
  })

  it('degrades gracefully for node types missing from the defs', async () => {
    const consoleSpy = vi.spyOn(console, 'warn').mockImplementation(() => {})
    const graphWithUnknown = {
      '1': { class_type: 'NotInstalledNode', inputs: { strength: 0.5 } }
    }

    const workflow = await convertApiGraphToWorkflow(graphWithUnknown, {})

    expect(workflow).not.toBeNull()
    expect(workflow!.nodes).toHaveLength(1)
    expect(workflow!.nodes[0].type).toBe('NotInstalledNode')
    expect(consoleSpy).toHaveBeenCalled()
    consoleSpy.mockRestore()
  })
})
