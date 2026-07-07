import type { AgentWsEvent, TokenUsage } from '../../schemas/agentApiSchema'

import type { AssistantMessage, TextPart, ToolPart } from './agentMessageParts'
import { snapshotMessage } from './agentMessageParts'

/**
 * agentEventTransport: folds one turn's chat-scoped v1 WebSocket events into an
 * AssistantMessage's part list.
 *
 * It consumes only the four chat events (agent_thinking, agent_tool_call,
 * agent_message_delta, agent_message_done); draft_patch / draft_version route to
 * the draft store, not here. Each applied event emits a fresh message snapshot so
 * the store's ref assignment trips Vue reactivity (an emit-per-frame contract).
 */

// The chat-scoped subset of the v1 event union, derived from the schema so the wire
// shapes are never redeclared here.
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
  // The currently-open text part, or null between blocks. v1 has no separate text
  // lifecycle events, so a delta opens a part and the next tool (or finalize) closes it.
  let openText: TextPart | null = null
  // Whether any text has streamed this turn. Gates ONLY the thinking chip: a thinking
  // phase AFTER text must not re-flip the chip.
  let gotText = false
  // Synthesized-callId counter; v1 tool events carry no id, so cards are keyed by
  // arrival order ('tool_0', 'tool_1', ...) unique within this turn.
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
        // Only raise the chip while no text has streamed yet. Do NOT create a
        // ReasoningPart: v1 thinking is transient and never persisted server-side, so
        // persisting it locally would diverge from GET /messages on reload. Narration
        // arrives in data.delta and is intentionally not stored; a future UX pass may
        // surface it live.
        if (!gotText) message.thinking = true
        break
      case 'agent_tool_call': {
        // Close any open text so a tool between text blocks splits them (keeps
        // ToolCallGroup grouping correct). v1 tool events arrive once, post-completion,
        // so cards are born settled ('done').
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
        // Text is arriving: drop the chip and append to the open text part (opening
        // one if a delta arrives with none).
        message.thinking = false
        gotText = true
        ;(openText ?? openNewText()).text += event.data.delta
        break
      case 'agent_message_done':
        // The store may end a turn via this event or by calling finalize directly;
        // both land in finalize, which emits its own snapshot. Return so this event
        // does not also emit below.
        finalize(event.data.usage)
        return
    }
    emit(snapshotMessage(message))
  }

  // Turn complete: close open text, defensively settle any unsettled tool so no spinner
  // outlives the turn, drop the chip, clear streaming, adopt the turn's total_tokens (a
  // cancelled turn sends null usage, leaving the running count intact).
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

  // Socket drop mid-turn: close open text, drop the chip, clear streaming. Settles
  // exactly once, like finalize.
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
