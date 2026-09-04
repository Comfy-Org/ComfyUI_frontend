import type { AgentMessages, TurnId } from '../../schemas/agentApiSchema'
import type { AssistantMessage } from './agentMessageParts'
import { createAssistantMessage } from './agentMessageParts'

export interface NormalizedAgentTranscript {
  /** Includes placeholders for turns without assistant text. */
  messages: AssistantMessage[]
  userTexts: Map<TurnId, string>
  rowIds: Set<string>
  /** Tracks turns with assistant rows, including rows that produce no parts. */
  assistantTurnIds: Set<TurnId>
}

export function normalizeAgentTranscript(
  history: AgentMessages
): NormalizedAgentTranscript {
  const userTexts = new Map<TurnId, string>()
  const assistants = new Map<TurnId, AssistantMessage>()
  const turnOrder: TurnId[] = []
  const seenTurns = new Set<TurnId>()
  const rowIds = new Set<string>()

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
      assistants.set(turnId, message)
    }
  }

  const messages = turnOrder.map((turnId) => {
    const message = assistants.get(turnId) ?? createAssistantMessage(turnId)
    message.streaming = false
    return message
  })

  return {
    messages,
    userTexts,
    rowIds,
    assistantTurnIds: new Set(assistants.keys())
  }
}
