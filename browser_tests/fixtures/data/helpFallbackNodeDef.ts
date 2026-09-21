import type { ComfyNodeDef } from '@/schemas/nodeDefSchema'

export const helpFallbackNodeDef: ComfyNodeDef = {
  name: 'HelpFallbackNode',
  display_name: 'Help Fallback Node',
  category: 'help_fallback',
  input: { required: {}, optional: {} },
  output: ['IMAGE'],
  output_name: ['image'],
  output_is_list: [false],
  output_node: false,
  python_module: 'custom_nodes.help_fallback_pack',
  description: 'Custom node description fallback'
}
