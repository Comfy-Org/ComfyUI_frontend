import type { ComfyWorkflowJSON } from '@comfyorg/graph-model/workflowSchema'

import type { RecordedGraphOperation } from '@e2e/fixtures/data/agent/agentConversation'
import {
  agentThreadSummary,
  agentUserTranscript
} from '@e2e/fixtures/data/agent/agentThreadList'
import type { AgentWorkflowChatsMock } from '@e2e/fixtures/helpers/agentWorkflowChats'

type WorkflowChats = ConstructorParameters<typeof AgentWorkflowChatsMock>[0]

interface ChatWorkflow {
  id: string
  name: string
  threadId: string
  request: string
}

export const BACKGROUND_TAB_CASE = 'agent-rec-set-widget-existing'
export const FOREGROUND_NAME = 'Unsaved Workflow'
export const BACKGROUND: ChatWorkflow = {
  id: '3c1e5b7a-9d2f-4e8b-a6c4-0f1e2d3c4b5a',
  name: 'Other Study',
  threadId: '7a2b4c6d-8e0f-4a1b-9c3d-5e7f9a1b3c5d',
  request: 'Tidy up the other study'
}
export const BACKGROUND_NODES = [
  { id: 801, title: 'b1', x: 1400 },
  { id: 802, title: 'b2', x: 1700 },
  { id: 803, title: 'b3', x: 2000 }
]

const EMPTY_GRAPH: ComfyWorkflowJSON = {
  last_node_id: 0,
  last_link_id: 0,
  nodes: [],
  links: [],
  groups: [],
  config: {},
  extra: {},
  version: 0.4
}

export function backgroundEdits(): RecordedGraphOperation[] {
  const type = 'EmptyLatentImage'
  return BACKGROUND_NODES.flatMap(({ id, title, x }) => [
    {
      op: 'add_node',
      node_id: id,
      class_type: type,
      pos: [x, 600],
      node: {
        id,
        type,
        pos: [x, 600],
        size: [240, 134],
        flags: {},
        order: 0,
        mode: 0,
        inputs: [],
        outputs: [{ name: 'LATENT', type: 'LATENT', links: [] }],
        properties: {},
        widgets_values: [512, 512, 1]
      }
    },
    { op: 'set_node_field', node_id: id, field: 'title', value: title }
  ])
}

export function backgroundTabChats(
  foreground: Omit<ChatWorkflow, 'name'>
): WorkflowChats {
  const chats = [
    { ...foreground, name: FOREGROUND_NAME, at: '2026-11-02T09:00:00Z' },
    { ...BACKGROUND, at: '2026-11-02T10:00:00Z' }
  ]
  return {
    workflows: chats.map(({ id, name }) => ({
      id,
      name,
      content: EMPTY_GRAPH
    })),
    threads: chats.map(({ id, name, threadId, request, at }) =>
      agentThreadSummary(threadId, `${name} chat`, {
        preview: request,
        workflow_id: id,
        last_message_at: at
      })
    ),
    transcripts: Object.fromEntries(
      chats.map(({ id, threadId, request }) => [
        threadId,
        agentUserTranscript(threadId, id, request)
      ])
    )
  }
}
