import type { ComfyWorkflowJSON } from '@/platform/workflow/validation/schemas/workflowSchema'

import {
  agentThreadSummary,
  agentUserTranscript
} from '@e2e/fixtures/data/agent/agentThreadList'

const PORTRAIT_WORKFLOW_ID = 'f0e1d2c3-4b5a-4968-8776-5a4b3c2d1e0f'
const LANDSCAPE_WORKFLOW_ID = 'b2c3d4e5-6f70-4812-9a3b-4c5d6e7f8a9b'
const UNRESTORABLE_WORKFLOW_ID = 'd3e4f5a6-7b80-4923-ab4c-5d6e7f8a9b0c'
const PORTRAIT_THREAD_ID = 'c4a7e2d1-5b3f-4e6a-9c8d-1f2a3b4c5d6e'
const LANDSCAPE_THREAD_ID = 'e1f2a3b4-6c5d-4e7f-8a9b-0c1d2e3f4a5b'
const UNBOUND_THREAD_ID = 'a1b2c3d4-7e8f-4901-8b2c-3d4e5f6a7b8c'
export const UNRESTORABLE_THREAD_ID = 'f2a3b4c5-7d6e-4f80-9a1b-2c3d4e5f6a7b'

export const PORTRAIT_NAME = 'Portrait Study'
export const LANDSCAPE_NAME = 'Landscape Study'
export const PORTRAIT_REQUEST = 'Tidy up the portrait study'
export const LANDSCAPE_REQUEST = 'Widen the landscape study'
export const UNBOUND_REQUEST = 'What does a KSampler do?'
const UNRESTORABLE_REQUEST = 'Continue the missing workflow'
export const LANDSCAPE_DRAFT = 'Now add a sunset'

export const tabActivationTranscriptReads = [
  PORTRAIT_THREAD_ID,
  LANDSCAPE_THREAD_ID,
  PORTRAIT_THREAD_ID,
  UNBOUND_THREAD_ID,
  LANDSCAPE_THREAD_ID
]

const EMPTY_WORKFLOW: ComfyWorkflowJSON = {
  last_node_id: 0,
  last_link_id: 0,
  nodes: [],
  links: [],
  groups: [],
  config: {},
  extra: {},
  version: 0.4
}

export const tabActivationChats = {
  workflows: [
    {
      id: PORTRAIT_WORKFLOW_ID,
      name: PORTRAIT_NAME,
      content: EMPTY_WORKFLOW
    },
    {
      id: LANDSCAPE_WORKFLOW_ID,
      name: LANDSCAPE_NAME,
      content: EMPTY_WORKFLOW
    },
    {
      id: UNRESTORABLE_WORKFLOW_ID,
      name: 'Missing Study'
    }
  ],
  threads: [
    agentThreadSummary(PORTRAIT_THREAD_ID, 'Portrait chat', {
      preview: PORTRAIT_REQUEST,
      workflow_id: PORTRAIT_WORKFLOW_ID
    }),
    agentThreadSummary(LANDSCAPE_THREAD_ID, 'Landscape chat', {
      preview: LANDSCAPE_REQUEST,
      workflow_id: LANDSCAPE_WORKFLOW_ID
    }),
    agentThreadSummary(UNBOUND_THREAD_ID, 'Unbound chat', {
      preview: UNBOUND_REQUEST
    }),
    agentThreadSummary(UNRESTORABLE_THREAD_ID, 'Missing workflow chat', {
      preview: UNRESTORABLE_REQUEST,
      workflow_id: UNRESTORABLE_WORKFLOW_ID
    })
  ],
  transcripts: {
    [PORTRAIT_THREAD_ID]: agentUserTranscript(
      PORTRAIT_THREAD_ID,
      PORTRAIT_WORKFLOW_ID,
      PORTRAIT_REQUEST
    ),
    [LANDSCAPE_THREAD_ID]: agentUserTranscript(
      LANDSCAPE_THREAD_ID,
      LANDSCAPE_WORKFLOW_ID,
      LANDSCAPE_REQUEST
    ),
    [UNBOUND_THREAD_ID]: agentUserTranscript(
      UNBOUND_THREAD_ID,
      '',
      UNBOUND_REQUEST
    ),
    [UNRESTORABLE_THREAD_ID]: agentUserTranscript(
      UNRESTORABLE_THREAD_ID,
      UNRESTORABLE_WORKFLOW_ID,
      UNRESTORABLE_REQUEST
    )
  }
}
