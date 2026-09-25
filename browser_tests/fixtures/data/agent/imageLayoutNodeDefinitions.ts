import type { ComfyNodeDef } from '@/schemas/nodeDefSchema'

export const imageLayoutNodeDefinitions: Record<string, ComfyNodeDef> = {
  LoadImage: {
    name: 'LoadImage',
    display_name: 'Load Image',
    description: '',
    category: 'image',
    python_module: 'nodes',
    output_node: false,
    output: ['IMAGE', 'MASK'],
    output_is_list: [false, false],
    output_name: ['IMAGE', 'MASK'],
    input: {
      required: {
        image: [['fixture.png'], { image_upload: true }]
      }
    }
  },
  SaveImage: {
    name: 'SaveImage',
    display_name: 'Save Image',
    description: '',
    category: 'image',
    python_module: 'nodes',
    output_node: true,
    output: [],
    output_is_list: [],
    output_name: [],
    input: {
      required: {
        images: ['IMAGE', {}],
        filename_prefix: ['STRING', { default: 'ComfyUI' }]
      }
    }
  }
}
