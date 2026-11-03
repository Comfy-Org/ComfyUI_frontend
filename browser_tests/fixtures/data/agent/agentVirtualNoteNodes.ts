import type { GraphOperation } from '@/workbench/extensions/agent/crdt/graphOperations'

import type { RecordedGraphOperation } from '@e2e/fixtures/data/agent/agentConversation'

export const NOTE_ID = 9001
export const MARKDOWN_ID = 9002
export const NOTE_TEXT = 'agent note text'
export const MARKDOWN_HEADING = 'Agent markdown heading'
export const MARKDOWN_BODY = 'markdown body line'
export const MARKDOWN_TEXT = `# ${MARKDOWN_HEADING}\n\n${MARKDOWN_BODY}`
export const SAVED_NAME = 'Virtual note nodes'
export const SERVED_NOTE_TEXT = 'served note text'
export const SERVED_MARKDOWN_HEADING = 'Served markdown heading'

function addVirtualNode(
  id: number,
  type: 'Note' | 'MarkdownNote',
  pos: [number, number],
  text: string
): Extract<GraphOperation, { op: 'add_node' }> {
  return {
    op: 'add_node',
    node_id: id,
    class_type: type,
    pos,
    node: {
      id,
      type,
      pos,
      size: [320, 180],
      mode: 0,
      flags: {},
      order: 0,
      inputs: [],
      outputs: [],
      properties: {},
      widgets_values: [text]
    }
  }
}

export const VIRTUAL_NODE_ADDS: RecordedGraphOperation[] = [
  addVirtualNode(NOTE_ID, 'Note', [1400, 100], NOTE_TEXT),
  addVirtualNode(MARKDOWN_ID, 'MarkdownNote', [1400, 400], MARKDOWN_TEXT)
]
