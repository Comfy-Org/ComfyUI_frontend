import type { AgentWsEvent } from '@/workbench/extensions/agent/schemas/agentApiSchema'

interface TurnIds {
  thread_id: string
  message_id: string
}

export function thinkingDraftFrame(ids: TurnIds, text: string): AgentWsEvent {
  return { type: 'agent_thinking_draft', data: { text, ...ids } }
}

export function thinkingFrame(ids: TurnIds, delta: string): AgentWsEvent {
  return { type: 'agent_thinking', data: { delta, ...ids } }
}
