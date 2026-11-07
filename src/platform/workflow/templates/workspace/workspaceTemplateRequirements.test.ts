import type { ComfyWorkflowJSON } from '@comfyorg/graph-model/workflowSchema'
import { fromPartial } from '@total-typescript/shoehorn'
import { describe, expect, it } from 'vitest'

import { deriveWorkspaceTemplateRequirements } from './workspaceTemplateRequirements'

const NODE_DEFS: Record<string, { api_node: boolean; python_module: string }> =
  {
    CheckpointLoaderSimple: { api_node: false, python_module: 'nodes' },
    'Image Comparer (rgthree)': {
      api_node: false,
      python_module: 'custom_nodes.rgthree-comfy'
    },
    FluxProUltraImageNode: {
      api_node: true,
      python_module: 'comfy_api_nodes.nodes_bfl'
    }
  }

function workflowWith(
  nodes: Partial<ComfyWorkflowJSON['nodes'][number]>[],
  extra: ComfyWorkflowJSON['extra'] = {}
): ComfyWorkflowJSON {
  return fromPartial<ComfyWorkflowJSON>({
    version: 0.4,
    last_node_id: nodes.length,
    last_link_id: 0,
    links: [],
    extra,
    nodes: nodes.map((node, index) => ({
      id: index + 1,
      mode: 0,
      properties: {},
      ...node
    }))
  })
}

describe('deriveWorkspaceTemplateRequirements', () => {
  it('lists the models the workflow has selected, custom node packages and partner nodes', () => {
    const workflow = workflowWith([
      {
        type: 'CheckpointLoaderSimple',
        widgets_values: ['sd_xl_base_1.0.safetensors'],
        properties: {
          models: [
            {
              name: 'sd_xl_base_1.0.safetensors',
              url: 'https://example.com/sd_xl_base_1.0.safetensors',
              directory: 'checkpoints'
            }
          ]
        }
      },
      { type: 'Image Comparer (rgthree)' },
      { type: 'FluxProUltraImageNode' }
    ])

    const requirements = deriveWorkspaceTemplateRequirements(
      workflow,
      (nodeType) => NODE_DEFS[nodeType]
    )

    expect(requirements).toEqual({
      models: [
        { name: 'sd_xl_base_1.0.safetensors', directory: 'checkpoints' }
      ],
      custom_nodes: [
        { package: 'rgthree-comfy', node_types: ['Image Comparer (rgthree)'] }
      ],
      uses_partner_nodes: true,
      is_app: false
    })
  })

  it.for([
    { linearMode: true, isApp: true },
    { linearMode: false, isApp: false }
  ])(
    'marks an app-mode workflow as an app (linearMode: $linearMode)',
    ({ linearMode, isApp }) => {
      const requirements = deriveWorkspaceTemplateRequirements(
        workflowWith([], { linearMode }),
        () => undefined
      )

      expect(requirements.is_app).toBe(isApp)
    }
  )
})
