import type { ComfyNodeDef } from '@/schemas/nodeDefSchema'

export const AGENT_WIDGET_FORM_NODE_TYPE = 'AgentWidgetFormProbe'

export const agentWidgetFormNodeDef: ComfyNodeDef = {
  name: AGENT_WIDGET_FORM_NODE_TYPE,
  display_name: 'Agent Widget Form Probe',
  description: '',
  category: 'testing',
  python_module: 'browser_tests.agent_widget_form',
  output_node: false,
  output: ['STRING'],
  output_is_list: [false],
  output_name: ['text'],
  input: {
    required: {
      text: ['STRING', { default: 'initial value', multiline: false }]
    }
  },
  input_order: { required: ['text'] }
}
