import type { RecordedGraphOperation } from '@e2e/fixtures/data/agent/agentConversation'
import { BYTEDANCE_REFERENCE_NODE_TYPE } from '@e2e/fixtures/data/byteDanceReferenceNodeDef'

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
export const referenceGraphOps: RecordedGraphOperation[] = [
  {
    op: 'add_node',
    node_id: SOURCE_NODE_ID,
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
    node_id: SEED_SOURCE_NODE_ID,
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
    node_id: REFERENCE_NODE_ID,
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
