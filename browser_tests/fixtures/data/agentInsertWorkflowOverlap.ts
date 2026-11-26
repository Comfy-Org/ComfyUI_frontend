import type { Op, WidgetCatalog } from '@comfyorg/comfy-multi-player'

export const WORKFLOW_ID = 'b3e7d9c1-0000-4000-8000-000000000020'
export const MESSAGE_ID = 'b3e7d9c1-0000-4000-8000-000000000021'
export const THREAD_ID = 'b3e7d9c1-0000-4000-8000-000000000022'

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

export const EXISTING_NODES = [
  note(1, [0, 180], [400, 300], 'Existing node A'),
  note(2, [450, 180], [400, 300], 'Existing node B'),
  note(3, [900, 180], [400, 300], 'Existing node C')
]

export const Z_IMAGE_TEMPLATE_NODES = [
  note(35, [-420, 200], [510, 772], 'Template note'),
  note(57, [130, 200], [400, 470], 'Template sampler'),
  note(9, [570, 200], [780, 660], 'Template save')
]

export const OVERLAP_CATALOG: WidgetCatalog = {
  types: { MarkdownNote: { widget_order: ['text'] } }
}

export const INSERT_TEMPLATE_OPS = [
  {
    op_id: 'agent-insert-workflow-overlap-op-0'.padEnd(32, '0'),
    actor: 'agent:e2e:turn-1',
    base_version: 1,
    stamp: [1, 'agent:e2e:turn-1'],
    op: 'insert_workflow',
    workflow: { nodes: Z_IMAGE_TEMPLATE_NODES, links: [] }
  }
] satisfies Op[]
