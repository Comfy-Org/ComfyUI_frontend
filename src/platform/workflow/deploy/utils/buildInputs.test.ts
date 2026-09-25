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
            properties: { cnr_id: 'comfyui-easy-use', ver: '1.2.3' },
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
      nodePacks: [
        { id: 'comfyui-easy-use', version: '1.2.3' },
        { id: 'ltdrdata/ComfyUI-Impact-Pack' }
      ],
      models: ['detail.safetensors', 'sd_xl_base_1.0.safetensors']
    })
  })

  it('lists the models a node records in its properties alongside widget values', () => {
    const inputs = deriveBuildInputs(
      {
        nodes: [
          {
            id: 1,
            type: 'CheckpointLoaderSimple',
            properties: {
              models: [
                {
                  name: 'sd_xl_base_1.0.safetensors',
                  url: 'https://example.com/sd_xl_base_1.0.safetensors',
                  directory: 'checkpoints'
                }
              ]
            },
            widgets_values: ['sd_xl_base_1.0.safetensors']
          },
          {
            id: 2,
            type: 'ImageAsset',
            properties: {
              models: [
                {
                  name: 'face.pth',
                  url: 'https://example.com/face.pth',
                  directory: 'facerestore'
                }
              ]
            },
            widgets_values: ['asset_01HZX']
          }
        ]
      },
      workflow
    )

    expect(inputs.models).toEqual(['face.pth', 'sd_xl_base_1.0.safetensors'])
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
    expect(inputs.nodePacks).toEqual([])
    expect(inputs.models).toEqual(['RealESRGAN_x4.pth'])
  })

  it('reads a subgraph the graph reuses at several levels once', () => {
    const inner = {
      id: 'inner',
      name: 'Inner',
      nodes: [
        { id: 1, type: 'KSampler', properties: { cnr_id: 'comfy-core' } }
      ],
      inputNode: null,
      outputNode: null
    }
    const outer = {
      id: 'outer',
      name: 'Outer',
      nodes: [
        { id: 1, type: 'inner' },
        { id: 2, type: 'inner' }
      ],
      definitions: { subgraphs: [inner] },
      inputNode: null,
      outputNode: null
    }

    const inputs = deriveBuildInputs(
      {
        nodes: [
          { id: 1, type: 'outer' },
          { id: 2, type: 'outer' },
          { id: 3, type: 'inner' }
        ],
        definitions: { subgraphs: [outer, inner] }
      },
      workflow
    )

    expect(inputs.nodeClasses).toEqual(['KSampler'])
    expect(inputs.nodePacks).toEqual([])
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
