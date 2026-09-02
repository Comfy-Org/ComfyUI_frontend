import type { AgentMessages, TurnId } from '../../schemas/agentApiSchema'
import type { AssistantMessage } from './agentMessageParts'
import { createAssistantMessage } from './agentMessageParts'

export interface NormalizedAgentTranscript {
  messages: AssistantMessage[]
  userTexts: Map<TurnId, string>
  rowIds: Set<string>
  assistantTurnIds: Set<TurnId>
}

type TranscriptEntry =
  | { role: 'user'; text: string }
  | { role: 'assistant'; parts: AssistantMessage['parts'] }

export function buildTranscriptMarkdown(
  entries: readonly TranscriptEntry[],
  labels: { user: string; assistant: string }
): string {
  return entries
    .map((entry) => {
      if (entry.role === 'user') return `**${labels.user}:** ${entry.text}`
      const text = entry.parts
        .filter((part) => part.type === 'text')
        .map((part) => part.text)
        .join('')
      return `**${labels.assistant}:** ${text}`
    })
    .join('\n\n')
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
