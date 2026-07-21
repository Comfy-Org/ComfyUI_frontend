import type { AgentWsEvent } from '../../schemas/agentApiSchema'

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
  settle: () => void
}

export function createAgentEventTransport(
  message: AssistantMessage,
  emit: (m: AssistantMessage) => void
): AgentEventTransport {
  let openText: TextPart | null = null
  let gotText = false
  let toolCount = 0
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
    if (settled) return
    switch (event.type) {
      case 'agent_thinking':
        if (!gotText) message.thinking = true
        message.thinkingText = (message.thinkingText ?? '') + event.data.delta
        break
      case 'agent_tool_call': {
        closeOpenText()
        message.thinkingText = undefined
        const part: ToolPart = {
          type: 'tool',
          callId: `tool_${toolCount++}`,
          name: event.data.tool_name,
          state: 'done',
          ok: event.data.status === 'ok',
          durationMs: event.data.duration_ms
        }
        message.parts.push(part)
        break
      }
      case 'agent_message_delta':
        message.thinking = false
        message.thinkingText = undefined
        gotText = true
        ;(openText ?? openNewText()).text += event.data.delta
        break
      case 'agent_message_done':
        settle()
        return
    }
    emit(snapshotMessage(message))
  }

  function settle(): void {
    if (settled) return
    settled = true
    closeOpenText()
    message.thinking = false
    message.thinkingText = undefined
    message.streaming = false
    emit(snapshotMessage(message))
  }

  return { ingest, settle }
}
