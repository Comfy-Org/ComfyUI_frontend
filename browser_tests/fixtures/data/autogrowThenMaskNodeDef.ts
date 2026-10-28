import type { ComfyNodeDef } from '@/schemas/nodeDefSchema'

export const AUTOGROW_THEN_MASK_NODE_TYPE = 'AutogrowThenMaskTestNode'

export const AUTOGROW_THEN_MASK_NODE_TITLE = 'Autogrow Then Mask'

/**
 * A `COMFY_AUTOGROW_V3` group followed by an ordinary `mask` input. Growing the
 * group pushes `mask` to a later slot (FE-3325). Injected into `object_info`
 * so the spec does not depend on the pinned CI backend shipping such a node.
 */
export const autogrowThenMaskNodeDef: ComfyNodeDef = {
  name: AUTOGROW_THEN_MASK_NODE_TYPE,
  display_name: AUTOGROW_THEN_MASK_NODE_TITLE,
  description: '',
  category: 'testing',
  python_module: 'nodes',
  output_node: false,
  output: ['IMAGE'],
  output_is_list: [false],
  output_name: ['IMAGE'],
  input: {
    required: {
      images: [
        'COMFY_AUTOGROW_V3',
        {
          template: {
            input: { required: { image: ['IMAGE', {}] } },
            prefix: 'image',
            min: 1
          }
        }
      ],
      mask: ['MASK', {}]
    }
  },
  input_order: { required: ['images', 'mask'] }
}
