import { describe, expect, it } from 'vitest'

import { deriveBuildInputs } from '@/platform/workflow/deploy/utils/buildInputs'

const workflow = { name: 'portrait', fileName: 'portrait.json' }

describe('deriveBuildInputs', () => {
  it('reads classes, packs and models off the workflow, deduped and sorted', () => {
    const inputs = deriveBuildInputs(
      {
        nodes: [
          {
            id: 1,
            type: 'CheckpointLoaderSimple',
            widgets_values: ['sd_xl_base_1.0.safetensors']
          },
          {
            id: 2,
            type: 'LoraLoader',
            properties: { cnr_id: 'comfyui-easy-use' },
            widgets_values: { lora_name: 'detail.safetensors', strength: 0.8 }
          },
          {
            id: 3,
            type: 'LoraLoader',
            properties: { aux_id: 'ltdrdata/ComfyUI-Impact-Pack' },
            widgets_values: ['detail.safetensors']
          }
        ]
      },
      workflow
    )

    expect(inputs).toEqual({
      workflowName: 'portrait',
      workflowFileName: 'portrait.json',
      nodeClasses: ['CheckpointLoaderSimple', 'LoraLoader'],
      nodePacks: ['comfyui-easy-use', 'ltdrdata/ComfyUI-Impact-Pack'],
      models: ['detail.safetensors', 'sd_xl_base_1.0.safetensors']
    })
  })

  it('reaches into subgraphs and leaves their container ids out', () => {
    const inputs = deriveBuildInputs(
      {
        nodes: [{ id: 1, type: 'sg-1' }],
        definitions: {
          subgraphs: [
            {
              id: 'sg-1',
              name: 'Upscale',
              nodes: [
                {
                  id: 2,
                  type: 'UpscaleModelLoader',
                  properties: { cnr_id: 'comfy-core' },
                  widgets_values: ['RealESRGAN_x4.pth']
                }
              ],
              inputNode: null,
              outputNode: null
            }
          ]
        }
      },
      workflow
    )

    expect(inputs.nodeClasses).toEqual(['UpscaleModelLoader'])
    expect(inputs.nodePacks).toEqual(['comfy-core'])
    expect(inputs.models).toEqual(['RealESRGAN_x4.pth'])
  })

  it('ignores widget values that are not model filenames', () => {
    const inputs = deriveBuildInputs(
      {
        nodes: [
          {
            id: 1,
            type: 'CLIPTextEncode',
            widgets_values: ['a photo of a cat.jpg', 'euler', '']
          }
        ]
      },
      workflow
    )

    expect(inputs.models).toEqual([])
    expect(inputs.nodePacks).toEqual([])
  })
})
