import type { AgentPendingAskUser } from '@comfyorg/ingest-types'

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
