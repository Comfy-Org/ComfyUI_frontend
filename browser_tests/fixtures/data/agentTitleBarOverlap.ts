import type { Op, WidgetCatalog } from '@comfyorg/comfy-multi-player'

export const WORKFLOW_ID = 'c4f8e0d2-0000-4000-8000-000000000030'
export const MESSAGE_ID = 'c4f8e0d2-0000-4000-8000-000000000031'
export const THREAD_ID = 'c4f8e0d2-0000-4000-8000-000000000032'

function note(
  id: number,
  pos: [number, number],
  size: [number, number],
  text: string
) {
  return {
    id,
    type: 'MarkdownNote',
    pos,
    size,
    mode: 0,
    order: 0,
    flags: {},
    inputs: [],
    outputs: [],
    properties: {},
    widgets_values: [text]
  }
}

/**
 * The gap left between the existing node's body and the incoming one's, in
 * graph units. Smaller than `LiteGraph.NODE_TITLE_HEIGHT` (30), so the bodies
 * clear each other while the incoming node's title bar is drawn across the
 * existing node.
 */
export const BODY_GAP_PX = 10

export const EXISTING_NODES = [note(1, [0, 180], [400, 300], 'Existing node A')]

/**
 * One node whose *body* sits `BODY_GAP_PX` below the existing node's body, so a
 * rect built from `pos`/`size` shows a clear 10px gap while the rendered boxes
 * overlap by `NODE_TITLE_HEIGHT - BODY_GAP_PX`.
 */
export const INCOMING_NODES = [
  note(42, [0, 180 + 300 + BODY_GAP_PX], [400, 200], 'Agent node')
]

export const TITLE_BAR_CATALOG: WidgetCatalog = {
  types: { MarkdownNote: { widget_order: ['text'] } }
}

export const INSERT_INCOMING_OPS = [
  {
    op_id: 'agent-title-bar-overlap-op-0'.padEnd(32, '0'),
    actor: 'agent:e2e:turn-1',
    base_version: 1,
    stamp: [1, 'agent:e2e:turn-1'],
    op: 'insert_workflow',
    workflow: { nodes: INCOMING_NODES, links: [] }
  }
] satisfies Op[]
