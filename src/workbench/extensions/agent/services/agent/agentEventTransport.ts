import type { AgentWsEvent } from '../../schemas/agentApiSchema'

import type {
  AssistantMessage,
  TextPart,
  ThinkingPart,
  ToolPart
} from './agentMessageParts'
import { snapshotMessage } from './agentMessageParts'

export type AgentChatEvent = Extract<
  AgentWsEvent,
  {
    type:
      | 'agent_thinking'
      | 'agent_tool_call'
      | 'agent_message_delta'
      | 'agent_message_done'
      | 'agent_active_tab'
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
  let openThinking: ThinkingPart | null = null
  let openThinkingStartedAt = 0
  let toolCount = 0
  let settled = false
  let lastTabWorkflowId: string | undefined

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

  function closeOpenThinking(): void {
    if (openThinking) {
      openThinking.state = 'done'
      const durationMs = Date.now() - openThinkingStartedAt
      if (durationMs > 0) openThinking.durationMs = durationMs
      openThinking = null
    }
  }

  function openNewThinking(): ThinkingPart {
    const part: ThinkingPart = {
      type: 'thinking',
      text: '',
      state: 'streaming'
    }
    message.parts.push(part)
    openThinking = part
    openThinkingStartedAt = Date.now()
    return part
  }

  function ingest(event: AgentChatEvent): void {
    if (settled) return
    switch (event.type) {
      case 'agent_thinking':
        closeOpenText()
        message.thinking = true
        ;(openThinking ?? openNewThinking()).text += event.data.delta
        message.thinkingText = openThinking?.text
        break
      case 'agent_tool_call': {
        closeOpenText()
        closeOpenThinking()
        message.thinking = false
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
      case 'agent_active_tab': {
        // The agent re-announces the same tab as it keeps working on it, with
        // text and tool calls in between, so the tail of parts is not the test;
        // only a change of tab is worth another link in the transcript.
        if (lastTabWorkflowId === event.data.workflow_id) return
        lastTabWorkflowId = event.data.workflow_id
        closeOpenText()
        message.parts.push({
          type: 'tabLink',
          workflowId: event.data.workflow_id,
          name: event.data.name
        })
        break
      }
      case 'agent_message_delta':
        closeOpenThinking()
        message.thinking = false
        message.thinkingText = undefined
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
    closeOpenThinking()
    message.thinking = false
    message.thinkingText = undefined
    message.streaming = false
    emit(snapshotMessage(message))
  }

  return { ingest, settle }
}
