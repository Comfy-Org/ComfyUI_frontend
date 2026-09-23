import type { AgentWsEvent } from '../../schemas/agentApiSchema'

import { STALE_AFTER_MS } from '../../crdt/useAgentCrdtFollower'
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

/**
 * PM-1575: tool names whose execution can plausibly land a CRDT `doc_update`
 * -- the only case `resolveToolCallState` below has anything to wait on. Most
 * agent tools are read-only or purely navigational (`print_workflow`,
 * `list_slots`, `switch_tab`, `remember`, ...) and never touch the doc at
 * all: gating those the same way as a real graph edit strands them at the
 * spinner glyph for the full `STALE_AFTER_MS`, since nothing -- no later
 * `notifyCanvasCaughtUp()` in that turn, ever -- settles them early. Confirmed
 * against every recorded conversation under
 * `browser_tests/fixtures/data/agent/conversations/`: a read-only turn (e.g.
 * `agent-rec-text-only-answer`'s `switch_tab` + `print_workflow`) carries no
 * `graph_ops` at all, so this is not a hypothetical.
 */
const CANVAS_MUTATING_TOOLS = new Set([
  'add_node',
  'delete_node',
  'set_widget',
  'connect',
  'disconnect',
  'clear_canvas',
  'apply_ops',
  'insert_workflow',
  'define_subgraph'
])

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
   * flipping straight to `'done'`, until `notifyCanvasCaughtUp` is called or
   * `STALE_AFTER_MS` elapses, whichever comes first -- reusing the same
   * bound the CRDT follower's own passive heartbeat uses
   * (`agentCrdtDocLifecycle.ts`), rather than inventing a new one. Defaults
   * to never deferring, so a caller with no canvas to catch up on (or that
   * never wires this up) keeps the immediate-done behavior.
   */
  shouldAwaitCanvasSync: () => boolean = () => false,
  /**
   * PM-1575: the bound workflow's CRDT `outcomes.appliedLive` counter (or an
   * equivalent monotonic count of LIVE frames actually applied to the doc --
   * deliberately excluding a subscribe's own catch-up frame, which is
   * unrelated to any tool call and would otherwise look like "the matching
   * update already arrived" to whichever tool call happens to be first after
   * a (re)subscribe), read fresh whenever this transport needs it -- see
   * `canvasSyncBaseline` below for why. Defaults to a constant so a caller
   * with no counter to offer (e.g. a caller that also leaves
   * `shouldAwaitCanvasSync` at its default) never spuriously looks "caught
   * up".
   */
  getCanvasSyncOutcomeCount: () => number = () => 0
): AgentEventTransport {
  let openText: TextPart | null = null
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
  const pendingCanvasSync = new Map<ToolPart, ReturnType<typeof setTimeout>>()
  // PM-1575: the outcome count as of the last time some tool part actually
  // claimed a canvas catch-up (see `claimCanvasSyncOutcome` below), starting
  // at this transport's own creation. `canvasSyncBaseline` below hands each
  // NEW tool part this shared watermark rather than a fresh
  // `getCanvasSyncOutcomeCount()` read, because that read is worthless when a
  // tool call's first-ever frame is already its terminal one (the common
  // case -- recorded conversations never send a `running` frame at all,
  // see the file header): capturing the baseline and checking it happen in
  // the same synchronous call, so a fresh read is trivially equal to itself
  // regardless of whether a `doc_update` already landed moments earlier. The
  // watermark instead stays stale across that no-op `notifyCanvasCaughtUp()`
  // call, so the next part created can see the count has moved since the
  // watermark was last claimed and settle immediately.
  let canvasSyncOutcomeWatermark = getCanvasSyncOutcomeCount()
  // The outcome-count watermark handed to each tool part when it is first
  // seen (see `canvasSyncOutcomeWatermark` above).
  const canvasSyncBaseline = new Map<ToolPart, number>()

  function claimCanvasSyncOutcome(): void {
    canvasSyncOutcomeWatermark = getCanvasSyncOutcomeCount()
  }

  function clearPendingCanvasSyncTimer(part: ToolPart): void {
    const timer = pendingCanvasSync.get(part)
    if (timer !== undefined) clearTimeout(timer)
    pendingCanvasSync.delete(part)
  }

  function settlePendingCanvasSync(part: ToolPart): void {
    clearPendingCanvasSyncTimer(part)
    part.state = 'done'
  }

  function flushPendingCanvasSync(): void {
    if (pendingCanvasSync.size === 0) return
    for (const part of pendingCanvasSync.keys()) settlePendingCanvasSync(part)
    claimCanvasSyncOutcome()
    emit(snapshotMessage(message))
  }

  function notifyCanvasCaughtUp(): void {
    flushPendingCanvasSync()
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
   * Even a successful outcome is only worth waiting on when the tool itself
   * is one that can mutate the doc (`CANVAS_MUTATING_TOOLS` above) -- the
   * same stranding risk applies to e.g. a successful `print_workflow` or
   * `switch_tab`, which never produces a `doc_update` at all.
   */
  function resolveToolCallState(
    part: ToolPart,
    status: 'success' | 'error',
    durationMs: number | undefined
  ): void {
    part.ok = status === 'success'
    part.durationMs = durationMs
    // A duplicate or redelivered terminal frame (e.g. a websocket retry) must
    // not leave a stale timer racing the one this call is about to arm --
    // clearing unconditionally, before either branch below, is what keeps
    // that impossible regardless of which branch runs.
    clearPendingCanvasSyncTimer(part)
    const baseline = canvasSyncBaseline.get(part)
    canvasSyncBaseline.delete(part)
    if (
      status === 'success' &&
      CANVAS_MUTATING_TOOLS.has(part.name) &&
      shouldAwaitCanvasSync()
    ) {
      if (baseline !== undefined && getCanvasSyncOutcomeCount() > baseline) {
        // The matching doc_update already applied -- either while the tool
        // was still running, or before this tool call's first frame ever
        // reached the transport -- see `canvasSyncBaseline` above. Nothing
        // left to wait on.
        part.state = 'done'
        claimCanvasSyncOutcome()
      } else {
        pendingCanvasSync.set(
          part,
          setTimeout(() => {
            settlePendingCanvasSync(part)
            emit(snapshotMessage(message))
          }, STALE_AFTER_MS)
        )
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
      canvasSyncBaseline.set(part, canvasSyncOutcomeWatermark)
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

  return { ingest, settle, notifyCanvasCaughtUp, hasPendingCanvasSync, dispose }
}
