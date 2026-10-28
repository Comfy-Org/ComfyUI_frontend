import type {
  AgentAskFrame,
  AgentAskResolvedData,
  AgentAskResolvedFrame,
  AgentPendingAskUser
} from '@comfyorg/ingest-types'

import type { AgentWsEvent } from '@/workbench/extensions/agent/schemas/agentApiSchema'

export const ASK_WORKFLOW_ID = 'b4d7e1f2-8a3c-4d5e-9f60-7a1b2c3d4e5f'
const ASK_THREAD_ID = 'd8c7b6a5-9e1f-4a2b-8c3d-4e5f6a7b8c9d'
const ASK_MESSAGE_ID = '1e2d3c4b-5a69-4788-9a7b-6c5d4e3f2a1b'
export const RUN_ASK_ID = askIdFor('call-run')
export const ASK_USER_QUESTION = 'Which styles should I try?'
export const DELETE_APPROVAL_PROMPT = 'Delete the 2 nodes you added?'

export const askTurnIds = {
  thread_id: ASK_THREAD_ID,
  message_id: ASK_MESSAGE_ID
}

export function askIdFor(call: string): string {
  return `${ASK_MESSAGE_ID}:${call}`
}

export function answerPath(askId: string): string {
  return `/api/agent/threads/${ASK_THREAD_ID}/asks/${askId}/answer`
}

export function runApprovalAsk(): AgentAskFrame {
  return {
    type: 'agent_ask',
    data: {
      ...askTurnIds,
      ask_id: RUN_ASK_ID,
      kind: 'run_approval',
      context: {
        workflow_id: ASK_WORKFLOW_ID,
        workflow_name: 'Unsaved Workflow'
      },
      prompt: 'Run workflow “Unsaved Workflow”?',
      options: [
        { id: 'run', label: 'Run' },
        { id: 'cancel', label: 'Cancel' }
      ],
      min_selections: 1,
      max_selections: 1,
      allow_other: false
    }
  }
}

export function askResolved(
  selected: string[],
  askId = RUN_ASK_ID,
  outcome: Partial<Pick<AgentAskResolvedData, 'other_text'>> = {}
): AgentAskResolvedFrame {
  return {
    type: 'agent_ask_resolved',
    data: {
      ...askTurnIds,
      ask_id: askId,
      status: 'answered',
      selected,
      ...outcome
    }
  }
}

export function askCancelled(askId: string): AgentAskResolvedFrame {
  return {
    type: 'agent_ask_resolved',
    data: { ...askTurnIds, ask_id: askId, status: 'cancelled', selected: null }
  }
}

export function askExpired(askId = RUN_ASK_ID): AgentAskResolvedFrame {
  return {
    type: 'agent_ask_resolved',
    data: { ...askTurnIds, ask_id: askId, status: 'expired', selected: null }
  }
}

export function toolCall(
  name: string,
  status: 'running' | 'success'
): AgentWsEvent {
  return {
    type: 'agent_tool_call',
    data: {
      tool_call_id: `call-${name}`,
      tool_name: name,
      status,
      ...(status === 'success' && { duration_ms: 1200 }),
      ...askTurnIds
    }
  }
}

export function askUserQuestionFrame(
  askId: string,
  ask: Partial<
    Pick<
      AgentPendingAskUser,
      'prompt' | 'options' | 'min_selections' | 'max_selections' | 'allow_other'
    >
  > = {}
): AgentAskFrame {
  return {
    type: 'agent_ask',
    data: {
      ...askTurnIds,
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
      allow_other: true,
      ...ask
    }
  }
}

export function singleChoiceQuestionFrame(
  askId: string,
  prompt: string
): AgentAskFrame {
  return askUserQuestionFrame(askId, {
    prompt,
    min_selections: 1,
    max_selections: 1,
    allow_other: false
  })
}

export function pausedAskFrame(askId: string): AgentAskFrame {
  return {
    type: 'agent_ask',
    data: {
      ...askTurnIds,
      ask_id: askId,
      kind: 'paused',
      context: {
        message: 'Paused until credits are added.',
        reason: 'no_funds',
        recheck_after_seconds: 60
      },
      prompt: 'Paused until credits are added.',
      options: [{ id: 'resume', label: 'Resume' }],
      min_selections: 1,
      max_selections: 1,
      allow_other: false
    }
  }
}

export function deleteApprovalFrame(askId: string): AgentAskFrame {
  return {
    type: 'agent_ask',
    data: {
      ...askTurnIds,
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
    }
  }
}
