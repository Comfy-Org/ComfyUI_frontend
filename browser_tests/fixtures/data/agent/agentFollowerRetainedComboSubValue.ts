import type { WidgetCatalog, WorkflowJSON } from '@comfyorg/comfy-multi-player'
import type { ComfyNodeDef } from '@comfyorg/object-info-parser'

import type { RecordedGraphOperation } from '@e2e/fixtures/data/agent/agentConversation'

const comboAddressNodeType = 'TestSelectionComboAddress'
export const comboAddressNodeId = 821

const markerType = 'TestRetainedSubValueDeliveryMarker'
export const retainedMarkerId = 822
export const overflowMarkerId = 823
export const driftMarkerId = 824
export const unreachableOverflowMarkerId = 825

export const promptWidget = 'prompt'
export const selectorWidget = 'model'
export const selectedOptionSubWidget = 'size_preset'
export const unselectedOptionSubWidget = 'task_type'
const unselectedOptionWideningSubWidget = 'strength'
export const unownedSubWidget = 'retired_field'
export const overflowAliasPastSelection = '_extra_3'
export const overflowAliasBeyondEverySelection = '_extra_5'

export const promptValue = 'kept by the canvas'
export const selectedSubValue = 'a4'
export const retainedSubValue = 'must never be shown'
export const laterPromptValue = 'applied after the retained value arrived'

export const comboAddressWorkflowId = '9e5f0147-6c0d-4f28-9a53-81920314c5d6'
export const comboAddressThreadId = 'af601258-7d1e-4039-ab64-920314c5d6e7'
export const comboAddressMessageId = 'b0712369-8e2f-414a-bc75-0314c5d6e7f8'

const nodeDef: ComfyNodeDef = {
  name: comboAddressNodeType,
  display_name: 'Test Selection Combo Address',
  description: '',
  category: 'test',
  python_module: 'test',
  output_node: false,
  output: ['STRING'],
  output_is_list: [false],
  output_name: ['STRING'],
  input: {
    required: {
      [promptWidget]: ['STRING', { default: 'definition default' }],
      [selectorWidget]: [
        'COMFY_DYNAMICCOMBO_V3',
        {
          options: [
            {
              key: 'seedream',
              inputs: {
                required: {
                  [selectedOptionSubWidget]: ['STRING', { default: '1k' }]
                }
              }
            },
            {
              key: 'reference',
              inputs: {
                required: {
                  [unselectedOptionSubWidget]: ['STRING', { default: 'edit' }],
                  [unselectedOptionWideningSubWidget]: [
                    'STRING',
                    { default: 'half' }
                  ]
                }
              }
            }
          ]
        }
      ]
    }
  },
  input_order: { required: [promptWidget, selectorWidget] }
}

const markerDef: ComfyNodeDef = {
  name: markerType,
  display_name: 'Test Retained Sub Value Delivery Marker',
  description: '',
  category: 'test',
  python_module: 'test',
  output_node: false,
  output: ['STRING'],
  output_is_list: [false],
  output_name: ['STRING'],
  input: {},
  input_order: {}
}

export const comboAddressObjectInfo = {
  [comboAddressNodeType]: nodeDef,
  [markerType]: markerDef
}

export const comboAddressCatalog: WidgetCatalog = {
  types: {
    [comboAddressNodeType]: {
      widget_order: [
        promptWidget,
        selectorWidget,
        `${selectorWidget}.${selectedOptionSubWidget}`
      ],
      dynamic_combos: {
        [selectorWidget]: {
          default: 'seedream',
          options: {
            seedream: {
              widgets: [`${selectorWidget}.${selectedOptionSubWidget}`],
              defaults: {
                [`${selectorWidget}.${selectedOptionSubWidget}`]: '1k'
              }
            },
            reference: {
              widgets: [
                `${selectorWidget}.${unselectedOptionSubWidget}`,
                `${selectorWidget}.${unselectedOptionWideningSubWidget}`
              ],
              defaults: {
                [`${selectorWidget}.${unselectedOptionSubWidget}`]: 'edit',
                [`${selectorWidget}.${unselectedOptionWideningSubWidget}`]:
                  'half'
              }
            }
          }
        }
      }
    },
    [markerType]: { widget_order: [] }
  }
}

export const comboAddressSeed: WorkflowJSON = {
  nodes: [
    {
      id: comboAddressNodeId,
      type: comboAddressNodeType,
      pos: [0, 0],
      size: [300, 160],
      flags: {},
      order: 0,
      mode: 0,
      inputs: [],
      outputs: [{ name: 'STRING', type: 'STRING', links: [] }],
      properties: {},
      widgets_values: [promptValue, 'seedream', selectedSubValue]
    }
  ],
  links: [],
  groups: [],
  config: {},
  extra: {},
  version: 0.4
}

export function createDeliveryBarrierAdd(
  nodeId: number
): RecordedGraphOperation {
  return {
    op: 'add_node',
    node_id: nodeId,
    class_type: markerType,
    pos: [460, 0],
    node: {
      id: nodeId,
      type: markerType,
      pos: [460, 0],
      size: [200, 60],
      mode: 0,
      flags: {},
      order: 1,
      inputs: [],
      outputs: [{ name: 'STRING', type: 'STRING', links: [] }],
      properties: {},
      widgets_values: []
    }
  }
}
