import type { AgentMessages, TurnId } from '../../schemas/agentApiSchema'
import type { AssistantMessage } from './agentMessageParts'
import { createAssistantMessage } from './agentMessageParts'

export interface NormalizedAgentTranscript {
  messages: AssistantMessage[]
  userTexts: Map<TurnId, string>
  rowIds: Set<string>
  assistantTurnIds: Set<TurnId>
  pending?: {
    messageId: TurnId
    message: AssistantMessage
  }
}

export function normalizeAgentTranscript(
  history: AgentMessages
): NormalizedAgentTranscript {
  const userTexts = new Map<TurnId, string>()
  const assistants = new Map<TurnId, AssistantMessage>()
  const turnOrder: TurnId[] = []
  const seenTurns = new Set<TurnId>()
  const rowIds = new Set<string>()
  let pending: NormalizedAgentTranscript['pending']

  for (const row of [...history].sort((a, b) => a.seq - b.seq)) {
    const turnId = row.turn_id as TurnId
    rowIds.add(row.id)
    if (!seenTurns.has(turnId)) {
      seenTurns.add(turnId)
      turnOrder.push(turnId)
    }
    const text = typeof row.content?.text === 'string' ? row.content.text : ''
    if (row.role === 'user') userTexts.set(turnId, text)
    if (row.role === 'assistant') {
      const message = assistants.get(turnId) ?? createAssistantMessage(turnId)
      message.streaming = false
      if (text)
        message.parts = [
          ...message.parts,
          { type: 'text', text, state: 'done' }
        ]
      if (
        row.status === 'streaming' &&
        row.pending_ask?.kind === 'run_approval'
      ) {
        message.parts.push({
          type: 'runApproval',
          askId: row.pending_ask.ask_id,
          workflowId: row.pending_ask.context?.workflow_id || undefined,
          workflowName: row.pending_ask.context?.workflow_name || undefined
        })
        message.streaming = true
        pending = {
          messageId: row.id as TurnId,
          message
        }
      }
      assistants.set(turnId, message)
    }
  }

  const messages = turnOrder.map((turnId) => {
    const message = assistants.get(turnId) ?? createAssistantMessage(turnId)
    message.streaming = message === pending?.message
    return message
  })

  return {
    messages,
    userTexts,
    rowIds,
    assistantTurnIds: new Set(assistants.keys()),
    pending
  }
}
