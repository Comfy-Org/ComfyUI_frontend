import type { WidgetCatalog, WorkflowJSON } from '@comfyorg/comfy-multi-player'
import type { ComfyNodeDef } from '@comfyorg/object-info-parser'

import type { LGraphNode } from '@/lib/litegraph/src/litegraph'
import type { RecordedGraphOperation } from '@e2e/fixtures/data/agent/recordedGraphOperation'

export const packSeedNodeType = 'TestPackRemovedSeedControl'
export const packSeedNodeId = 821
export const seedWidget = 'seed'
export const controlWidget = 'control_after_generate'
export const labelWidget = 'label'
/**
 * Declared `forceInput`, so `addInputWidget` returns before the factory and no
 * widget is ever built. That keeps it a declared-but-unbuilt gap rather than a
 * name this definition does not carry, which is what the follower must still
 * report once undeclared names stop being reported (#24052).
 */
export const absentWidget = 'cfg'

const markerType = 'TestRemovedSeedControlMarker'
export const controlMarkerId = 822
export const absentMarkerId = 823

export const seedValue = '5'
const controlMode = 'increment'
export const labelValue = 'kept by the canvas'
export const laterLabelValue = 'applied after the skipped control'
export const refusedMode = 'randomize'

export const removedSeedControlWorkflowId =
  '9e5c1f73-2a46-4b58-9c07-1d2e3f4a5b60'
export const removedSeedControlThreadId = 'af6d2084-3b57-4c69-8d18-2e3f4a5b6c71'
export const removedSeedControlMessageId =
  'b07e3195-4c68-4d7a-9e29-3f4a5b6c7d82'

const nodeDef: ComfyNodeDef = {
  name: packSeedNodeType,
  display_name: 'Test Pack Removed Seed Control',
  description: '',
  category: 'test',
  python_module: 'test',
  output_node: false,
  output: ['INT'],
  output_is_list: [false],
  output_name: ['INT'],
  input: {
    required: {
      [seedWidget]: [
        'INT',
        {
          default: 0,
          min: 0,
          max: 2147483647,
          control_after_generate: true
        }
      ],
      [labelWidget]: ['STRING', { default: 'definition default' }],
      [absentWidget]: ['FLOAT', { default: 8, forceInput: true }]
    }
  },
  input_order: { required: [seedWidget, labelWidget, absentWidget] }
}

const markerDef: ComfyNodeDef = {
  name: markerType,
  display_name: 'Test Removed Seed Control Marker',
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

export const removedSeedControlObjectInfo = {
  [packSeedNodeType]: nodeDef,
  [markerType]: markerDef
}

export const removedSeedControlCatalog: WidgetCatalog = {
  types: {
    [packSeedNodeType]: {
      widget_order: [seedWidget, controlWidget, labelWidget]
    },
    [markerType]: { widget_order: [] }
  }
}

export const removedSeedControlSeed: WorkflowJSON = {
  nodes: [
    {
      id: packSeedNodeId,
      type: packSeedNodeType,
      pos: [0, 0],
      size: [270, 160],
      flags: {},
      order: 0,
      mode: 0,
      inputs: [],
      outputs: [{ name: 'INT', type: 'INT', links: [] }],
      properties: {},
      widgets_values: [Number(seedValue), controlMode, labelValue]
    }
  ],
  links: [],
  groups: [],
  config: {},
  extra: {},
  version: 0.4
}

/**
 * The shape rgthree's `Seed (rgthree)` and the efficiency-nodes KSamplers
 * ship: the pack drops the frontend-built value control in `onNodeCreated`
 * and runs its own seed logic.
 */
export function removeControlInOnNodeCreated({
  nodeTypeName,
  controlName
}: {
  nodeTypeName: string
  controlName: string
}): void {
  const nodeType = window.LiteGraph?.registered_node_types[nodeTypeName]
  if (!nodeType) throw new Error('the pack seed node type is not registered')
  const original = nodeType.prototype.onNodeCreated
  nodeType.prototype.onNodeCreated = function (this: LGraphNode) {
    original?.call(this)
    const index =
      this.widgets?.findIndex((widget) => widget.name === controlName) ?? -1
    if (index >= 0) this.widgets?.splice(index, 1)
  }
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
