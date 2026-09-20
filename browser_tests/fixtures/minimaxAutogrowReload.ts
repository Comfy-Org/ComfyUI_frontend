import type { Page } from '@playwright/test'

import type { RecordedGraphOperation } from '@e2e/fixtures/data/agent/agentConversation'
import {
  BYTEDANCE_REFERENCE_NODE_TYPE,
  byteDanceReferenceNodeDef
} from '@e2e/fixtures/data/byteDanceReferenceNodeDef'
import { routeObjectInfoFromSetupApi } from '@e2e/fixtures/utils/objectInfo'
import type { LinkId } from '@/types/linkId'

/**
 * Owns the PM-993 regression's setup so the spec states only the behaviour:
 * a reference node whose autogrow group expands on reopen, the two sources
 * wired into it, and the link facts a reopen must preserve.
 */

const SOURCE_NODE_ID = 100
const SEED_SOURCE_NODE_ID = 102
const REFERENCE_NODE_ID = 101
const FIRST_REFERENCE_INPUT = 'model.reference_images.image_1'
const NEXT_REFERENCE_INPUT = 'model.reference_images.image_2'
const SEED_INPUT = 'seed'

/** Serves the Seedance reference node's `/object_info` entry for one test. */
export async function routeReferenceNodeDef(
  page: Page
): Promise<() => Promise<void>> {
  return routeObjectInfoFromSetupApi(page, (objectInfo) => {
    objectInfo[BYTEDANCE_REFERENCE_NODE_TYPE] = byteDanceReferenceNodeDef
  })
}

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

export interface ReferenceWiring {
  /** Reopening grew the next image input, moving every later slot. */
  hasNextReference: boolean
  /** The image wire survived that growth. */
  referenceLinked: boolean
  /** The widget-input wire's link id before the reopen. */
  seedLinkBefore: LinkId | null | undefined
  /** The same input's link id after it, which must be unchanged. */
  seedLinkAfter: LinkId | null | undefined
}

/**
 * Wires both sources into the reference node, saves and reopens the workflow
 * the way loading does, and reports what the reopened node holds. The report
 * is read from the graph because the defect is a silent re-target: the wire
 * still paints, just into the wrong input.
 */
export async function wireAndReopen(page: Page): Promise<ReferenceWiring> {
  return page.evaluate(
    ({
      sourceId,
      seedSourceId,
      referenceId,
      firstReference,
      nextReference,
      seed
    }) => {
      const graph = window.app!.graph
      const byId = (id: number) =>
        graph._nodes.find((node) => String(node.id) === String(id))!
      const source = byId(sourceId)
      const seedSource = byId(seedSourceId)
      const target = byId(referenceId)

      seedSource.connect(0, target, target.findInputSlot(seed))
      const seedLinkBefore = target.inputs[target.findInputSlot(seed)].link
      source.connect(0, target, target.findInputSlot(firstReference))

      graph.configure(structuredClone(graph.serialize()))

      const reopened = byId(referenceId)
      return {
        hasNextReference: reopened.findInputSlot(nextReference) >= 0,
        referenceLinked:
          reopened.inputs[reopened.findInputSlot(firstReference)].link != null,
        seedLinkBefore,
        seedLinkAfter: reopened.inputs[reopened.findInputSlot(seed)].link
      }
    },
    {
      sourceId: SOURCE_NODE_ID,
      seedSourceId: SEED_SOURCE_NODE_ID,
      referenceId: REFERENCE_NODE_ID,
      firstReference: FIRST_REFERENCE_INPUT,
      nextReference: NEXT_REFERENCE_INPUT,
      seed: SEED_INPUT
    }
  )
}
