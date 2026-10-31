import type { Op, WidgetCatalog } from '@comfyorg/comfy-multi-player'

export const STAGE_FRAMES_WORKFLOW_ID = 'b3e7d9c1-0000-4000-8000-000000000947'
export const STAGE_FRAMES_MESSAGE_ID = 'b3e7d9c1-0000-4000-8000-000000000948'
export const STAGE_FRAMES_THREAD_ID = 'b3e7d9c1-0000-4000-8000-000000000949'
export const STAGE_FRAMES_SAVED_NAME = 'PM-947 stage frames'

function note(id: number, pos: [number, number], text: string) {
  return {
    id,
    type: 'MarkdownNote',
    pos,
    size: [320, 200],
    mode: 0,
    order: 0,
    flags: {},
    inputs: [],
    outputs: [],
    properties: {},
    widgets_values: [text]
  }
}

export const STAGE_FRAMES_EXISTING_NODES = [note(1, [0, 0], 'Existing node')]

export const STAGE_FRAMES_TEMPLATE = {
  nodes: [
    note(11, [0, 100], 'Load image'),
    note(12, [380, 100], 'Describe image'),
    note(21, [860, 100], 'Prompt from description'),
    note(22, [1240, 100], 'Generate image')
  ],
  links: [],
  groups: [
    {
      id: 1,
      title: 'Stage 1: describe the input image',
      bounding: [-20, 20, 740, 300],
      color: '#3f789e',
      font_size: 24,
      flags: {}
    },
    {
      id: 2,
      title: 'Stage 2: generate from the description',
      bounding: [840, 20, 740, 300],
      color: '#b58b2a',
      font_size: 24,
      flags: {}
    }
  ]
}

export const STAGE_FRAME_TITLES = STAGE_FRAMES_TEMPLATE.groups
  .map(({ title }) => title)
  .sort()

export const STAGE_FRAMES_CATALOG: WidgetCatalog = {
  types: { MarkdownNote: { widget_order: ['text'] } }
}

export const STAGE_FRAMES_INSERT_OPS = [
  {
    op_id: 'agent-stage-frames-insert-op-0'.padEnd(32, '0'),
    actor: 'agent:e2e:turn-1',
    base_version: 1,
    stamp: [1, 'agent:e2e:turn-1'],
    op: 'insert_workflow',
    workflow: STAGE_FRAMES_TEMPLATE
  }
] satisfies Op[]
