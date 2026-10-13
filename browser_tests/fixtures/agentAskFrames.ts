import type {
  AgentPendingAskUser,
  AgentPendingDeleteApproval
} from '@comfyorg/ingest-types'

import type { AgentWsEvent } from '@/workbench/extensions/agent/schemas/agentApiSchema'

interface AskFrameIds {
  thread_id: string
  message_id: string
}

export const ASK_USER_QUESTION = 'Which styles should I try?'

export function askUserQuestionFrame(
  ids: AskFrameIds,
  askId: string
): AgentWsEvent {
  const data = {
    ...ids,
    ask_id: askId,
    kind: 'ask_user',
    prompt: ASK_USER_QUESTION,
    options: [
      { id: 'oil', label: 'Oil painting', description: 'Thick strokes' },
      { id: 'ink', label: 'Ink sketch' },
      { id: 'pixel', label: 'Pixel art' }
    ],
    min_selections: 1,
    max_selections: 2,
    allow_other: true
  } satisfies AgentPendingAskUser & { thread_id: string }
  return { type: 'agent_ask', data }
}

export const DELETE_APPROVAL_PROMPT = 'Delete the 2 nodes you added?'

export function deleteApprovalFrame(
  ids: AskFrameIds,
  askId: string
): AgentWsEvent {
  const data = {
    ...ids,
    ask_id: askId,
    kind: 'delete_approval',
    prompt: DELETE_APPROVAL_PROMPT,
    options: [
      { id: 'delete', label: 'Delete' },
      { id: 'keep', label: 'Keep' }
    ],
    min_selections: 1,
    max_selections: 1,
    allow_other: false,
    context: {
      action: 'delete_nodes',
      nodes: [
        { id: '12', type: 'KSampler', title: 'Hero sampler' },
        { id: '13', type: 'VAEDecode' }
      ]
    }
  } satisfies AgentPendingDeleteApproval & { thread_id: string }
  return { type: 'agent_ask', data }
}
