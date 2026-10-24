import {
  computed,
  effectScope,
  onScopeDispose,
  readonly,
  ref,
  shallowRef,
  watch
} from 'vue'
import type { Ref } from 'vue'

import { SCHEMA_VERSION } from '@comfyorg/comfy-multi-player'
import type { Op } from '@comfyorg/comfy-multi-player'

import type { LGraph } from '@/lib/litegraph/src/litegraph'
import { useTelemetry } from '@/platform/telemetry'
import { reportError } from '@/platform/telemetry/reportError'
import type { AgentGraphProjectionStage } from '@/platform/telemetry/types'
import { parseNodeId } from '@/types/nodeId'
import type { NodeId } from '@/types/nodeId'
import { createUuidv4 } from '@/utils/uuid'
import { useAgentPanelStore } from '@/workbench/extensions/agent/stores/agent/agentPanelStore'

import type {
  AgentCrdtOutcomeCounters,
  AgentCrdtTerminalState,
  AgentCrdtStatus
} from './agentCrdtStatus'
import {
  AgentCrdtDocLifecycle,
  STALE_AFTER_MS,
  SUBSCRIBE_CATCHUP_GRACE_MS
} from './agentCrdtDocLifecycle'
import { AgentCrdtProjection } from './agentCrdtProjection'
import type { DocNodeDelta, FrameOutcome } from './agentCrdtProjection'
import { createLoggedTransport } from './agentCrdtTransport'
import type { AgentDocFrameTransport } from './agentDocFrameTransport'
import { recordDevEvent } from './devPanelLog'
import type { CrdtDebugSnapshot } from './crdtSnapshot'
import { readCrdtSnapshot } from './crdtSnapshot'
import { DocFrameClient } from './docFrameClient'
import { RESEED_CONFLICT, isRetryableReseedCode } from './docFrameCodes'
import type { GraphOperation } from './graphOperations'
import type { ClassifiedDocUpdate } from './layoutFollowerBridge'
import { LayoutFollowerBridge, isLiveAgentUpdate } from './layoutFollowerBridge'
import type { LiveGraphApplierDeps } from './liveGraphApplier'
import {
  readDocPromotedWidgets,
  readSubgraphDefinitionIds
} from './agentSubgraphDefinitions'
import { readDocSlotNames, readDocWidgetValue } from './liveGraphApplier'
import { createOpCoalescer } from './opCoalescer'
import { createOpSender } from './opSender'
import type { BatchOutcome, OpsResultView } from './opSender'
import { createRejectedOpNotifier } from './rejectedOpNotice'
import {
  forgetUnsyncedAtLoad,
  recordUnsyncedHumanOps
} from './unsyncedHumanOps'

export { STALE_AFTER_MS, SUBSCRIBE_CATCHUP_GRACE_MS }

interface ProjectionFrameId {
  opIds?: readonly string[]
  seq: number
  isLive?: boolean
}

const NOTHING_APPLIED: FrameOutcome = {
  applied: false,
  nodes: { added: [], removed: [] }
}

function isAgentFrame(actor: string | undefined): boolean {
  return actor === undefined || actor.startsWith('agent:')
}

function projectionAppliedCleanly(outcome: FrameOutcome): boolean {
  return outcome.applied && outcome.failureCount === 0
}

function reportAgentProjection(
  frame: ProjectionFrameId,
  stage: AgentGraphProjectionStage,
  outcome: FrameOutcome
): void {
  const opIds = frame.opIds?.filter((id) => id.length > 0) ?? []
  useTelemetry()?.trackAgentGraphProjection({
    op_id: opIds[0] ?? null,
    op_count: opIds.length,
    sequence: frame.seq,
    stage,
    added_count: outcome.nodes.added.length,
    removed_count: outcome.nodes.removed.length,
    apply_failure_count: outcome.applied ? outcome.failureCount : 0
  })
}

function liveAddedNodeIds(
  added: readonly string[],
  graph: LGraph | null
): NodeId[] {
  if (!graph) return []
  return added.flatMap((id) => {
    const nodeId = parseNodeId(id)
    return nodeId && graph.getNodeById(nodeId) ? [nodeId] : []
  })
}

function emitPendingMaterializations(
  workflowId: string,
  actor: string | undefined,
  available: ReadonlySet<NodeId>,
  pending: Set<NodeId>,
  events: AgentCrdtFollowerEvents
): void {
  const nodeIds = [...pending].filter((id) => available.has(id))
  for (const nodeId of nodeIds) pending.delete(nodeId)
  if (nodeIds.length === 0) return
  events.onMaterialized?.({ workflowId, actor, nodeIds })
}

interface SubscribeRefusalOutcome {
  shouldNotify: boolean
  message?: string
  code?: string
}

// PM-1604 / BE-11437: a subscribe refusal carries a `code` that is either
// retryable (the lifecycle keeps retrying on its own) or one of
// `PERMANENT_SUBSCRIBE_REFUSAL_CODES`, which the lifecycle won't recover
// from by itself — surface those to the person via `onSyncError`, except
// `unsupported`, which the lifecycle already declines to notify (a
// deployment with the doc surface off shouldn't toast every user). The
// caller notifies only after its own held-ops cleanup, matching
// `onDocReset`'s cleanup-before-notify order, so a throw from consumer code
// reaching into the toast store can't strand an in-flight op batch. `code`
// rides along so the presentation layer can pick accurate copy instead of
// collapsing every permanent code to the same message.
function handleSubscribeRefusal(
  detail: { code?: unknown; message?: unknown } | null,
  lifecycle: AgentCrdtDocLifecycle
): SubscribeRefusalOutcome {
  const code = typeof detail?.code === 'string' ? detail.code : undefined
  if (!lifecycle.onSubscribeRefused(code)) return { shouldNotify: false }
  return {
    shouldNotify: true,
    message: typeof detail?.message === 'string' ? detail.message : undefined,
    code
  }
}

