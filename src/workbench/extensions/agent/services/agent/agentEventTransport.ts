import type { AgentWsEvent } from '../../schemas/agentApiSchema'

import { STALE_AFTER_MS } from '../../crdt/agentCrdtDocLifecycle'
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

type AgentToolCallEvent = Extract<AgentChatEvent, { type: 'agent_tool_call' }>
type AgentActiveTabEvent = Extract<AgentChatEvent, { type: 'agent_active_tab' }>
type AgentAskEvent = Extract<AgentChatEvent, { type: 'agent_ask' }>
type AgentThinkingEvent = Extract<AgentChatEvent, { type: 'agent_thinking' }>
type AgentAskResolvedEvent = Extract<
  AgentChatEvent,
  { type: 'agent_ask_resolved' }
>
type AgentMessageDeltaEvent = Extract<
  AgentChatEvent,
  { type: 'agent_message_delta' }
>

export interface AgentEventTransport {
  ingest: (event: AgentChatEvent) => void
  settle: () => void
  /**
   * PM-1575: called whenever the bound workflow's CRDT follower applies a
   * fresh doc update, so any tool-call parts this transport held back
   * pending canvas catch-up (see `shouldAwaitCanvasSync` below) can settle to
   * `done`. A no-op when nothing is pending.
   */
  notifyCanvasCaughtUp: () => void
}

