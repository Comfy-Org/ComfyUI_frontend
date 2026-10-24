import type { ComfyNodeDef } from '@/schemas/nodeDefSchema'

export const DYNAMIC_COMBO_CLASS = 'DynamicModePicker'

export const dynamicComboNodeDef: ComfyNodeDef = {
  name: DYNAMIC_COMBO_CLASS,
  display_name: 'Dynamic Mode Picker',
  description: '',
  category: 'testing',
  python_module: 'custom_nodes.test',
  output_node: false,
  input: {
    required: {
      mode: [
        'COMFY_DYNAMICCOMBO_V3',
        {
          options: [
            { key: 'creative', inputs: { required: {} } },
            {
              key: 'faithful',
              inputs: {
                required: {
                  detail: ['INT', { default: 80, min: 0, max: 100 }]
                }
              }
            }
          ]
        }
      ]
    }
  },
  output: ['STRING'],
  output_is_list: [false],
  output_name: ['STRING']
}