function notifyAgentMaterialization(
  update: ClassifiedDocUpdate,
  nodes: DocNodeDelta,
  materialized: readonly NodeId[],
  graph: LGraph | null,
  pendingLiveNodeIds: Set<NodeId>,
  events: AgentCrdtFollowerEvents
): void {
  for (const id of nodes.removed) {
    const nodeId = parseNodeId(id)
    if (nodeId) pendingLiveNodeIds.delete(nodeId)
  }
  const liveAgentUpdate = isLiveAgentUpdate(update)
  if (liveAgentUpdate) {
    for (const nodeId of materialized) pendingLiveNodeIds.add(nodeId)
    for (const id of nodes.added) {
      const nodeId = parseNodeId(id)
      if (nodeId) pendingLiveNodeIds.add(nodeId)
    }
  }
  const available = new Set([
    ...materialized,
    ...liveAddedNodeIds(nodes.added, graph)
  ])
  emitPendingMaterializations(
    update.workflowId,
    liveAgentUpdate ? update.actor : undefined,
    available,
    pendingLiveNodeIds,
    events
  )
}

function hasNodes(
  canvas: Record<string, unknown> | null
): canvas is Record<string, unknown> {
  return Array.isArray(canvas?.nodes) && canvas.nodes.length > 0
}

type OpsResultDropReason = 'inactive_target' | 'workflow_mismatch'

function opsResultDropReason(
  active: boolean,
  workflowId: unknown,
  subscribedWorkflowId: string | null
): OpsResultDropReason | null {
  if (!active) return 'inactive_target'
  return workflowId === subscribedWorkflowId ? null : 'workflow_mismatch'
}

interface AgentCrdtFollowerEvents {
  onAppliedUpdate?: (event: {
    workflowId: string
    opIds: readonly string[]
    isLive: boolean
  }) => void
  onMaterialized?: (event: {
    workflowId: string
    actor: string | undefined
    nodeIds: readonly NodeId[]
  }) => void
  onReset?: (workflowId: string) => void
  /**
   * PM-1604 / BE-11437: the doc-host classified a resync refusal as
   * permanent (one of `PERMANENT_SUBSCRIBE_REFUSAL_CODES`) — the lifecycle
   * has already stopped retrying it, so this is the one chance to tell the
   * person their canvas is out of sync instead of leaving them to notice a
   * channel that silently stopped updating. Not fired for `unsupported`
   * (the doc surface is off for this deployment; every user hits it, so it
   * latches silently) or for a refusal that repeats on reconnect for a
   * workflow already notified. `code` is the doc-host's permanent refusal
   * code (e.g. `schema_version_mismatch`, `catalog_mismatch`) so the
   * presentation layer can choose accurate localized copy instead of a
   * single message for every permanent reason.
   */
  onSyncError?: (message?: string, code?: string) => void
}

function notifyAppliedUpdate(
  update: ClassifiedDocUpdate,
  outcome: FrameOutcome,
  events: AgentCrdtFollowerEvents
): void {
  if (!outcome.applied || outcome.failureCount > 0) return
  events.onAppliedUpdate?.({
    workflowId: update.workflowId,
    opIds: update.opIds ?? [],
    isLive: !update.catchUp
  })
}

// Nothing is re-thrown: an error escaping onBeforeUnmount reaches Vue's
// logError, which re-throws in dev/test builds (this app registers no
// app.config.errorHandler) and aborts the rest of unmountComponent - leaving
// this composable's watch alive to rebind against destroyed objects.
function runFollowerTeardown(cleanups: readonly (() => void)[]): void {
  for (const cleanup of cleanups) {
    try {
      cleanup()
    } catch (error) {
      reportError(error, {
        surface: 'agent',
        errorType: 'failure_tearing_down_agent_crdt_follower'
      })
    }
  }
}

type AgentCrdtApplierDeps = Omit<
  LiveGraphApplierDeps,
  'getGraph' | 'holdsLocalWrite'
>

export interface AgentCrdtFollowerOptions {
  transport: AgentDocFrameTransport
  userId?: () => string | null
  isTargetActive?: Ref<boolean>
  /**
   * Live graph the document is applied to. Reactive reads inside the getter
   * are tracked, so a `null` → graph flip syncs the graph from the document
   * without waiting for the next remote frame.
   */
  getGraph?: () => LGraph | null
  events?: AgentCrdtFollowerEvents
  applierDeps?: AgentCrdtApplierDeps
  canvasFor?: (workflowId: string) => Record<string, unknown> | null
}

