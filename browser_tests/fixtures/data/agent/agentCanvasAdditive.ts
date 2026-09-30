import type { RecordedGraphOperation } from '@e2e/fixtures/data/agent/agentConversation'

export const ADDITIVE_CANVAS_CASE = 'agent-rec-text-only-answer'
export const ADDITIVE_READINESS_NODE_ID = '6'
export const ADDITIVE_READINESS_WIDGET = 'text'
export const USER_NOTE_POSITION: [number, number] = [1500, 700]
export const USER_NOTE_TEXT = 'do not lose me'

export const INSERT_WORKFLOW: RecordedGraphOperation = {
  op: 'insert_workflow',
  workflow: {
    nodes: [
      {
        id: 880001,
        type: 'EmptyLatentImage',
        pos: [1900, 200],
        size: [270, 106],
        mode: 0,
        flags: {},
        order: 0,
        inputs: [],
        outputs: [{ name: 'LATENT', type: 'LATENT', links: [] }],
        properties: {},
        widgets_values: [512, 512, 1]
      }
    ],
    links: []
  }
}

export const AGENT_BUILD: RecordedGraphOperation[] = [512, 768].map(
  (width, index) => ({
    op: 'add_node',
    node_id: 990001 + index,
    class_type: 'EmptyLatentImage',
    pos: [2200 + index * 320, 200],
    node: {
      id: 990001 + index,
      type: 'EmptyLatentImage',
      pos: [2200 + index * 320, 200],
      size: [270, 106],
      mode: 0,
      flags: {},
      order: 0,
      inputs: [],
      outputs: [{ name: 'LATENT', type: 'LATENT', links: [] }],
      properties: {},
      widgets_values: [width, 512, 1]
    }
  })
)
