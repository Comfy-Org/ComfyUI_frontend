import type { AgentWsEvent } from '@/workbench/extensions/agent/schemas/agentApiSchema'

import { STALE_AFTER_MS } from '@/workbench/extensions/agent/crdt/agentCrdtDocLifecycle'
import type {
  AskUserResolution,
  AssistantMessage,
  TextPart,
  ThinkingPart,
  ToolPart
} from './agentMessageParts'
import {
  askIdOf,
  retireAskParts,
  snapshotMessage,
  toAskOrNoticePart,
  toAskResolution
} from './agentMessageParts'
import { toolCanMutateCanvas } from './agentToolClassification'
import { canonicalAgentWorkflowId } from './agentWorkflowId'
import type {
  UndeliverableAskContext,
  UndeliverableAskReason
} from './undeliverableAskReporter'
import { createUndeliverableAskReporter } from './undeliverableAskReporter'

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

export type CanvasConfirmation = 'none' | 'awaiting' | 'unavailable'

export interface CanvasSyncEvidence {
  workflowId: string
  opIds: readonly string[]
  isLive: boolean
}

const MAX_OBSERVED_CANVAS_WORKFLOWS = 8
const MAX_OBSERVED_CANVAS_OPS_PER_WORKFLOW = 512

interface PendingCanvasSync {
  timer: ReturnType<typeof setTimeout>
  correlation?: CanvasCorrelation
}

interface CanvasCorrelation {
  workflowId: string
  opIds: ReadonlySet<string>
}

export interface AgentEventTransport {
  ingest: (event: AgentChatEvent) => void
  settle: () => void
  notifyCanvasCaughtUp: (evidence?: CanvasSyncEvidence) => void
  hasPendingCanvasSync: () => boolean
  retireAskPart: (askId: string, resolution: AskUserResolution) => void
  /**
   * Tears the transport down for a reason other than natural completion
   * (abort, drop, reset, hydrate). Flushes any tool-call parts held pending
   * canvas catch-up to `done` and cancels their `STALE_AFTER_MS` timers, so
   * none can fire later against a `message` object the store has since
   * discarded or replaced with authoritative content under the same id.
   */
  dispose: () => void
}

function updateSkill(part: ToolPart, skill: string | null | undefined): void {
  if (skill) part.skill = skill
}

