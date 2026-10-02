import { describe, expect, it } from 'vitest'

import { deriveBuildInputs } from '@/platform/workflow/deploy/utils/buildInputs'

const workflow = { name: 'portrait', fileName: 'portrait.json' }

const LOADERS: Record<string, readonly string[]> = {
  CheckpointLoaderSimple: ['ckpt_name'],
  LoraLoader: ['lora_name'],
  UpscaleModelLoader: ['model_name'],
  INPAINT_LoadFooocusInpaint: ['head', 'patch']
}
function loaderInput(nodeType: string): readonly string[] {
  return LOADERS[nodeType] ?? []
}

function subgraph(id: string, type: string) {
  return {
    id,
    name: id,
    nodes: [{ id: 9, type }],
    inputNode: null,
    outputNode: null
  }
}

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
      workflow,
      loaderInput
    )

    expect(inputs).toEqual({
      workflowName: 'portrait',
      workflowFileName: 'portrait.json',
      nodeClasses: ['CheckpointLoaderSimple', 'LoraLoader'],
      nodePacks: [
        { id: 'comfyui-easy-use', versions: ['1.2.3'] },
        { id: 'ltdrdata/ComfyUI-Impact-Pack', versions: [] }
      ],
      models: ['detail.safetensors', 'sd_xl_base_1.0.safetensors']
    })
  })

  it.for([
    {
      order: 'as recorded',
      nodes: [
        {
          id: 1,
          type: 'A',
          properties: { cnr_id: 'comfyui-kjnodes', ver: '1.1.4' }
        },
        {
          id: 2,
          type: 'B',
          properties: { cnr_id: 'comfyui-kjnodes', ver: '1.0.9' }
        },
        { id: 3, type: 'C', properties: { cnr_id: 'comfyui-kjnodes' } }
      ]
    },
    {
      order: 'reversed',
      nodes: [
        { id: 3, type: 'C', properties: { cnr_id: 'comfyui-kjnodes' } },
        {
          id: 2,
          type: 'B',
          properties: { cnr_id: 'comfyui-kjnodes', ver: '1.0.9' }
        },
        {
          id: 1,
          type: 'A',
          properties: { cnr_id: 'comfyui-kjnodes', ver: '1.1.4' }
        }
      ]
    }
  ])(
    'keeps every version the nodes record for one pack, $order',
    ({ nodes }) => {
      expect(deriveBuildInputs({ nodes }, workflow).nodePacks).toEqual([
        { id: 'comfyui-kjnodes', versions: ['1.0.9', '1.1.4'] }
      ])
    }
  )

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
      workflow,
      loaderInput
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

  it('leaves out a subgraph definition the graph no longer uses', () => {
    const inputs = deriveBuildInputs(
      {
        nodes: [{ id: 1, type: 'used' }],
        definitions: {
          subgraphs: [
            subgraph('used', 'KSampler'),
            subgraph('orphan', 'StaleLoader')
          ]
        }
      },
      workflow
    )

    expect(inputs.nodeClasses).toEqual(['KSampler'])
  })

  it.for([
    { shape: 'a string', graph: 'not a workflow' },
    { shape: 'null', graph: null },
    { shape: 'nodes that are not a list', graph: { nodes: 5 } },
    {
      shape: 'nodes without an id or type',
      graph: { nodes: [{ widgets_values: ['x.safetensors'] }, 'KSampler'] }
    },
    {
      shape: 'nodes without a usable id or type',
      graph: {
        nodes: [
          { id: 1, type: 5 },
          { id: {}, type: 'KSampler' }
        ]
      }
    },
    {
      shape: 'definitions that are not a list',
      graph: { nodes: [], definitions: { subgraphs: 'x' } }
    }
  ])('reads nothing from $shape instead of throwing', ({ graph }) => {
    expect(deriveBuildInputs(graph, workflow)).toEqual({
      workflowName: 'portrait',
      workflowFileName: 'portrait.json',
      nodeClasses: [],
      nodePacks: [],
      models: []
    })
  })

  it('takes model names only from the model input of a known loader', () => {
    const inputs = deriveBuildInputs(
      {
        nodes: [
          {
            id: 1,
            type: 'CLIPTextEncode',
            widgets_values: ['a photo of my cat.pt']
          },
          {
            id: 2,
            type: 'CheckpointLoaderSimple',
            widgets_values: ['sd_xl.safetensors']
          },
          {
            id: 3,
            type: 'LoraLoader',
            widgets_values: {
              lora_name: 'detail.safetensors',
              note: 'old.pt'
            }
          },
          {
            id: 5,
            type: 'INPAINT_LoadFooocusInpaint',
            widgets_values: {
              head: 'fooocus_inpaint_head.pth',
              patch: 'inpaint_v26.fooocus.patch'
            }
          },
          {
            id: 4,
            type: 'UnknownPackLoader',
            widgets_values: ['custom.gguf'],
            properties: { models: [{ name: 'recorded.safetensors' }] }
          }
        ]
      },
      workflow,
      loaderInput
    )

    expect(inputs.models).toEqual([
      'detail.safetensors',
      'fooocus_inpaint_head.pth',
      'inpaint_v26.fooocus.patch',
      'recorded.safetensors',
      'sd_xl.safetensors'
    ])
  })

  it('keeps a node whose optional fields are malformed, without trusting them', () => {
    const inputs = deriveBuildInputs(
      {
        nodes: [
          { id: 1, type: 'KSampler', properties: 'bad', widgets_values: 42 },
          {
            id: 2,
            type: 'CheckpointLoaderSimple',
            properties: { cnr_id: 7 },
            widgets_values: ['sd_xl.safetensors']
          }
        ]
      },
      workflow,
      (nodeType) => (nodeType === 'CheckpointLoaderSimple' ? ['ckpt_name'] : [])
    )

    expect(inputs.nodeClasses).toEqual(['CheckpointLoaderSimple', 'KSampler'])
    expect(inputs.nodePacks).toEqual([])
    expect(inputs.models).toEqual(['sd_xl.safetensors'])
  })
})
