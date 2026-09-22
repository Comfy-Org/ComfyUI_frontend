import type { WidgetCatalog, WorkflowJSON } from '@comfyorg/comfy-multi-player'
import type { ComfyNodeDef } from '@/schemas/nodeDefSchema'
import type { GraphOperation } from '@/workbench/extensions/agent/crdt/graphOperations'
import {
  BYTEDANCE_REFERENCE_NODE_TYPE,
  byteDanceReferenceNodeDef
} from '@e2e/fixtures/data/byteDanceReferenceNodeDef'

export const SOURCE_NODE_ID = 100
export const SEED_SOURCE_NODE_ID = 102
export const REFERENCE_NODE_ID = 101
export const FIRST_REFERENCE_INPUT = 'model.reference_images.image_1'
export const SEED_INPUT = 'seed'

/**
 * An image source, an int source, and the reference node the agent builds for
 * a MiniMax-style template. The reference node is saved with a single grown
 * image input, so reopening it grows the next one and moves every later slot.
 */
export const referenceGraphOps: GraphOperation[] = [
  {
    op: 'add_node',
    node_id: String(SOURCE_NODE_ID),
    class_type: 'LoadImage',
    pos: [0, 500],
    node: {
      id: SOURCE_NODE_ID,
      type: 'LoadImage',
      pos: [0, 500],
      size: [250, 300],
      inputs: [],
      outputs: [{ name: 'IMAGE', type: 'IMAGE', links: [] }],
      widgets_values: ['example.png', 'image']
    }
  },
  {
    op: 'add_node',
    node_id: String(SEED_SOURCE_NODE_ID),
    class_type: 'PrimitiveInt',
    pos: [0, 850],
    node: {
      id: SEED_SOURCE_NODE_ID,
      type: 'PrimitiveInt',
      pos: [0, 850],
      size: [200, 40],
      inputs: [],
      outputs: [{ name: 'value', type: 'INT', links: [] }],
      widgets_values: [42]
    }
  },
  {
    op: 'add_node',
    node_id: String(REFERENCE_NODE_ID),
    class_type: BYTEDANCE_REFERENCE_NODE_TYPE,
    pos: [400, 500],
    node: {
      id: REFERENCE_NODE_ID,
      type: BYTEDANCE_REFERENCE_NODE_TYPE,
      pos: [400, 500],
      size: [350, 400],
      inputs: [
        { name: FIRST_REFERENCE_INPUT, type: 'IMAGE', link: null },
        {
          name: SEED_INPUT,
          type: 'INT',
          widget: { name: SEED_INPUT },
          link: null
        },
        {
          name: 'watermark',
          type: 'BOOLEAN',
          widget: { name: 'watermark' },
          link: null
        }
      ],
      outputs: [{ name: 'VIDEO', type: 'VIDEO', links: [] }],
      widgets_values: [
        'Seedance 2.5',
        '',
        '720p',
        '16:9',
        5,
        true,
        false,
        'mp4',
        0,
        false
      ]
    }
  }
]

export const referenceNodeDefs: Record<string, ComfyNodeDef> = {
  LoadImage: {
    name: 'LoadImage',
    display_name: 'Load Image',
    description: '',
    category: 'image',
    python_module: 'nodes',
    output_node: false,
    output: ['IMAGE', 'MASK'],
    output_name: ['IMAGE', 'MASK'],
    output_is_list: [false, false],
    input: {
      required: { image: [['example.png'], {}], upload: ['IMAGEUPLOAD', {}] }
    },
    input_order: { required: ['image', 'upload'] }
  },
  PrimitiveInt: {
    name: 'PrimitiveInt',
    display_name: 'Primitive Int',
    description: '',
    category: 'utils',
    python_module: 'comfy_extras.nodes_primitives',
    output_node: false,
    output: ['INT'],
    output_name: ['value'],
    output_is_list: [false],
    input: { required: { value: ['INT', { default: 42 }] } },
    input_order: { required: ['value'] }
  },
  [BYTEDANCE_REFERENCE_NODE_TYPE]: byteDanceReferenceNodeDef
}

export const referenceCatalog: WidgetCatalog = {
  types: {
    LoadImage: { widget_order: ['image', 'upload'] },
    PrimitiveInt: { widget_order: ['value'] },
    [BYTEDANCE_REFERENCE_NODE_TYPE]: {
      widget_order: [
        'model',
        'model.prompt',
        'model.resolution',
        'model.ratio',
        'model.duration',
        'model.generate_audio',
        'model.video_editing',
        'model.output_format',
        'seed',
        'watermark'
      ]
    }
  }
}

export const referenceSeed: WorkflowJSON = {
  nodes: [],
  links: [],
  groups: [],
  config: {},
  extra: {},
  version: 0.4
}
