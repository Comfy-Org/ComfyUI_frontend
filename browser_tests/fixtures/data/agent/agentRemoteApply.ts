import type { WidgetCatalog, WorkflowJSON } from '@comfyorg/comfy-multi-player'

import type { RecordedGraphOperation } from '@e2e/fixtures/data/agent/agentConversation'

const LOAD_IMAGE_TYPE = 'LoadImage'

/**
 * The follower only renders widget values for a class the pinned catalog
 * names (KEEP-ALIVE #12), so the catalog entry has to list `LoadImage`'s own
 * widget order rather than an empty one.
 */
export const catalog: WidgetCatalog = {
  types: { [LOAD_IMAGE_TYPE]: { widget_order: ['image', 'upload'] } }
}

/** Every one of these specs starts the user on an empty canvas. */
export const emptySeed: WorkflowJSON = { nodes: [], links: [] }

/**
 * Node ids the agent mints. Fixed rather than random so a failure names the
 * node that went missing; they are outside the range the canvas itself
 * allocates, matching what the applier's own mint produces.
 */
export const AGENT_NODE_IDS = [
  7_010_001, 7_010_002, 7_010_003, 7_010_004, 7_010_005
] as const

/** Laid out in a row, the way a batched agent build places a group. */
export function addLoadImageNode(
  nodeId: number,
  index: number
): RecordedGraphOperation {
  const pos = [120 + index * 260, 140]
  return {
    op: 'add_node',
    pos,
    node: {
      id: nodeId,
      pos,
      mode: 0,
      size: [220, 300],
      type: LOAD_IMAGE_TYPE,
      flags: {},
      order: index,
      inputs: [],
      outputs: [],
      properties: {},
      widgets_values: [`agent-${index + 1}.png`, 'image']
    },
    node_id: nodeId,
    class_type: LOAD_IMAGE_TYPE
  }
}

/** The five-node build the golden path asks for, in one batch. */
export function addFiveLoadImageNodes(): RecordedGraphOperation[] {
  return AGENT_NODE_IDS.map((id, index) => addLoadImageNode(id, index))
}

/** No links exist in these fixtures, so nothing is severed by a delete. */
export function deleteNode(nodeId: number): RecordedGraphOperation {
  return { op: 'delete_node', node_id: nodeId, removed_links: [] }
}
