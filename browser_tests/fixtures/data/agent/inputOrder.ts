import type { WidgetCatalog, WorkflowJSON } from '@comfyorg/comfy-multi-player'

import type { ComfyNodeDef } from '@/schemas/nodeDefSchema'

export const workflowId = 'ac09c341-fc48-4860-9dc4-294950cb8705'
export const threadId = 'c7f41995-964b-4ba9-9bfb-fdc972ad12bc'
export const messageId = 'c9a86103-c034-44c9-b956-f74e1a348678'

const target: ComfyNodeDef = {
  name: 'AutogrowInputOrder',
  display_name: 'Autogrow Input Order',
  category: 'testing',
  description: '',
  python_module: 'testing',
  output_node: true,
  input: {
    required: {
      prompt: ['STRING', { multiline: true }],
      width: ['INT', { default: 640 }],
      height: ['INT', { default: 480 }],
      length: ['INT', { default: 24 }],
      ref_image_size: ['COMBO', { options: ['match', 'max'] }]
    },
    optional: {
      ref_images: [
        'COMFY_AUTOGROW_V3',
        {
          template: {
            input: { required: { ref_image: ['IMAGE', {}] } },
            prefix: 'ref_image_',
            min: 0,
            max: 4
          }
        }
      ]
    }
  },
  output: [],
  output_name: []
}

const source: ComfyNodeDef = {
  name: 'ReferenceSources',
  display_name: 'Reference Sources',
  category: 'testing',
  description: '',
  python_module: 'testing',
  output_node: false,
  input: {
    required: {
      width: ['INT', { default: 640 }],
      height: ['INT', { default: 480 }],
      length: ['INT', { default: 24 }],
      prompt: ['STRING', { multiline: true }]
    }
  },
  output: ['INT', 'INT', 'INT', 'STRING', 'IMAGE', 'IMAGE'],
  output_name: ['width', 'height', 'length', 'prompt', 'image_a', 'image_b']
}

export const objectInfo = {
  [source.name]: source,
  [target.name]: target
}

export const catalog: WidgetCatalog = {
  types: {
    ReferenceSources: { widget_order: ['width', 'height', 'length', 'prompt'] },
    AutogrowInputOrder: {
      widget_order: ['prompt', 'width', 'height', 'length', 'ref_image_size']
    }
  }
}

// Reduced saved-workflow topology from PR #17221, not a recorded Agent turn.
export const seed: WorkflowJSON = {
  nodes: [
    {
      id: 1,
      type: source.name,
      pos: [30, 80],
      size: [260, 320],
      flags: {},
      order: 0,
      mode: 0,
      inputs: [],
      outputs: [
        { name: 'width', type: 'INT', links: [276] },
        { name: 'height', type: 'INT', links: [277] },
        { name: 'length', type: 'INT', links: [275] },
        { name: 'prompt', type: 'STRING', links: [279] },
        { name: 'image_a', type: 'IMAGE', links: [278] },
        { name: 'image_b', type: 'IMAGE', links: [282] }
      ],
      properties: {},
      widgets_values: [832, 448, 37, 'Keep the reference framing']
    },
    {
      id: 2,
      type: target.name,
      pos: [340, 80],
      size: [280, 320],
      flags: {},
      order: 1,
      mode: 0,
      inputs: [
        { name: 'ref_images.ref_image_0', type: 'IMAGE', link: 278 },
        { name: 'ref_images.ref_image_1', type: 'IMAGE', link: 282 },
        { name: 'ref_images.ref_image_2', type: 'IMAGE', link: null },
        {
          name: 'prompt',
          type: 'STRING',
          widget: { name: 'prompt' },
          link: 279
        },
        { name: 'width', type: 'INT', widget: { name: 'width' }, link: 276 },
        { name: 'height', type: 'INT', widget: { name: 'height' }, link: 277 },
        { name: 'length', type: 'INT', widget: { name: 'length' }, link: 275 }
      ],
      outputs: [],
      properties: {},
      widgets_values: ['Unconnected prompt fallback', 640, 480, 24, 'max']
    }
  ],
  links: [
    [276, 1, 0, 2, 4, 'INT'],
    [277, 1, 1, 2, 5, 'INT'],
    [275, 1, 2, 2, 6, 'INT'],
    [279, 1, 3, 2, 3, 'STRING'],
    [278, 1, 4, 2, 0, 'IMAGE'],
    [282, 1, 5, 2, 1, 'IMAGE']
  ],
  groups: [],
  config: {},
  extra: {},
  version: 0.4
}