export function createAgentEventTransport(
  message: AssistantMessage,
  emit: (m: AssistantMessage) => void,
  canvasConfirmation: (workflowId?: string) => CanvasConfirmation = () =>
    'none',
  getCanvasSyncOutcomeCount: () => number = () => 0,
  reportUndeliverableAsk: (
    data: AgentAskEvent['data'],
    reason: UndeliverableAskReason,
    context?: UndeliverableAskContext
  ) => void = createUndeliverableAskReporter().report
): AgentEventTransport {
  let openText: TextPart | null = null
  let draft: TextPart | null = null
  let openThinking: ThinkingPart | null = null
  let openThinkingStartedAt = 0
  const tools = new Map<string, ToolPart>(
    message.parts
      .filter((part): part is ToolPart => part.type === 'tool')
      .map((part) => [part.callId, part])
  )
  let settled = false
  let lastTabTargetKey: string | undefined
  const pendingCanvasSync = new Map<ToolPart, PendingCanvasSync>()
  const observedCanvasOps = new Map<string, Set<string>>()
  const canvasSyncOutcomeAtStart = getCanvasSyncOutcomeCount()
  const canvasSyncBaseline = new Map<ToolPart, number>()

  function clearPendingCanvasSyncTimer(part: ToolPart): void {
    const pending = pendingCanvasSync.get(part)
    if (pending !== undefined) clearTimeout(pending.timer)
    pendingCanvasSync.delete(part)
  }

  function observedCanvasOutcome(
    correlation: CanvasCorrelation | undefined
  ): true | undefined {
    return correlation === undefined ? undefined : true
  }

  function settlePendingCanvasSync(
    part: ToolPart,
    { canvasConfirmed }: { canvasConfirmed: boolean | undefined }
  ): void {
    clearPendingCanvasSyncTimer(part)
    part.state = 'done'
    part.canvasConfirmed = canvasConfirmed
  }

  function flushPendingCanvasSync(): void {
    if (pendingCanvasSync.size === 0) return
    for (const part of pendingCanvasSync.keys())
      settlePendingCanvasSync(part, { canvasConfirmed: false })
    emit(snapshotMessage(message))
  }

  function correlationFrom(
    data: AgentToolCallEvent['data']
  ): CanvasCorrelation | undefined {
    if (!data.workflow_id || !data.op_ids?.length) return undefined
    return {
      workflowId: canonicalAgentWorkflowId(data.workflow_id),
      opIds: new Set(data.op_ids)
    }
  }

  function correlationObserved(correlation: CanvasCorrelation): boolean {
    const observed = observedCanvasOps.get(correlation.workflowId)
    return (
      observed !== undefined &&
      [...correlation.opIds].every((opId) => observed.has(opId))
    )
  }

  function rememberCanvasEvidence(evidence: CanvasSyncEvidence): void {
    const workflowId = canonicalAgentWorkflowId(evidence.workflowId)
    let observed = observedCanvasOps.get(workflowId)
    if (observed === undefined) {
      if (observedCanvasOps.size === MAX_OBSERVED_CANVAS_WORKFLOWS)
        observedCanvasOps.delete(observedCanvasOps.keys().next().value!)
      observed = new Set()
      observedCanvasOps.set(workflowId, observed)
    }
    for (const opId of evidence.opIds) {
      observed.delete(opId)
      observed.add(opId)
      if (observed.size > MAX_OBSERVED_CANVAS_OPS_PER_WORKFLOW)
        observed.delete(observed.values().next().value!)
    }
  }

  function shouldSettlePendingCanvasSync(
    pending: PendingCanvasSync,
    evidence: CanvasSyncEvidence | undefined
  ): boolean {
    if (pending.correlation === undefined)
      return evidence === undefined || evidence.isLive
    return evidence !== undefined && correlationObserved(pending.correlation)
  }

  function notifyCanvasCaughtUp(evidence?: CanvasSyncEvidence): void {
    if (evidence !== undefined) rememberCanvasEvidence(evidence)

    let changed = false
    for (const [part, pending] of pendingCanvasSync) {
      if (shouldSettlePendingCanvasSync(pending, evidence)) {
        settlePendingCanvasSync(part, {
          canvasConfirmed: observedCanvasOutcome(pending.correlation)
        })
        changed = true
      }
    }
    if (!changed) return
    emit(snapshotMessage(message))
  }

  function hasPendingCanvasSync(): boolean {
    return pendingCanvasSync.size > 0
  }

  function dispose(): void {
    flushPendingCanvasSync()
  }

  function canvasConfirmationFor(
    part: ToolPart,
    status: 'success' | 'error',
    correlation: CanvasCorrelation | undefined
  ): CanvasConfirmation {
    if (status !== 'success' || !toolCanMutateCanvas(part.name)) return 'none'
    return canvasConfirmation(correlation?.workflowId)
  }

  function canvasWasObserved(
    correlation: CanvasCorrelation | undefined,
    baseline: number | undefined
  ): boolean {
    if (correlation !== undefined) return correlationObserved(correlation)
    return baseline !== undefined && getCanvasSyncOutcomeCount() > baseline
  }

  function resolveToolCallState(
    part: ToolPart,
    status: 'success' | 'error',
    durationMs: number | undefined,
    data: AgentToolCallEvent['data']
  ): void {
    if (part.state === 'done' && part.ok === (status === 'success')) return
    part.ok = status === 'success'
    part.durationMs = durationMs
    clearPendingCanvasSyncTimer(part)
    const baseline = canvasSyncBaseline.get(part)
    canvasSyncBaseline.delete(part)
    const correlation = correlationFrom(data)
    const confirmation = canvasConfirmationFor(part, status, correlation)
    if (confirmation === 'none') {
      part.state = 'done'
      return
    }
    if (confirmation === 'unavailable') {
      settlePendingCanvasSync(part, { canvasConfirmed: false })
      return
    }
    if (canvasWasObserved(correlation, baseline)) {
      settlePendingCanvasSync(part, {
        canvasConfirmed: observedCanvasOutcome(correlation)
      })
      return
    }
    pendingCanvasSync.set(part, {
      correlation,
      timer: setTimeout(() => {
        settlePendingCanvasSync(part, { canvasConfirmed: false })
        emit(snapshotMessage(message))
      }, STALE_AFTER_MS)
    })
  }

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
      canvasSyncBaseline.set(part, canvasSyncOutcomeAtStart)
    }
    part.name = data.tool_name
    updateSkill(part, data.skill)
    if (data.status !== 'running') {
      resolveToolCallState(part, data.status, data.duration_ms, data)
    }
  }

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

  function reportUnrenderedAsk(data: AgentAskEvent['data']): void {
    reportUndeliverableAsk(
      data,
      data.kind === 'unknown' ? 'unknown-kind' : 'unrendered-kind'
    )
  }

  function handleAskEvent(data: AgentAskEvent['data']): boolean {
    const shown = message.parts.find((part) => askIdOf(part) === data.ask_id)
    if (shown) {
      if (shown.type === 'askUnavailable') reportUnrenderedAsk(data)
      return false
    }
    const part = toAskOrNoticePart(data)
    if (part.type === 'askUnavailable') reportUnrenderedAsk(data)
    dropDraft()
    closeOpenText()
    closeOpenThinking()
    message.thinking = false
    message.thinkingText = undefined
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

  function handleAskResolvedEvent(
    data: AgentAskResolvedEvent['data']
  ): boolean {
    const parts = retireAskParts(
      message.parts,
      data.ask_id,
      toAskResolution(data)
    )
    if (parts === message.parts) return false
    message.parts = parts
    return true
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
        return handleAskResolvedEvent(event.data)
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
    if (settled) {
      if (event.type === 'agent_ask')
        reportUndeliverableAsk(event.data, 'settled-turn')
      return
    }
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

  function retireAskPart(askId: string, resolution: AskUserResolution): void {
    const parts = retireAskParts(message.parts, askId, resolution)
    if (parts === message.parts) return
    message.parts = parts
    emit(snapshotMessage(message))
  }

  return {
    ingest,
    settle,
    notifyCanvasCaughtUp,
    hasPendingCanvasSync,
    dispose,
    retireAskPart
  }
}