export function useAgentCrdtFollower(
  workflowId: Ref<string | null>,
  {
    transport,
    userId = () => null,
    isTargetActive = ref(true),
    getGraph = () => null,
    events = {},
    applierDeps = {},
    canvasFor = () => null
  }: AgentCrdtFollowerOptions
) {
  const productGate = useAgentPanelStore()
  const follower = shallowRef<ReturnType<typeof startAgentCrdtFollower>>()
  const disabledStatus: AgentCrdtStatus = {
    enabled: false,
    connected: false,
    canvasMayBeStale: false,
    workflowId: null,
    updatesApplied: 0,
    lastFrameType: null,
    terminal: null,
    outcomes: {
      received: 0,
      applied: 0,
      appliedLive: 0,
      skipped: 0,
      errored: 0,
      gap: 0,
      reset: 0,
      dropped: 0
    }
  }
  const status = computed(() => follower.value?.status.value ?? disabledStatus)

  watch(
    () => productGate.enabled,
    (enabled, _previous, onCleanup) => {
      if (!enabled) return
      const scope = effectScope()
      onCleanup(() => {
        follower.value = undefined
        scope.stop()
      })
      follower.value = scope.run(() =>
        startAgentCrdtFollower(workflowId, {
          transport,
          userId,
          isTargetActive,
          getGraph,
          events,
          applierDeps,
          canvasFor
        })
      )
    },
    { immediate: true, flush: 'sync' }
  )

  return {
    status: readonly(status),
    debugSnapshot: (): CrdtDebugSnapshot =>
      follower.value?.debugSnapshot() ??
      readCrdtSnapshot(null, {
        status: status.value,
        tabId: null,
        lastSeq: null,
        schemaError: null
      }),
    enqueueHumanOperations: (operations: GraphOperation[]) =>
      follower.value?.enqueueHumanOperations(operations),
    docInputNames: (nodeId: NodeId) =>
      follower.value?.docInputNames(nodeId) ?? null,
    docWidgetValue: (nodeId: NodeId, widgetName: string) =>
      follower.value?.docWidgetValue(nodeId, widgetName),
    docPromotedWidgets: (nodeId: NodeId) =>
      follower.value?.docPromotedWidgets(nodeId) ?? null,
    mayWritePromotedHost: (nodeId: NodeId) =>
      follower.value?.mayWritePromotedHost(nodeId) ?? false,
    docHasSubgraphDefinition: (definitionId: string) =>
      follower.value?.docHasSubgraphDefinition(definitionId) ?? false,
    notifyWidgetWriteRefused: (nodeId: string | number, widgetName: string) =>
      follower.value?.notifyWidgetWriteRefused(nodeId, widgetName),
    subscriptionSent: () => follower.value?.subscriptionSent() ?? false
  }
}

