import type {
  AgentMessage,
  AgentThreadListResponse,
  ListAssetsResponse
} from '@comfyorg/ingest-types'

import type { ComfyWorkflowJSON } from '@comfyorg/graph-model/workflowSchema'

const STARTED_AT = '2026-09-11T10:00:00Z'
const TURN_ID = '7e1d0b5f-3c2a-4d4e-9f8a-7b6c5d4e3f2a'

export const FOX_CHAT = {
  id: '5d0c9a4e-2b1f-4c3d-8e7f-6a5b4c3d2e1f',
  title: 'Fox portrait',
  request: 'Make a portrait of a fox in the snow',
  reply: 'The fox portrait workflow is ready to run.'
}

export const POSTER_CHAT = {
  id: '6e1d0b5f-3c2a-4d4e-9f8a-7b6c5d4e3f2b',
  title: 'Concert poster'
}

export const EMPTY_AGENT_THREADS: AgentThreadListResponse = {
  threads: [],
  pagination: { offset: 0, limit: 100, total: 0, has_more: false }
}

export const AGENT_THREADS: AgentThreadListResponse = {
  threads: [
    {
      id: FOX_CHAT.id,
      title: FOX_CHAT.title,
      preview: FOX_CHAT.request,
      workflow_id: '',
      status: 'active',
      message_count: 2,
      created_at: STARTED_AT,
      updated_at: STARTED_AT,
      last_message_at: STARTED_AT
    },
    {
      id: POSTER_CHAT.id,
      title: POSTER_CHAT.title,
      preview: 'Lay out a poster for the autumn concert',
      workflow_id: '',
      status: 'active',
      message_count: 2,
      created_at: STARTED_AT,
      updated_at: STARTED_AT,
      last_message_at: STARTED_AT
    }
  ],
  pagination: { offset: 0, limit: 100, total: 2, has_more: false }
}

export const FOX_TRANSCRIPT: AgentMessage[] = [
  {
    id: 'fox-user',
    thread_id: FOX_CHAT.id,
    turn_id: TURN_ID,
    seq: 1,
    role: 'user',
    status: 'complete',
    content: { text: FOX_CHAT.request }
  },
  {
    id: TURN_ID,
    thread_id: FOX_CHAT.id,
    turn_id: TURN_ID,
    seq: 2,
    role: 'assistant',
    status: 'complete',
    content: { text: FOX_CHAT.reply }
  }
]

const EMPTY_GRAPH: ComfyWorkflowJSON = {
  last_node_id: 0,
  last_link_id: 0,
  nodes: [],
  links: [],
  version: 0.4
}

export const SAVED_WORKFLOW_NAME = 'Fox portrait'
export const SAVED_APP_NAME = 'Poster maker'

export const AGENT_SAVED_WORKFLOWS: Record<string, ComfyWorkflowJSON> = {
  [`workflows/${SAVED_WORKFLOW_NAME}.json`]: EMPTY_GRAPH,
  [`workflows/${SAVED_APP_NAME}.app.json`]: EMPTY_GRAPH
}

export const RECENT_OUTPUT_NAME = 'fox_portrait_00001.png'

export const AGENT_RECENT_OUTPUTS: ListAssetsResponse = {
  assets: [
    {
      id: '33333333-3333-4333-a333-333333333333',
      name: RECENT_OUTPUT_NAME,
      hash: 'blake3:3333333333333333333333333333333333333333333333333333333333333333',
      size: 4_194_304,
      mime_type: 'image/png',
      tags: ['output'],
      created_at: '2026-09-18T00:00:00.000Z',
      updated_at: '2026-09-18T00:00:00.000Z',
      last_access_time: '2026-09-18T00:00:00.000Z'
    },
    {
      id: '44444444-4444-4444-a444-444444444444',
      name: 'fox_portrait_00002.png',
      hash: 'blake3:4444444444444444444444444444444444444444444444444444444444444444',
      size: 4_194_304,
      mime_type: 'image/png',
      tags: ['output'],
      created_at: '2026-09-17T00:00:00.000Z',
      updated_at: '2026-09-17T00:00:00.000Z',
      last_access_time: '2026-09-17T00:00:00.000Z'
    }
  ],
  total: 2,
  has_more: false
}
