import type { WidgetCatalog, WorkflowJSON } from '@comfyorg/comfy-multi-player'
import type { ComfyNodeDef } from '@/schemas/nodeDefSchema'

import type { RecordedGraphOperation } from '@e2e/fixtures/data/agent/agentConversation'

const missingWidgetNodeType = 'TestMissingWidgetAddress'
export const missingWidgetNodeId = 811
export const keptWidget = 'kept'
export const otherWidget = 'other'

const markerType = 'TestRefusalDeliveryMarker'
export const dottedMarkerId = 812
export const overflowMarkerId = 813

export const absentDottedWidget = 'reference.image'
export const absentOverflowAlias = '_extra_1'

export const keptValue = 'kept by the canvas'
export const otherDefault = 'left on its definition default'
export const refusedValue = 'must never be shown'
export const laterValue = 'applied after the refusal'

export const missingWidgetWorkflowId = '6b2d8e14-3f7a-4c95-8d20-5e6f7a8b9c01'
export const missingWidgetThreadId = '7c3e9f25-4a8b-4d06-9e31-6f708192a3b4'
export const missingWidgetMessageId = '8d4fa036-5b9c-4e17-8f42-70819203b4c5'

const nodeDef: ComfyNodeDef = {
  name: missingWidgetNodeType,
  display_name: 'Test Missing Widget Address',
  description: '',
  category: 'test',
  python_module: 'test',
  output_node: false,
  output: ['STRING'],
  output_is_list: [false],
  output_name: ['STRING'],
  input: {
    required: {
      [keptWidget]: ['STRING', { default: 'definition default' }],
      [otherWidget]: ['STRING', { default: otherDefault }]
    }
  },
  input_order: { required: [keptWidget, otherWidget] }
}

const markerDef: ComfyNodeDef = {
  name: markerType,
  display_name: 'Test Refusal Delivery Marker',
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

export const missingWidgetObjectInfo = {
  [missingWidgetNodeType]: nodeDef,
  [markerType]: markerDef
}

export const missingWidgetCatalog: WidgetCatalog = {
  types: {
    [missingWidgetNodeType]: { widget_order: [keptWidget] },
    [markerType]: { widget_order: [] }
  }
}

export const missingWidgetSeed: WorkflowJSON = {
  nodes: [
    {
      id: missingWidgetNodeId,
      type: missingWidgetNodeType,
      pos: [0, 0],
      size: [270, 140],
      flags: {},
      order: 0,
      mode: 0,
      inputs: [],
      outputs: [{ name: 'STRING', type: 'STRING', links: [] }],
      properties: {},
      widgets_values: [keptValue]
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
    pos: [400, 0],
    node: {
      id: nodeId,
      type: markerType,
      pos: [400, 0],
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
