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

// settle closes the turn for both endings: the server's done event and a local
// abort (socket drop / superseded turn) — the settled message looks the same.
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
  // v1 tool events carry no id; callId is synthesized by arrival order within the turn.
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
    switch (event.type) {
      case 'agent_thinking':
        // v1 thinking is never persisted server-side; storing it locally would diverge
        // from GET /messages on reload, so raise the transient chip only, no stored part.
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
        break
      }
      case 'agent_message_delta':
        message.thinking = false
        gotText = true
        ;(openText ?? openNewText()).text += event.data.delta
        break
      case 'agent_message_done':
        // settle emits its own snapshot; return so this event does not emit again below.
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
    message.streaming = false
    emit(snapshotMessage(message))
  }

  return { ingest, settle }
}
