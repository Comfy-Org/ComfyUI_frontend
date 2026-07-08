import type { AgentWsEvent, TokenUsage } from '../../schemas/agentApiSchema'

import type { AssistantMessage, TextPart, ToolPart } from './agentMessageParts'
import { snapshotMessage } from './agentMessageParts'

export type AgentChatEvent = Extract<
  AgentWsEvent,
  {
    type:
      | 'agent_thinking'
      | 'agent_tool_call'
      | 'agent_message_delta'
      | 'agent_message_done'
  }
>

export interface AgentEventTransport {
  ingest: (event: AgentChatEvent) => void
  finalize: (usage: TokenUsage | null) => void
  abort: () => void
}

export function createAgentEventTransport(
  message: AssistantMessage,
  emit: (m: AssistantMessage) => void
): AgentEventTransport {
  let openText: TextPart | null = null
  let gotText = false
  // v1 tool events carry no id; callId is synthesized by arrival order within the turn.
  let toolCount = 0
  const tools: ToolPart[] = []
  let settled = false

  function closeOpenText(): void {
    if (openText) {
      openText.state = 'done'
      openText = null
    }
  }

  function openNewText(): TextPart {
    const part: TextPart = { type: 'text', text: '', state: 'streaming' }
    message.parts.push(part)
    openText = part
    return part
  }

  function ingest(event: AgentChatEvent): void {
    switch (event.type) {
      case 'agent_thinking':
        // v1 thinking is never persisted server-side; storing it locally would diverge
        // from GET /messages on reload, so raise the transient chip only, no ReasoningPart.
        if (!gotText) message.thinking = true
        break
      case 'agent_tool_call': {
        closeOpenText()
        const part: ToolPart = {
          type: 'tool',
          callId: `tool_${toolCount++}`,
          name: event.data.tool_name,
          state: 'done',
          ok: event.data.status === 'ok'
        }
        message.parts.push(part)
        tools.push(part)
        break
      }
      case 'agent_message_delta':
        message.thinking = false
        gotText = true
        ;(openText ?? openNewText()).text += event.data.delta
        break
      case 'agent_message_done':
        // finalize emits its own snapshot; return so this event does not emit again below.
        finalize(event.data.usage)
        return
    }
    emit(snapshotMessage(message))
  }

  // A cancelled turn sends null usage, leaving the running token count intact.
  function finalize(usage: TokenUsage | null): void {
    if (settled) return
    settled = true
    closeOpenText()
    for (const tool of tools) {
      if (tool.ok === undefined) tool.ok = true
      tool.state = 'done'
    }
    message.thinking = false
    message.streaming = false
    message.tokens = usage?.total_tokens ?? message.tokens
    emit(snapshotMessage(message))
  }

  function abort(): void {
    if (settled) return
    settled = true
    closeOpenText()
    message.thinking = false
    message.streaming = false
    emit(snapshotMessage(message))
  }

  return { ingest, finalize, abort }
}
