/**
 * Agent chat session state (prototype — ADR-0011).
 *
 * Immer-backed reducer for the *local, single-client* chat surface: streaming
 * message deltas, tool-call lifecycle, run status. This is deliberately not a
 * CRDT — chat is owned by one browser tab, so structural-sharing immutable
 * updates (Immer) are the right tool. Graph state lives in the Yjs room layer
 * (`../crdt`); the two never mix.
 */
import { produce } from 'immer'

import type { AgentEvent, MessageId, ThreadId } from '../common/agentProtocol'

interface ToolCallView {
  id: string
  name: string
  status: 'running' | 'success' | 'error'
  durationMs?: number
  errorCode?: string
}

interface ChatMessage {
  id: MessageId
  role: 'user' | 'agent'
  content: string
  streaming: boolean
  toolCalls: ToolCallView[]
}

export interface SessionState {
  threadId: ThreadId
  messages: ChatMessage[]
  status: 'idle' | 'streaming' | 'error'
}

export type SessionAction =
  | { type: 'user-send'; id: MessageId; content: string }
  | { type: 'agent-event'; event: AgentEvent }

export function createSessionState(threadId: ThreadId): SessionState {
  return { threadId, messages: [], status: 'idle' }
}

function ensureAgentMessage(state: SessionState, id: MessageId): ChatMessage {
  const existing = state.messages.find((m) => m.id === id)
  if (existing) return existing
  const created: ChatMessage = {
    id,
    role: 'agent',
    content: '',
    streaming: true,
    toolCalls: []
  }
  state.messages.push(created)
  return created
}

function applyAgentEvent(state: SessionState, event: AgentEvent): void {
  switch (event.type) {
    case 'agent_message_delta': {
      const message = ensureAgentMessage(state, event.messageId)
      message.content += event.delta
      message.streaming = true
      state.status = 'streaming'
      return
    }
    case 'agent_tool_call': {
      const message = ensureAgentMessage(state, event.messageId)
      const existing = message.toolCalls.find((t) => t.id === event.toolCallId)
      const view: ToolCallView = {
        id: event.toolCallId,
        name: event.toolName,
        status: event.status,
        durationMs: event.durationMs,
        errorCode: event.errorCode
      }
      if (existing) Object.assign(existing, view)
      else message.toolCalls.push(view)
      if (event.status === 'error') state.status = 'error'
      return
    }
    case 'agent_message_done': {
      const message = ensureAgentMessage(state, event.messageId)
      message.streaming = false
      if (state.status !== 'error') state.status = 'idle'
      return
    }
    case 'draft_patch':
      return
  }
}

export function sessionReducer(
  state: SessionState,
  action: SessionAction
): SessionState {
  return produce(state, (draft) => {
    if (action.type === 'user-send') {
      draft.messages.push({
        id: action.id,
        role: 'user',
        content: action.content,
        streaming: false,
        toolCalls: []
      })
      return
    }
    applyAgentEvent(draft, action.event)
  })
}
