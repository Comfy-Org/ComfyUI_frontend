import type { ISerialisedNode } from '@/lib/litegraph/src/types/serialisation'
import type { ComfyNodeDef } from '@/schemas/nodeDefSchema'

// Reduced from PM-994: expanded images precede widgets in the saved node.
export const nodeDef: ComfyNodeDef = {
  name: 'AutogrowInputOrder',
  display_name: 'Autogrow Input Order',
  category: 'testing',
  description: '',
  python_module: 'testing',
  output_node: false,
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
            max: 3
          }
        }
      ]
    }
  },
  output: [],
  output_name: []
}

export const savedNode = {
  id: 2,
  type: nodeDef.name,
  pos: [300, 0],
  size: [200, 200],
  flags: {},
  order: 1,
  mode: 0,
  inputs: [
    { name: 'ref_images.ref_image_0', type: 'IMAGE', link: 278 },
    { name: 'ref_images.ref_image_1', type: 'IMAGE', link: 282 },
    { name: 'ref_images.ref_image_2', type: 'IMAGE', link: null },
    { name: 'prompt', type: 'STRING', widget: { name: 'prompt' }, link: 279 },
    { name: 'width', type: 'INT', widget: { name: 'width' }, link: 276 },
    { name: 'height', type: 'INT', widget: { name: 'height' }, link: 277 },
    { name: 'length', type: 'INT', widget: { name: 'length' }, link: 275 }
  ],
  outputs: [],
  widgets_values: ['', 640, 480, 24, 'match']
} satisfies ISerialisedNode
