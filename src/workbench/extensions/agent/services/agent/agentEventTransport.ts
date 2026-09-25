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
      | 'agent_message_draft'
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
type AgentMessageDraftEvent = Extract<
  AgentChatEvent,
  { type: 'agent_message_draft' }
>

export interface CanvasSyncUpdate {
  workflowId: string
  opIds: readonly string[]
}

interface PendingCanvasSync {
  correlation: CanvasSyncUpdate
  timer: ReturnType<typeof setTimeout>
}

export interface AgentEventTransport {
  ingest: (event: AgentChatEvent) => void
  settle: () => void
  /**
   * Called with each applied CRDT update so a pending tool-call part can
   * settle when the workflow and every expected operation identity match.
   */
  notifyCanvasCaughtUp: (update: CanvasSyncUpdate) => void
  /** Whether any tool-call part is currently held pending canvas catch-up. */
  hasPendingCanvasSync: () => boolean
  /**
   * Tears the transport down for a reason other than natural completion
   * (abort, drop, reset, hydrate). Flushes any tool-call parts held pending
   * canvas catch-up to `done` and cancels their `STALE_AFTER_MS` timers, so
   * none can fire later against a `message` object the store has since
   * discarded or replaced with authoritative content under the same id.
   */
  dispose: () => void
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
   * flipping straight to `'done'`, until a correlated canvas update arrives
   * or `STALE_AFTER_MS` elapses, whichever comes first. Uncorrelated tool
   * frames settle immediately. Defaults to never deferring, so a caller with
   * no canvas to catch up on keeps the immediate-done behavior.
   */
  shouldAwaitCanvasSync: () => boolean = () => false
): AgentEventTransport {
  let openText: TextPart | null = null
  // The answer the model is still writing. Provisional: the round's first tool
  // call shows it was narration, and the final answer supersedes it.
  let draft: TextPart | null = null
  let openThinking: ThinkingPart | null = null
  let openThinkingStartedAt = 0
  // Seeded from any tool parts already on `message` (a hydrated pending row
  // restores its tool_calls before this transport exists) so the next live
  // `agent_tool_call` for an already-restored call updates that part in
  // place instead of pushing a duplicate.
  const tools = new Map<string, ToolPart>(
    message.parts
      .filter((part): part is ToolPart => part.type === 'tool')
      .map((part) => [part.callId, part])
  )
  let settled = false
  let lastTabTargetKey: string | undefined
  // Tool parts whose frame reported done but whose displayed state is held at
  // 'streaming' pending canvas catch-up. Each has its own bounded timer so a
  // part that never gets a `notifyCanvasCaughtUp` call still settles.
  const pendingCanvasSync = new Map<ToolPart, PendingCanvasSync>()
  const appliedCanvasUpdates: CanvasSyncUpdate[] = []

  function updateContainsCorrelation(
    update: CanvasSyncUpdate,
    correlation: CanvasSyncUpdate
  ): boolean {
    if (update.workflowId !== correlation.workflowId) return false
    const applied = new Set(update.opIds)
    return correlation.opIds.every((opId) => applied.has(opId))
  }

  function correlationAlreadyApplied(correlation: CanvasSyncUpdate): boolean {
    return appliedCanvasUpdates.some((update) =>
      updateContainsCorrelation(update, correlation)
    )
  }

  function clearPendingCanvasSyncTimer(part: ToolPart): void {
    const pending = pendingCanvasSync.get(part)
    if (pending !== undefined) clearTimeout(pending.timer)
    pendingCanvasSync.delete(part)
  }

  function settlePendingCanvasSync(part: ToolPart): void {
    clearPendingCanvasSyncTimer(part)
    part.state = 'done'
  }

  function flushPendingCanvasSync(): void {
    if (pendingCanvasSync.size === 0) return
    for (const part of pendingCanvasSync.keys()) settlePendingCanvasSync(part)
    emit(snapshotMessage(message))
  }

  function notifyCanvasCaughtUp(update: CanvasSyncUpdate): void {
    appliedCanvasUpdates.push(update)
    let changed = false
    for (const [part, pending] of pendingCanvasSync) {
      if (!updateContainsCorrelation(update, pending.correlation)) continue
      settlePendingCanvasSync(part)
      changed = true
    }
    if (changed) emit(snapshotMessage(message))
  }

  function hasPendingCanvasSync(): boolean {
    return pendingCanvasSync.size > 0
  }

  function dispose(): void {
    flushPendingCanvasSync()
  }

  /**
   * PM-1575: applies a finished tool-call frame's outcome to its part, then
   * decides whether the part's displayed `state` can flip straight to
   * `'done'` or must be held at `'streaming'` pending canvas catch-up (see
   * `shouldAwaitCanvasSync` above). Pulled out of `ingest` so that switch's
   * `agent_tool_call` branch stays a simple call instead of an inline gate.
   *
   * Only a `'success'` outcome can be waited on: it is the only case where a
   * matching `doc_update` might still be in flight. An `'error'` outcome
   * means the tool never mutated anything, so there is no forthcoming canvas
   * change to catch up to -- deferring it anyway just strands the part at the
   * spinner glyph for up to `STALE_AFTER_MS` (30s) instead of showing the
   * failure immediately, and, for a turn whose other tool calls also never
   * touch the canvas, `notifyCanvasCaughtUp` may never fire at all to rescue
   * it early.
   *
   * A successful outcome is deferred only when the server supplied explicit
   * workflow and operation correlation. Read-only and no-op calls omit that
   * correlation and settle immediately without a frontend tool-name policy.
   */
  function resolveToolCallState(
    part: ToolPart,
    status: 'success' | 'error',
    durationMs: number | undefined,
    correlation: CanvasSyncUpdate | undefined
  ): void {
    part.ok = status === 'success'
    part.durationMs = durationMs
    // A duplicate or redelivered terminal frame (e.g. a websocket retry) must
    // not leave a stale timer racing the one this call is about to arm --
    // clearing unconditionally, before either branch below, is what keeps
    // that impossible regardless of which branch runs.
    clearPendingCanvasSyncTimer(part)
    if (
      status === 'success' &&
      correlation !== undefined &&
      shouldAwaitCanvasSync()
    ) {
      if (correlationAlreadyApplied(correlation)) {
        part.state = 'done'
      } else {
        pendingCanvasSync.set(part, {
          correlation,
          timer: setTimeout(() => {
            settlePendingCanvasSync(part)
            emit(snapshotMessage(message))
          }, STALE_AFTER_MS)
        })
      }
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
      const correlation =
        data.workflow_id !== undefined && data.op_ids !== undefined
          ? { workflowId: data.workflow_id, opIds: data.op_ids }
          : undefined
      resolveToolCallState(part, data.status, data.duration_ms, correlation)
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
    dropDraft()
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
    dropDraft()
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

  function dropDraft(): void {
    if (!draft) return
    const stale = draft
    message.parts = message.parts.filter((part) => part !== stale)
    draft = null
  }

  /** Applies one `agent_message_draft` frame: the whole reply so far replaces
   * the last draft, and an empty one withdraws it. */
  function handleMessageDraftEvent(data: AgentMessageDraftEvent['data']): void {
    if (data.text) showDraft(data.text)
    else dropDraft()
  }

  function showDraft(text: string): void {
    closeOpenThinking()
    message.thinking = false
    message.thinkingText = undefined
    if (!draft) {
      closeOpenText()
      draft = { type: 'text', text: '', state: 'streaming' }
      message.parts.push(draft)
    }
    draft.text = text
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
        dropDraft()
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
      case 'agent_message_draft':
        handleMessageDraftEvent(event.data)
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
    dropDraft()
    closeOpenText()
    closeOpenThinking()
    message.thinking = false
    message.thinkingText = undefined
    message.streaming = false
    emit(snapshotMessage(message))
  }

  return { ingest, settle, notifyCanvasCaughtUp, hasPendingCanvasSync, dispose }
}
