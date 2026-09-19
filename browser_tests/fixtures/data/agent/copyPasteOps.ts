import type { RecordedGraphOperation } from '@e2e/fixtures/data/agent/agentConversation'

/**
 * An agent `add_node` that claims `nodeId` for a SaveImage, shaped like the
 * ops the recordings under `conversations/` carry. Used to land an agent
 * node on the id a human paste minted moments earlier.
 */
export function saveImageAddNodeOp(
  nodeId: number,
  pos: [number, number]
): RecordedGraphOperation {
  return {
    op: 'add_node',
    node_id: nodeId,
    class_type: 'SaveImage',
    pos,
    node: {
      id: nodeId,
      type: 'SaveImage',
      pos,
      size: [315, 270],
      flags: {},
      order: 0,
      mode: 0,
      inputs: [{ name: 'images', type: 'IMAGE', link: null }],
      outputs: [],
      properties: {},
      widgets_values: ['ComfyUI']
    }
  }
}

/** A widget edit on an existing node, shaped like the recorded `set_widget` ops. */
export function setWidgetOp(
  nodeId: number,
  widget: string,
  from: number,
  to: number
): RecordedGraphOperation {
  return { op: 'set_widget', node_id: nodeId, widget, old: from, value: to }
}