export function createAgentEventTransport(
  message: AssistantMessage,
  emit: (m: AssistantMessage) => void,
  /**
   * PM-1575: an `agent_tool_call` frame's own `status` says nothing about
   * whether the effect it describes has actually reached the canvas -- that
   * travels a separate, unrelated CRDT doc_update. When this returns `true`
   * at the moment a tool call reports done, its part's chat-visible `state`
   * is held at `'streaming'` (matching the in-progress icon/label) instead of
   * flipping straight to `'done'`, until `notifyCanvasCaughtUp` is called or
   * `STALE_AFTER_MS` elapses, whichever comes first -- reusing the same
   * bound the CRDT follower's own passive heartbeat uses
   * (`agentCrdtDocLifecycle.ts`), rather than inventing a new one. Defaults
   * to never deferring, so a caller with no canvas to catch up on (or that
   * never wires this up) keeps the immediate-done behavior.
   */
  shouldAwaitCanvasSync: () => boolean = () => false
): AgentEventTransport {
  let openText: TextPart | null = null
  let openThinking: ThinkingPart | null = null
  let openThinkingStartedAt = 0
  const tools = new Map<string, ToolPart>()
  let settled = false
  let lastTabTargetKey: string | undefined
  // Tool parts whose frame reported done but whose displayed state is held at
  // 'streaming' pending canvas catch-up. Each has its own bounded timer so a
  // part that never gets a `notifyCanvasCaughtUp` call still settles.
  const pendingCanvasSync = new Map<ToolPart, ReturnType<typeof setTimeout>>()

  function settlePendingCanvasSync(part: ToolPart): void {
    const timer = pendingCanvasSync.get(part)
    if (timer !== undefined) clearTimeout(timer)
    pendingCanvasSync.delete(part)
    part.state = 'done'
  }

  function notifyCanvasCaughtUp(): void {
    if (pendingCanvasSync.size === 0) return
    for (const part of [...pendingCanvasSync.keys()])
      settlePendingCanvasSync(part)
    emit(snapshotMessage(message))
  }

  /**
   * PM-1575: applies a finished tool-call frame's outcome to its part, then
   * decides whether the part's displayed `state` can flip straight to
   * `'done'` or must be held at `'streaming'` pending canvas catch-up (see
   * `shouldAwaitCanvasSync` above). Pulled out of `ingest` so that switch's
   * `agent_tool_call` branch stays a simple call instead of an inline gate.
   */
  function resolveToolCallState(
    part: ToolPart,
    status: 'success' | 'error',
    durationMs: number | undefined
  ): void {
    part.ok = status === 'success'
    part.durationMs = durationMs
    if (shouldAwaitCanvasSync()) {
      pendingCanvasSync.set(
        part,
        setTimeout(() => {
          settlePendingCanvasSync(part)
          emit(snapshotMessage(message))
        }, STALE_AFTER_MS)
      )
    } else {
      part.state = 'done'
    }
  }

  /**
   * Applies one `agent_tool_call` frame: finds or creates the part it
   * targets, updates its name, and (once the frame reports a terminal
   * status) resolves its displayed state via `resolveToolCallState`. Pulled
   * out of `ingest`'s switch so that case is a single call.
   */
  function handleToolCallEvent(data: AgentToolCallEvent['data']): void {
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
      resolveToolCallState(part, data.status, data.duration_ms)
    }
  }

  /**
   * Applies one `agent_active_tab` frame. The agent re-announces the same
   * tab as it keeps working on it, with text and tool calls in between, so
   * only a change of tab is worth another link in the transcript. Returns
   * `false` when this frame repeats the last-announced tab and was
   * otherwise a no-op, mirroring `ingest`'s early `return` for that case.
   */
  function handleActiveTabEvent(data: AgentActiveTabEvent['data']): boolean {
    const targetKey = `${data.workflow_id}\u0000${data.node_locator_id ?? ''}`
    if (lastTabTargetKey === targetKey) return false
    lastTabTargetKey = targetKey
    closeOpenText()
    closeOpenThinking()
    message.thinking = false
    message.thinkingText = undefined
    message.parts.push({
      type: 'tabLink',
      workflowId: data.workflow_id,
      locatorId: data.node_locator_id,
      name: data.name
    })
    return true
  }

  /**
   * Applies one `agent_ask` frame. Only the `run_approval` kind renders a
   * part; returns `false` for any other kind, mirroring `ingest`'s early
   * `return` for that case.
   */
  function handleAskEvent(data: AgentAskEvent['data']): boolean {
    if (data.kind !== 'run_approval') return false
    closeOpenText()
    closeOpenThinking()
    message.thinking = false
    message.thinkingText = undefined
    const part: RunApprovalPart = {
      type: 'runApproval',
      askId: data.ask_id,
      workflowId: data.context?.workflow_id || undefined,
      workflowName: data.context?.workflow_name || undefined
    }
    message.parts.push(part)
    return true
  }

  /** Applies one `agent_thinking` frame: appends its delta to the open
   * thinking part, opening one first if none is open. */
  function handleThinkingEvent(data: AgentThinkingEvent['data']): void {
    closeOpenText()
    message.thinking = true
    ;(openThinking ?? openNewThinking()).text += data.delta
    message.thinkingText = openThinking?.text
  }

  /** Applies one `agent_ask_resolved` frame: drops the matching run-approval
   * part, since its ask is no longer pending. */
  function handleAskResolvedEvent(data: AgentAskResolvedEvent['data']): void {
    message.parts = message.parts.filter(
      (part) => part.type !== 'runApproval' || part.askId !== data.ask_id
    )
  }

  /** Applies one `agent_message_delta` frame: appends its delta to the open
   * text part, opening one first if none is open. */
  function handleMessageDeltaEvent(data: AgentMessageDeltaEvent['data']): void {
    closeOpenThinking()
    message.thinking = false
    message.thinkingText = undefined
    ;(openText ?? openNewText()).text += data.delta
  }

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

  /**
   * Applies one chat event to `message` by dispatching to the per-type
   * handler above, and reports whether `ingest` should emit a fresh
   * snapshot afterwards. Most event types always want a snapshot; a
   * repeated `agent_active_tab` or a non-`run_approval` `agent_ask` is a
   * no-op (mirroring their handlers' own `false` return), and
   * `agent_message_done` already emits via `settle()` so it says no too.
   */
  function applyChatEvent(event: AgentChatEvent): boolean {
    switch (event.type) {
      case 'agent_thinking':
        handleThinkingEvent(event.data)
        return true
      case 'agent_tool_call':
        closeOpenText()
        closeOpenThinking()
        message.thinking = false
        message.thinkingText = undefined
        handleToolCallEvent(event.data)
        return true
      case 'agent_active_tab':
        return handleActiveTabEvent(event.data)
      case 'agent_ask':
        return handleAskEvent(event.data)
      case 'agent_ask_resolved':
        handleAskResolvedEvent(event.data)
        return true
      case 'agent_message_delta':
        handleMessageDeltaEvent(event.data)
        return true
      case 'agent_message_done':
        settle()
        return false
    }
  }

  function ingest(event: AgentChatEvent): void {
    if (settled) return
    if (applyChatEvent(event)) emit(snapshotMessage(message))
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

  return { ingest, settle, notifyCanvasCaughtUp }
}
