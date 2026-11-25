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

export const BODY_GAP_PX = 10

export const EXISTING_NODES = [note(1, [0, 180], [400, 300], 'Existing node A')]

const existingBodyBottom = EXISTING_NODES[0].pos[1] + EXISTING_NODES[0].size[1]

export const INCOMING_NODES = [
  note(42, [0, existingBodyBottom + BODY_GAP_PX], [400, 200], 'Agent node')
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