function startAgentCrdtFollower(
  workflowId: Ref<string | null>,
  {
    transport,
    userId,
    isTargetActive,
    getGraph,
    events,
    applierDeps,
    canvasFor
  }: Required<AgentCrdtFollowerOptions>
) {
  const connected = ref(false)
  let catchUpAwaitingProjectionFor: string | null = null
  const syncCanvasMayBeStale = ref(false)
  const projectionFailureFor = ref<string | null>(null)
  const canvasMayBeStale = computed(
    () => syncCanvasMayBeStale.value || projectionFailureFor.value !== null
  )
  const terminal = ref<AgentCrdtTerminalState>(null)
  const updatesApplied = ref(0)
  const lastFrameType = ref<string | null>(null)
  const subscribedWorkflowId = ref<string | null>(null)
  const outcomes = ref<AgentCrdtOutcomeCounters>({
    received: 0,
    applied: 0,
    appliedLive: 0,
    skipped: 0,
    errored: 0,
    gap: 0,
    reset: 0,
    dropped: 0
  })

  const client = new DocFrameClient(createLoggedTransport(transport))
  const bridge = new LayoutFollowerBridge(client)
  const lifecycle = new AgentCrdtDocLifecycle(
    () => subscribedWorkflowId.value,
    () => bridge.resubscribe(),
    (reason) => {
      connected.value = false
      terminal.value = reason
    }
  )
  const tabId = createUuidv4()
  const ownActor = (): string => `human:${userId() ?? 'anonymous'}:${tabId}`
  // Doc node ids whose human delete the host has applied but whose effect
  // frame has not yet removed them from the doc. Kept pending for the
  // reconcile so the result-to-effect window cannot resurrect them.
  const confirmedDeletes = new Set<string>()
  const rejectedOpNotifier = createRejectedOpNotifier()
  const sentAddsByDoc = new WeakMap<typeof bridge.follower.doc, Set<string>>()
  const sentAddsToCurrentDoc = (): Set<string> => {
    const doc = bridge.follower.doc
    const sentAdds = sentAddsByDoc.get(doc) ?? new Set<string>()
    sentAddsByDoc.set(doc, sentAdds)
    return sentAdds
  }
  const projection = new AgentCrdtProjection(getGraph, applierDeps)
  const pendingRejected = new Map<string, Op[]>()

  function markCanvasStale(): void {
    syncCanvasMayBeStale.value = true
    catchUpAwaitingProjectionFor = null
  }

  function markProjectionStale(workflowId: string): void {
    projectionFailureFor.value = workflowId
  }

  function clearProjectionStaleness(workflowId: string): void {
    if (projectionFailureFor.value === workflowId)
      projectionFailureFor.value = null
  }

  function clearSyncStaleness(): void {
    syncCanvasMayBeStale.value = false
    catchUpAwaitingProjectionFor = null
  }

  function clearCanvasStaleness(): void {
    syncCanvasMayBeStale.value = false
    projectionFailureFor.value = null
    catchUpAwaitingProjectionFor = null
  }

  const applyRejectedOps = (
    workflowId: string,
    rejected: readonly Op[],
    seq: number = bridge.lastSequence
  ): boolean => {
    if (getGraph() === null) return false
    const projectionOutcome = projection.revertRejected(workflowId, rejected)
    if (!projectionOutcome.applied) return true
    reportMaterialized(workflowId, projectionOutcome.createdNodeIds)
    reportAgentProjection(
      {
        opIds: rejected.map((op) => op.op_id),
        seq
      },
      'reverted',
      projectionOutcome
    )
    return true
  }

  const drainRejectedOps = (workflowId: string): void => {
    const rejected = pendingRejected.get(workflowId)
    if (!rejected) return
    if (applyRejectedOps(workflowId, rejected))
      pendingRejected.delete(workflowId)
  }

  const trackAcknowledgedDeletes = (
    outcome: Extract<BatchOutcome, { state: 'acknowledged' }>
  ) => {
    const applied = new Set(outcome.result.applied)
    for (const op of outcome.ops) {
      if (op.op === 'delete_node' && applied.has(op.op_id))
        confirmedDeletes.add(String(op.node_id))
    }
    rejectedOpNotifier.notify(outcome.ops, outcome.result)
  }

  const revertRejectedOps = (
    outcome: Extract<BatchOutcome, { state: 'acknowledged' }>
  ) => {
    const workflowId = outcome.result.workflowId ?? bridge.subscribedWorkflowId
    if (workflowId === null) return

    const applied = new Set(outcome.result.applied)
    const rejected = outcome.ops.filter((op) => !applied.has(op.op_id))
    if (!isTargetActive.value) {
      pendingRejected.set(workflowId, [
        ...(pendingRejected.get(workflowId) ?? []),
        ...rejected
      ])
      return
    }
    if (!applyRejectedOps(workflowId, rejected, outcome.result.seq))
      pendingRejected.set(workflowId, [
        ...(pendingRejected.get(workflowId) ?? []),
        ...rejected
      ])
  }

  const workflowByUnsettledOpId = new Map<string, string>()
  const workflowsWithLostOps = new Set<string>()
  const recordUnsynced = (): void => {
    const unsynced = new Set(workflowsWithLostOps)
    for (const { workflowId, ops } of sender.pendingOps()) {
      unsynced.add(workflowId)
      for (const op of ops) workflowByUnsettledOpId.set(op.op_id, workflowId)
    }
    recordUnsyncedHumanOps(tabId, unsynced)
  }
  const noteSettledHumanOps = (outcome: BatchOutcome): void => {
    const workflowId = workflowByUnsettledOpId.get(outcome.ops[0]?.op_id ?? '')
    for (const op of outcome.ops) workflowByUnsettledOpId.delete(op.op_id)
    if (workflowId !== undefined && outcome.state !== 'acknowledged')
      workflowsWithLostOps.add(workflowId)
    recordUnsynced()
  }

  const settleHumanOps = (outcome: BatchOutcome) => {
    if (outcome.state === 'acknowledged') {
      trackAcknowledgedDeletes(outcome)
      recordDevEvent('human_ops_settled', outcome)
    }
    projection.settleLocalWrites(outcome.ops)
    if (outcome.state === 'acknowledged' && !outcome.result.ok)
      revertRejectedOps(outcome)
    noteSettledHumanOps(outcome)
  }

  const sender = createOpSender({
    sendOps: (target, tab, ops) => client.sendOps(target, tab, ops),
    onOpsResult(listener) {
      const handler: EventListener = (event) => {
        // `docFrameClient` already validated this into a DocOpsResult, which
        // OpsResultView is derived from, so it travels whole.
        if (event instanceof CustomEvent)
          listener(event.detail as OpsResultView)
      }
      bridge.addEventListener('doc_ops_result', handler)
      return () => bridge.removeEventListener('doc_ops_result', handler)
    },
    // Send REALITY, not this composable's intent: the sender re-reads it before
    // every send and resend, so ops never reach a doc we are not subscribed to.
    workflowId: () => bridge.subscribedWorkflowId,
    get tab() {
      return tabId
    },
    actor: ownActor,
    baseVersion: () => bridge.lastSequence,
    onBatchSettled: settleHumanOps
  })
  const coalescer = createOpCoalescer((operations) => {
    sender.admit(operations)
    recordUnsynced()
  }, sender.flush)

  const pendingLiveNodeIds = new Set<NodeId>()
  const pendingProjectionFrames = new Map<string, ProjectionFrameId[]>()
  const reportMaterialized = (
    workflowId: string,
    materialized: readonly NodeId[]
  ): void => {
    emitPendingMaterializations(
      workflowId,
      undefined,
      new Set(materialized),
      pendingLiveNodeIds,
      events
    )
  }
  const retainPendingFrame = (update: ClassifiedDocUpdate): void => {
    const frames = pendingProjectionFrames.get(update.workflowId)
    const frame = {
      opIds: update.opIds,
      seq: update.seq,
      isLive: !update.catchUp
    }
    if (frames) frames.push(frame)
    else pendingProjectionFrames.set(update.workflowId, [frame])
  }
  const reportPendingFrames = (
    workflowId: string,
    stage: Extract<AgentGraphProjectionStage, 'applied_deferred' | 'discarded'>,
    outcome: FrameOutcome
  ): void => {
    const frames = pendingProjectionFrames.get(workflowId)
    pendingProjectionFrames.delete(workflowId)
    for (const frame of frames ?? [])
      reportAgentProjection(frame, stage, outcome)
  }
  const notifyPendingFramesApplied = (
    workflowId: string,
    frames: readonly ProjectionFrameId[]
  ): void => {
    for (const frame of frames) {
      events.onAppliedUpdate?.({
        workflowId,
        opIds: frame.opIds ?? [],
        isLive: frame.isLive ?? true
      })
    }
  }
  const flushPendingFrames = (
    workflowId: string,
    outcome: FrameOutcome
  ): void => {
    if (projectionAppliedCleanly(outcome))
      notifyPendingFramesApplied(
        workflowId,
        pendingProjectionFrames.get(workflowId) ?? []
      )
    reportPendingFrames(workflowId, 'applied_deferred', outcome)
  }
  const reportFrameProjection = (
    update: ClassifiedDocUpdate,
    outcome: FrameOutcome
  ): void => {
    const stage = outcome.applied
      ? 'applied'
      : getGraph() === null
        ? 'received_no_graph'
        : 'discarded'
    if (isAgentFrame(update.actor)) {
      const reported = stage === 'discarded' ? NOTHING_APPLIED : outcome
      reportAgentProjection(update, stage, reported)
    }
    if (stage === 'received_no_graph') {
      if (isAgentFrame(update.actor)) retainPendingFrame(update)
      return
    }
    if (stage === 'applied') flushPendingFrames(update.workflowId, outcome)
    else reportPendingFrames(update.workflowId, 'discarded', NOTHING_APPLIED)
  }
  const settleCollectedProjection = (
    workflowId: string,
    outcome: Extract<FrameOutcome, { applied: true }>,
    pendingFrames: readonly ProjectionFrameId[]
  ): void => {
    if (outcome.failureCount > 0) {
      markProjectionStale(workflowId)
      return
    }
    notifyPendingFramesApplied(workflowId, pendingFrames)
    if (!projection.hasPendingFailure(workflowId))
      clearProjectionStaleness(workflowId)
  }
  const applyCollected = (workflowId: string): void => {
    const pendingFrames = pendingProjectionFrames.get(workflowId) ?? []
    const outcome = projection.applyCollected(workflowId)
    if (!outcome.applied) return
    const settlesCatchUp = catchUpAwaitingProjectionFor === workflowId
    settleCollectedProjection(workflowId, outcome, pendingFrames)
    if (settlesCatchUp) clearSyncStaleness()
    reportMaterialized(workflowId, outcome.createdNodeIds)
    reportPendingFrames(workflowId, 'applied_deferred', outcome)
  }
  const incrementOutcome = (
    key: 'received' | 'applied' | 'appliedLive' | 'skipped' | 'reset'
  ): void => {
    outcomes.value = { ...outcomes.value, [key]: outcomes.value[key] + 1 }
  }
  const isCurrentWorkflow = (workflowId: unknown): workflowId is string =>
    isTargetActive.value && workflowId === subscribedWorkflowId.value
  /**
   * The host echoes this tab's own ops back as a `doc_update`. The graph
   * already holds that edit (the intent was minted from it), so the frame is
   * merged into the doc and never re-applied. Catch-up frames are exempt:
   * they can carry this actor as the last writer while replaying state the
   * graph has not seen.
   */
  const isOwnEcho = (update: ClassifiedDocUpdate): boolean =>
    !update.catchUp && update.actor === ownActor()
  const applyFrame = (update: ClassifiedDocUpdate): FrameOutcome => {
    if (isOwnEcho(update) && getGraph() !== null) {
      const nodes = projection.discardPending(update.workflowId)
      incrementOutcome('skipped')
      return { applied: false, nodes }
    }
    const outcome = projection.applyFrame(update)
    incrementOutcome(outcome.applied ? 'applied' : 'skipped')
    if (outcome.applied && !update.catchUp) incrementOutcome('appliedLive')
    return outcome
  }

  function tryReseed(): boolean {
    const target = subscribedWorkflowId.value
    if (target === null || !bridge.canReseed(target)) return false
    const canvas = canvasFor(target)
    if (!hasNodes(canvas) || !bridge.reseed(target, canvas)) return false
    recordDevEvent('doc_reseed_sent', { workflowId: target })
    lifecycle.onSubscribeSent(target)
    return true
  }
  const onReseedResult: EventListener = (event) => {
    if (!(event instanceof CustomEvent)) return
    const detail = event.detail as {
      workflowId?: unknown
      ok?: unknown
      code?: unknown
    } | null
    if (!isCurrentWorkflow(detail?.workflowId)) return
    lastFrameType.value = event.type
    recordDevEvent('doc_reseed_result', detail)
    const code = typeof detail.code === 'string' ? detail.code : undefined
    if (detail.ok === true || code === RESEED_CONFLICT) return
    if (isRetryableReseedCode(code)) lifecycle.onSubscribeRefused(code)
    else lifecycle.stopProbing()
    if (lifecycle.refusalIsFinal()) terminal.value = 'refused'
  }

  function handleRejectedSubscription(
    detail: {
      workflowId?: unknown
      ok?: unknown
      code?: unknown
      message?: unknown
    } | null
  ): void {
    const reseeding = tryReseed()
    const refusal = reseeding
      ? { shouldNotify: false }
      : handleSubscribeRefusal(detail, lifecycle)
    if (!reseeding && lifecycle.refusalIsFinal()) terminal.value = 'refused'
    releaseHeldOps()
    sender.abortIfUnbound()
    if (refusal.shouldNotify)
      events.onSyncError?.(refusal.message, refusal.code)
  }

  function subscribeBaselineIsIntegrated(seq: number | undefined): boolean {
    return (seq ?? 0) === 0 || bridge.isSubscribeBaselineIntegrated
  }

  function retryFailedProjection(workflowId: string): boolean {
    const outcome = projection.retryFailed(workflowId)
    if (outcome === null) {
      const pending =
        projection.hasPendingFailure(workflowId) ||
        (getGraph() === null && projectionFailureFor.value === workflowId)
      if (!pending) clearProjectionStaleness(workflowId)
      return !pending
    }
    reportMaterialized(workflowId, outcome.createdNodeIds)
    if (outcome.failureCount === 0) {
      clearProjectionStaleness(workflowId)
      return true
    }
    markProjectionStale(workflowId)
    return false
  }

  const onSubscribed: EventListener = (event) => {
    if (!(event instanceof CustomEvent)) return
    if (!isTargetActive.value) return
    const detail = event.detail as {
      ok?: unknown
      code?: unknown
      message?: unknown
      seq?: number
    } | null
    const ok = detail?.ok === true
    connected.value = ok
    lastFrameType.value = event.type
    recordDevEvent('doc_subscribed', event.detail ?? null)
    if (ok) {
      const workflowId = subscribedWorkflowId.value
      const projectionIsClean =
        workflowId === null || retryFailedProjection(workflowId)
      if (projectionIsClean && subscribeBaselineIsIntegrated(detail.seq))
        clearCanvasStaleness()
      terminal.value = null
      lifecycle.onSubscribeConfirmed()
      forgetUnsyncedAtLoad(subscribedWorkflowId.value)
      resumeHeldOpsIfSubscribed()
    } else {
      handleRejectedSubscription(detail)
    }
  }
  function settleCatchUpProjection(
    update: ClassifiedDocUpdate,
    outcome: FrameOutcome
  ): void {
    if (outcome.applied ? outcome.failureCount > 0 : getGraph() === null) {
      markProjectionStale(update.workflowId)
    } else if (
      projectionAppliedCleanly(outcome) &&
      !projection.hasPendingFailure(update.workflowId)
    ) {
      clearProjectionStaleness(update.workflowId)
    }
    if (!update.catchUp) return
    if (outcome.applied) clearSyncStaleness()
    else catchUpAwaitingProjectionFor = update.workflowId
  }
  const onUpdate: EventListener = (event) => {
    if (!(event instanceof CustomEvent)) return
    const update = event.detail as ClassifiedDocUpdate
    incrementOutcome('received')
    if (!isCurrentWorkflow(update.workflowId)) {
      incrementOutcome('skipped')
      return
    }
    lifecycle.onDocumentUpdate()
    updatesApplied.value = bridge.follower.updatesApplied
    lastFrameType.value = event.type
    retryFailedProjection(update.workflowId)
    const outcome = applyFrame(update)
    settleCatchUpProjection(update, outcome)
    notifyAppliedUpdate(update, outcome, events)
    const nodes = outcome.nodes
    const created = outcome.applied ? outcome.createdNodeIds : []
    reportFrameProjection(update, outcome)
    recordDevEvent('doc_update', {
      workflowId: update.workflowId,
      seq: update.seq,
      actor: update.actor,
      echo: isOwnEcho(update),
      bytes: update.update instanceof Uint8Array ? update.update.length : null
    })
    if (nodes.added.length > 0 || nodes.removed.length > 0)
      recordDevEvent('doc_nodes_changed', nodes)
    notifyAgentMaterialization(
      update,
      nodes,
      created,
      getGraph(),
      pendingLiveNodeIds,
      events
    )
  }
  const onOpsResult: EventListener = (event) => {
    if (!(event instanceof CustomEvent)) return
    const detail = event.detail as { workflowId?: unknown } | null
    const dropReason = opsResultDropReason(
      isTargetActive.value,
      detail?.workflowId,
      subscribedWorkflowId.value
    )
    if (dropReason !== null) {
      recordDevEvent('doc_ops_result_dropped', {
        reason: dropReason,
        subscribedWorkflowId: subscribedWorkflowId.value,
        frame: event.detail ?? null
      })
      return
    }
    lifecycle.onDocumentResult()
    lastFrameType.value = event.type
    recordDevEvent('doc_ops_result', event.detail ?? null)
  }
  const onDocReset: EventListener = (event) => {
    const detail =
      event instanceof CustomEvent
        ? (event.detail as { workflowId?: string })
        : undefined
    incrementOutcome('reset')
    if (!isCurrentWorkflow(detail?.workflowId)) return
    projection.replaceOnNextFrame(detail.workflowId)
    reportPendingFrames(detail.workflowId, 'discarded', NOTHING_APPLIED)
    sender.abortAll()
    workflowsWithLostOps.delete(detail.workflowId)
    recordUnsynced()
    events.onReset?.(detail.workflowId)
    connected.value = false
    markCanvasStale()
    updatesApplied.value = 0
    lastFrameType.value = event.type
    lifecycle.clearStaleProbe()
    lifecycle.resetNotifiedGiveUp()
    pendingLiveNodeIds.clear()
    recordDevEvent(
      'doc_reset',
      event instanceof CustomEvent ? (event.detail ?? null) : null
    )
  }
  const onFollowerReplaced: EventListener = (event) => {
    // Gate on this composable's own INTENT, not the bridge's send REALITY
    // (`bridge.subscribedWorkflowId`): a doc replacement while the socket is
    // down leaves reality null, but the adapter must still be rebound to the
    // new doc — otherwise it keeps observing the destroyed one and goes deaf
    // when the socket recovers and updates land in the replacement.
    if (!(event instanceof CustomEvent)) return
    const detail = event.detail as { workflowId?: unknown } | null
    const workflowId = detail?.workflowId
    if (
      isTargetActive.value &&
      typeof workflowId === 'string' &&
      workflowId === subscribedWorkflowId.value
    ) {
      updatesApplied.value = 0
      projection.discardPending(workflowId)
      reportPendingFrames(workflowId, 'discarded', NOTHING_APPLIED)
      projection.bind(workflowId, bridge.follower)
    }
  }
  const staleClientNotified = new Set<string>()
  const onSchemaError: EventListener = (event) => {
    connected.value = false
    markCanvasStale()
    terminal.value = 'schema_error'
    lastFrameType.value = event.type
    lifecycle.clearStaleProbe()
    const detail =
      event instanceof CustomEvent
        ? (event.detail as { workflowId?: string; found?: unknown } | null)
        : null
    if (detail?.workflowId !== undefined) {
      projection.discardPending(detail.workflowId)
      reportPendingFrames(detail.workflowId, 'discarded', NOTHING_APPLIED)
    }
    outcomes.value = { ...outcomes.value, errored: outcomes.value.errored + 1 }
    recordDevEvent(
      'schema_error',
      event instanceof CustomEvent ? (event.detail ?? null) : null
    )
    notifyStaleClient(detail)
  }
  function notifyStaleClient(
    detail: { workflowId?: string; found?: unknown } | null
  ): void {
    const found = detail?.found
    const skew = docSchemaSkew(found)
    const workflowId = detail?.workflowId
    if (skew === null || workflowId === undefined) return
    const notificationKey = `${workflowId}:${skew}`
    if (staleClientNotified.has(notificationKey)) return
    staleClientNotified.add(notificationKey)
    if (skew === 'newer') {
      events.onSyncError?.(
        `document schema v${found} is newer than this page reads (v${SCHEMA_VERSION})`,
        'stale_client_schema'
      )
      return
    }
    events.onSyncError?.(
      `document schema v${found} is older than this page reads (v${SCHEMA_VERSION})`,
      'stale_host_schema'
    )
  }
  const onGap: EventListener = (event) => {
    connected.value = false
    markCanvasStale()
    outcomes.value = { ...outcomes.value, gap: outcomes.value.gap + 1 }
    recordDevEvent(
      'doc_gap',
      event instanceof CustomEvent ? (event.detail ?? null) : null
    )
  }
  const onStale: EventListener = (event) => {
    outcomes.value = { ...outcomes.value, dropped: outcomes.value.dropped + 1 }
    recordDevEvent(
      'doc_stale',
      event instanceof CustomEvent ? (event.detail ?? null) : null
    )
  }
  const onSubscribeSent: EventListener = (event) => {
    if (!(event instanceof CustomEvent)) return
    const detail = event.detail as { workflowId?: unknown } | null
    if (typeof detail?.workflowId !== 'string') return
    lifecycle.onSubscribeSent(detail.workflowId)
  }
  function onSocketStatus(live: boolean): void {
    if (!live) {
      if (connected.value) markCanvasStale()
      connected.value = false
      return
    }
    connected.value = false
    terminal.value = null
    lifecycle.onReconnected()
    recordDevEvent('reconnected', null)
    bridge.reconnect()
  }

  bridge.addEventListener('doc_subscribed', onSubscribed)
  bridge.addEventListener('doc_update', onUpdate)
  bridge.addEventListener('doc_ops_result', onOpsResult)
  bridge.addEventListener('doc_reset', onDocReset)
  bridge.addEventListener('follower_replaced', onFollowerReplaced)
  bridge.addEventListener('schema_error', onSchemaError)
  bridge.addEventListener('doc_gap', onGap)
  bridge.addEventListener('doc_stale', onStale)
  bridge.addEventListener('doc_subscribe_sent', onSubscribeSent)
  bridge.addEventListener('doc_reseed_result', onReseedResult)
  const stopTransportStatus = transport.onSocketStatus(onSocketStatus)

  // FE-1902 (poc-3): distinguish the mount-time null (in-memory doc id died
  // with the previous mount — rebind from sessionStorage) from a later null
  // (a REAL detach, e.g. new chat — drop the persisted id too).
  let initialBind = true
  // Readiness only. The other ordering -- graph ready first, target activated
  // second -- cannot be caught here: `getGraph` does not change when activity
  // flips, and even if this watcher also took `isTargetActive` as a source it
  // was created before the binding watcher below, so it would run first and
  // still see no subscribed workflow. Activation therefore applies what was
  // collected at the bind site instead, once the binding actually exists.
  watch(getGraph, (graph) => {
    const bound = subscribedWorkflowId.value
    if (graph && bound !== null && isTargetActive.value) {
      applyCollected(bound)
      drainRejectedOps(bound)
    }
  })
  const rebindProjection = (next: string | null): void => {
    const current = subscribedWorkflowId.value
    if (current === next) return
    clearCanvasStaleness()
    if (current !== null) {
      projection.unbind(current)
      reportPendingFrames(current, 'discarded', NOTHING_APPLIED)
    }
    if (next !== null) projection.bind(next, bridge.follower)
    subscribedWorkflowId.value = next
  }
  // The bound workflow whose tab went inactive while the sender still held
  // batches for it. A tab switch pauses the subscription without rebinding
  // the session, so those batches are held rather than aborted (see
  // ADR-CRDT-WRITE-0035); anything else that moves the binding releases
  // them into the normal abort path.
  let heldForWorkflowId: string | null = null
  const releaseHeldOps = (): void => {
    heldForWorkflowId = null
    sender.resume()
  }
  const resumeHeldOpsIfSubscribed = (): void => {
    if (
      heldForWorkflowId !== null &&
      bridge.subscribedWorkflowId === heldForWorkflowId
    ) {
      releaseHeldOps()
    }
  }
  const holdOpsForInactiveTab = (workflowId: string): void => {
    heldForWorkflowId = workflowId
    sender.suspend()
    bridge.unsubscribe()
  }
  // Flush first: an edit admitted this tick is pinned to the doc still bound
  // here, and the coalescer's deferred flush would otherwise find it unbound.
  // Then drive the bridge's intent and give the sender the same eager signal
  // the refusal branch gets: `reconcile()` clears send reality synchronously
  // when the desired doc changes, and a batch minted for the old doc would
  // otherwise wait out the 10 s result-silence window before noticing. The
  // one exception is the workflow whose ops are held: its subscribe may not
  // have left a closed socket yet, so the abort waits for the ack instead.
  const retarget = (next: string | null): void => {
    sender.flush()
    if (next === null) bridge.unsubscribe()
    else bridge.subscribe(next)
    if (next !== null && next === heldForWorkflowId) {
      resumeHeldOpsIfSubscribed()
      return
    }
    releaseHeldOps()
    sender.abortIfUnbound()
  }

  // A tab switch keeps the projection bound: whatever the doc collects while
  // the tab is away is applied on return, instead of the live graph being
  // rebuilt from the whole doc over the human's edits.
  const deactivateTarget = (
    next: string | null,
    previousWorkflowId: string | null
  ): void => {
    if (next !== null) initialBind = false
    if (next !== null && next === previousWorkflowId) {
      if (connected.value || canvasMayBeStale.value) markCanvasStale()
      connected.value = false
      holdOpsForInactiveTab(next)
      return
    }
    connected.value = false
    rebindProjection(null)
    retarget(null)
  }

  const restorePersistedTarget = (justActivated: boolean): void => {
    const persisted = initialBind ? lifecycle.readPersistedDocId() : null
    initialBind = false
    if (persisted === null) {
      lifecycle.clearPersistedDocId()
      rebindProjection(null)
      retarget(null)
      return
    }
    recordDevEvent('rebind', { workflowId: persisted })
    rebindProjection(persisted)
    retarget(persisted)
    if (justActivated) applyCollected(persisted)
  }

  type TargetSnapshot = [string | null | undefined, boolean | undefined]
  const isActivationEdge = (
    active: boolean,
    previous: TargetSnapshot | undefined
  ): boolean => active && previous?.[1] === false
  const acknowledgesFollowedDoc = (
    next: string | null,
    active: boolean,
    justActivated: boolean
  ): boolean =>
    active &&
    !justActivated &&
    next !== null &&
    next === subscribedWorkflowId.value

  const activateTarget = (next: string, justActivated: boolean): void => {
    initialBind = false
    rebindProjection(next)
    retarget(next)
    drainRejectedOps(next)
    if (justActivated) applyCollected(next)
  }

  watch(
    [workflowId, isTargetActive],
    ([next, active], previous: TargetSnapshot | undefined) => {
      const justActivated = isActivationEdge(active, previous)
      if (acknowledgesFollowedDoc(next, active, justActivated)) return
      lifecycle.clearForRetarget()
      terminal.value = null
      pendingLiveNodeIds.clear()
      if (!active) {
        deactivateTarget(next, previous?.[0] ?? null)
        return
      }
      connected.value = false
      if (next === null) {
        restorePersistedTarget(justActivated)
        return
      }
      activateTarget(next, justActivated)
    },
    { immediate: true }
  )

  onScopeDispose(() => {
    // Teardown must be total. Anything that survives would apply every later
    // update twice after a remount.
    runFollowerTeardown([
      () => lifecycle.destroy(),
      () => stopTransportStatus(),
      () => bridge.removeEventListener('doc_subscribed', onSubscribed),
      () => bridge.removeEventListener('doc_update', onUpdate),
      () => bridge.removeEventListener('doc_ops_result', onOpsResult),
      () => bridge.removeEventListener('doc_reset', onDocReset),
      () => bridge.removeEventListener('follower_replaced', onFollowerReplaced),
      () => bridge.removeEventListener('schema_error', onSchemaError),
      () => bridge.removeEventListener('doc_gap', onGap),
      () => bridge.removeEventListener('doc_stale', onStale),
      () => bridge.removeEventListener('doc_subscribe_sent', onSubscribeSent),
      () => bridge.removeEventListener('doc_reseed_result', onReseedResult),
      () => sender.detach(),
      () => pendingRejected.clear(),
      () => coalescer.detach(),
      () => {
        for (const workflowId of pendingProjectionFrames.keys())
          reportPendingFrames(workflowId, 'discarded', NOTHING_APPLIED)
        projection.destroy()
      },
      () => bridge.destroy(),
      () => client.destroy()
    ])
  })

  const status = computed<AgentCrdtStatus>(() => ({
    enabled: true,
    connected: connected.value,
    canvasMayBeStale: canvasMayBeStale.value,
    workflowId: subscribedWorkflowId.value,
    terminal: terminal.value,
    updatesApplied: updatesApplied.value,
    lastFrameType: lastFrameType.value,
    outcomes: outcomes.value
  }))

  const debugSnapshot = (): CrdtDebugSnapshot =>
    readCrdtSnapshot(bridge.follower.doc, {
      status: status.value,
      tabId,
      lastSeq: bridge.lastSequence,
      schemaError: bridge.lastSchemaError?.message ?? null
    })

  return {
    status: readonly(status),
    debugSnapshot,
    enqueueHumanOperations: (operations: GraphOperation[]) => {
      const sentAdds = sentAddsToCurrentDoc()
      for (const operation of operations)
        if (operation.op === 'add_node') sentAdds.add(String(operation.node_id))
      projection.noteLocalWrites(operations)
      coalescer.enqueue(operations)
    },
    docInputNames: (nodeId: NodeId) =>
      readDocSlotNames(bridge.follower.doc, String(nodeId), 'inputs'),
    docWidgetValue: (nodeId: NodeId, widgetName: string) =>
      readDocWidgetValue(bridge.follower.doc, String(nodeId), widgetName),
    docPromotedWidgets: (nodeId: NodeId) =>
      readDocPromotedWidgets(bridge.follower.doc, String(nodeId)),
    mayWritePromotedHost: (nodeId: NodeId) =>
      bridge.isSubscribeBaselineIntegrated ||
      (sentAddsToCurrentDoc().has(String(nodeId)) &&
        readDocPromotedWidgets(bridge.follower.doc, String(nodeId)) === null),
    docHasSubgraphDefinition: (definitionId: string) =>
      readSubgraphDefinitionIds(bridge.follower.doc).includes(definitionId),
    notifyWidgetWriteRefused: (nodeId: string | number, widgetName: string) =>
      rejectedOpNotifier.notifyWidgetWriteRefused(nodeId, widgetName),
    subscriptionSent: () =>
      bridge.subscribedWorkflowId !== null &&
      bridge.subscribedWorkflowId === subscribedWorkflowId.value
  }
}

function docSchemaSkew(found: unknown): 'newer' | 'older' | null {
  if (typeof found !== 'number' || !Number.isInteger(found) || found <= 0)
    return null
  if (found > SCHEMA_VERSION) return 'newer'
  if (found < SCHEMA_VERSION) return 'older'
  return null
}
