import type { AgentWsEvent } from '../../schemas/agentApiSchema'

import type {
  AssistantMessage,
  RunApprovalPart,
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
      | 'agent_ask'
      | 'agent_ask_resolved'
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
  const tools = new Map<string, ToolPart>()
  let settled = false
  let lastTabTargetKey: string | undefined

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
        let part = tools.get(event.data.tool_call_id)
        if (!part) {
          part = {
            type: 'tool',
            callId: event.data.tool_call_id,
            name: event.data.tool_name,
            state: 'streaming'
          }
          tools.set(event.data.tool_call_id, part)
          message.parts.push(part)
        }
        part.name = event.data.tool_name
        if (event.data.status !== 'running') {
          part.state = 'done'
          part.ok = event.data.status === 'success'
          part.durationMs = event.data.duration_ms
        }
        break
      }
      case 'agent_active_tab': {
        // The agent re-announces the same tab as it keeps working on it, with
        // text and tool calls in between, so the tail of parts is not the test;
        // only a change of tab is worth another link in the transcript.
        const targetKey = `${event.data.workflow_id}\u0000${event.data.node_locator_id ?? ''}`
        if (lastTabTargetKey === targetKey) return
        lastTabTargetKey = targetKey
        closeOpenText()
        closeOpenThinking()
        message.thinking = false
        message.thinkingText = undefined
        message.parts.push({
          type: 'tabLink',
          workflowId: event.data.workflow_id,
          locatorId: event.data.node_locator_id,
          name: event.data.name
        })
        break
      }
      case 'agent_ask': {
        if (
          event.data.kind !== 'run_approval' ||
          !event.data.context?.workflow_id ||
          !event.data.context.workflow_name
        )
          return
        closeOpenText()
        closeOpenThinking()
        message.thinking = false
        message.thinkingText = undefined
        const part: RunApprovalPart = {
          type: 'runApproval',
          askId: event.data.ask_id,
          workflowId: event.data.context.workflow_id,
          workflowName: event.data.context.workflow_name
        }
        message.parts.push(part)
        break
      }
      case 'agent_ask_resolved':
        message.parts = message.parts.filter(
          (part) =>
            part.type !== 'runApproval' || part.askId !== event.data.ask_id
        )
        break
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
