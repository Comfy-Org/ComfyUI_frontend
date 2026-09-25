import type { AgentWsEvent } from '../../schemas/agentApiSchema'

import type {
  AssistantMessage,
  TextPart,
  ThinkingPart,
  ToolPart
} from './agentMessageParts'
import {
  isAskPart,
  snapshotMessage,
  toAskOrNoticePart
} from './agentMessageParts'

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

  type EventData<T extends AgentChatEvent['type']> = Extract<
    AgentChatEvent,
    { type: T }
  >['data']

  /** Closes the open text and reasoning before a new kind of part begins. */
  function closeStreamingParts(): void {
    closeOpenText()
    closeOpenThinking()
    message.thinking = false
    message.thinkingText = undefined
  }

  function appendThinking(delta: string): boolean {
    closeOpenText()
    message.thinking = true
    ;(openThinking ?? openNewThinking()).text += delta
    message.thinkingText = openThinking?.text
    return true
  }

  function applyToolCall(data: EventData<'agent_tool_call'>): boolean {
    closeStreamingParts()
    let part = tools.get(data.tool_call_id)
    if (!part) {
      part = {
        type: 'tool',
        callId: data.tool_call_id,
        name: data.tool_name,
        state: 'streaming'
      }
      tools.set(data.tool_call_id, part)
      message.parts.push(part)
    }
    part.name = data.tool_name
    if (data.status !== 'running') {
      part.state = 'done'
      part.ok = data.status === 'success'
      part.durationMs = data.duration_ms
    }
    return true
  }

  function applyActiveTab(data: EventData<'agent_active_tab'>): boolean {
    // The agent re-announces the same tab as it keeps working on it, with
    // text and tool calls in between, so the tail of parts is not the test;
    // only a change of tab is worth another link in the transcript.
    const targetKey = `${data.workflow_id}\u0000${data.node_locator_id ?? ''}`
    if (lastTabTargetKey === targetKey) return false
    lastTabTargetKey = targetKey
    closeStreamingParts()
    message.parts.push({
      type: 'tabLink',
      workflowId: data.workflow_id,
      locatorId: data.node_locator_id,
      name: data.name
    })
    return true
  }

  function applyAsk(data: EventData<'agent_ask'>): boolean {
    // A redelivered ask (a replay, a resubscribe) is already on screen, and
    // a second card would share its key and its in-progress answer.
    const shown = message.parts.some(
      (part) =>
        (isAskPart(part) || part.type === 'notice') &&
        part.askId === data.ask_id
    )
    if (shown) return false
    closeStreamingParts()
    message.parts.push(toAskOrNoticePart(data))
    return true
  }

  function dropResolvedAsk(askId: string): boolean {
    message.parts = message.parts.filter(
      (part) =>
        !(isAskPart(part) || part.type === 'notice') || part.askId !== askId
    )
    return true
  }

  function appendText(delta: string): boolean {
    closeOpenThinking()
    message.thinking = false
    message.thinkingText = undefined
    ;(openText ?? openNewText()).text += delta
    return true
  }

  /** Applies one event; true when the message changed and should be emitted. */
  function apply(event: AgentChatEvent): boolean {
    switch (event.type) {
      case 'agent_thinking':
        return appendThinking(event.data.delta)
      case 'agent_tool_call':
        return applyToolCall(event.data)
      case 'agent_active_tab':
        return applyActiveTab(event.data)
      case 'agent_ask':
        return applyAsk(event.data)
      case 'agent_ask_resolved':
        return dropResolvedAsk(event.data.ask_id)
      case 'agent_message_delta':
        return appendText(event.data.delta)
      case 'agent_message_done':
        settle()
        return false
    }
  }

  function ingest(event: AgentChatEvent): void {
    if (settled) return
    if (apply(event)) emit(snapshotMessage(message))
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
