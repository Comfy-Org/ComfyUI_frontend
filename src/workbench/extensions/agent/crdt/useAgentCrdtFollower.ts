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

import type { Op } from '@comfyorg/comfy-multi-player'

import type { LGraph } from '@/lib/litegraph/src/litegraph'
import { reportError } from '@/platform/telemetry/reportError'
import { api } from '@/scripts/api'
import { parseNodeId } from '@/types/nodeId'
import type { NodeId } from '@/types/nodeId'
import { createUuidv4 } from '@/utils/uuid'
import { useAgentPanelStore } from '@/workbench/extensions/agent/stores/agent/agentPanelStore'

import type {
  AgentCrdtOutcomeCounters,
  AgentCrdtStatus
} from './agentCrdtStatus'
import {
  AgentCrdtDocLifecycle,
  STALE_AFTER_MS,
  SUBSCRIBE_CATCHUP_GRACE_MS
} from './agentCrdtDocLifecycle'
import { AgentCrdtProjection } from './agentCrdtProjection'
import type { DocNodeDelta } from './agentCrdtProjection'
import { apiTransport, createLoggedTransport } from './agentCrdtTransport'
import { recordDevEvent } from './devPanelLog'
import type { CrdtDebugSnapshot } from './crdtSnapshot'
import { readCrdtSnapshot } from './crdtSnapshot'
import { DocFrameClient } from './docFrameClient'
import { RESEED_CONFLICT, isRetryableReseedCode } from './docFrameCodes'
import type { GraphOperation } from './graphOperations'
import type { ClassifiedDocUpdate } from './layoutFollowerBridge'
import { LayoutFollowerBridge } from './layoutFollowerBridge'
import type { LiveGraphApplierDeps } from './liveGraphApplier'
import { readDocPromotedWidgets } from './agentSubgraphDefinitions'
import { readDocSlotNames } from './liveGraphApplier'
import { createOpCoalescer } from './opCoalescer'
import { createOpSender } from './opSender'
import type { BatchOutcome, OpsResultView } from './opSender'
import { createRejectedOpNotifier } from './rejectedOpNotice'

export { apiTransport, STALE_AFTER_MS, SUBSCRIBE_CATCHUP_GRACE_MS }

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
  const isLiveAgentUpdate =
    !update.catchUp && update.actor?.startsWith('agent:') === true
  if (isLiveAgentUpdate) {
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
    isLiveAgentUpdate ? update.actor : undefined,
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

export interface AgentCrdtFollowerEvents {
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

export type AgentCrdtApplierDeps = Omit<
  LiveGraphApplierDeps,
  'getGraph' | 'holdsLocalWrite'
>

function reportRejectedHumanOps(
  workflowId: string | null,
  ops: readonly Op[],
  result: OpsResultView
): void {
  const settled = new Set([...result.applied, ...result.skipped])
  const rejected = ops.filter((op) => !settled.has(op.op_id))
  const { failed } = result
  reportError(
    new Error(
      `The doc host rejected ${rejected.length} local edit(s): ${failed?.message ?? 'no diagnostics'}`
    ),
    {
      surface: 'agent',
      errorType: 'agent_crdt_human_ops_rejected',
      context: {
        workflowId,
        opId: failed?.op_id ?? rejected[0]?.op_id,
        code: failed?.code,
        rejectedOps: rejected.map((op) => op.op)
      }
    }
  )
}

export function useAgentCrdtFollower(
  workflowId: Ref<string | null>,
  userId: () => string | null = () => null,
  isTargetActive: Ref<boolean> = ref(true),
  /**
   * Live graph the document is applied to. Reactive reads inside the getter
   * are tracked, so a `null` → graph flip syncs the graph from the document
   * without waiting for the next remote frame.
   */
  getGraph: () => LGraph | null = () => null,
  events: AgentCrdtFollowerEvents = {},
  applierDeps: AgentCrdtApplierDeps = {},
  canvasFor: (workflowId: string) => Record<string, unknown> | null = () => null
) {
  const productGate = useAgentPanelStore()
  const follower = shallowRef<ReturnType<typeof startAgentCrdtFollower>>()
  const disabledStatus: AgentCrdtStatus = {
    enabled: false,
    connected: false,
    workflowId: null,
    updatesApplied: 0,
    lastFrameType: null,
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
        startAgentCrdtFollower(
          workflowId,
          userId,
          isTargetActive,
          getGraph,
          events,
          applierDeps,
          canvasFor
        )
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
    docPromotedWidgets: (nodeId: NodeId) =>
      follower.value?.docPromotedWidgets(nodeId) ?? null
  }
}

function startAgentCrdtFollower(
  workflowId: Ref<string | null>,
  userId: () => string | null,
  isTargetActive: Ref<boolean>,
  getGraph: () => LGraph | null,
  events: AgentCrdtFollowerEvents,
  applierDeps: AgentCrdtApplierDeps,
  canvasFor: (workflowId: string) => Record<string, unknown> | null
) {
  const connected = ref(false)
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

  const client = new DocFrameClient(createLoggedTransport())
  const bridge = new LayoutFollowerBridge(client)
  const lifecycle = new AgentCrdtDocLifecycle(
    () => subscribedWorkflowId.value,
    () => bridge.resubscribe(),
    () => {
      connected.value = false
    }
  )
  const tabId = createUuidv4()
  const ownActor = (): string => `human:${userId() ?? 'anonymous'}:${tabId}`
  // Doc node ids whose human delete the host has applied but whose effect
  // frame has not yet removed them from the doc. Kept pending for the
  // reconcile so the result-to-effect window cannot resurrect them.
  const confirmedDeletes = new Set<string>()
  const rejectedOpNotifier = createRejectedOpNotifier()
  const projection = new AgentCrdtProjection(getGraph, applierDeps)
  const pendingRejected = new Map<string, Op[]>()

  const applyRejectedOps = (
    workflowId: string,
    rejected: readonly Op[]
  ): boolean => {
    if (getGraph() === null) return false
    reportMaterialized(
      workflowId,
      projection.revertRejected(workflowId, rejected)
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
    if (outcome.result.failed)
      reportRejectedHumanOps(workflowId, outcome.ops, outcome.result)
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
    if (!applyRejectedOps(workflowId, rejected))
      pendingRejected.set(workflowId, [
        ...(pendingRejected.get(workflowId) ?? []),
        ...rejected
      ])
  }

  const settleHumanOps = (outcome: BatchOutcome) => {
    if (outcome.state === 'acknowledged') trackAcknowledgedDeletes(outcome)
    recordDevEvent('human_ops_settled', outcome)
    projection.settleLocalWrites(outcome.ops)
    if (outcome.state === 'acknowledged' && !outcome.result.ok)
      revertRejectedOps(outcome)
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
    tab: tabId,
    actor: ownActor,
    baseVersion: () => bridge.lastSequence,
    onBatchSettled: settleHumanOps
  })
  const coalescer = createOpCoalescer(sender.admit, sender.flush)

  const pendingLiveNodeIds = new Set<NodeId>()
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
  const applyCollected = (workflowId: string): void => {
    reportMaterialized(workflowId, projection.applyCollected(workflowId))
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
  const applyFrame = (
    update: ClassifiedDocUpdate
  ): { created: NodeId[]; nodes: DocNodeDelta } => {
    if (isOwnEcho(update) && getGraph() !== null) {
      const nodes = projection.discardPending(update.workflowId)
      incrementOutcome('skipped')
      return { created: [], nodes }
    }
    const outcome = projection.applyFrame(update)
    incrementOutcome(outcome.applied ? 'applied' : 'skipped')
    if (outcome.applied && !update.catchUp) incrementOutcome('appliedLive')
    return {
      created: outcome.applied ? outcome.createdNodeIds : [],
      nodes: outcome.nodes
    }
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
  }

  function handleRejectedSubscription(
    detail: {
      workflowId?: unknown
      ok?: unknown
      code?: unknown
      message?: unknown
    } | null
  ) {
    const refusal = tryReseed()
      ? { shouldNotify: false }
      : handleSubscribeRefusal(detail, lifecycle)
    releaseHeldOps()
    sender.abortIfUnbound()
    if (refusal.shouldNotify)
      events.onSyncError?.(refusal.message, refusal.code)
  }

  const onSubscribed: EventListener = (event) => {
    if (!(event instanceof CustomEvent)) return
    if (!isTargetActive.value) return
    const detail = event.detail as {
      ok?: unknown
      code?: unknown
      message?: unknown
    } | null
    const ok = detail?.ok === true
    connected.value = ok
    lastFrameType.value = event.type
    recordDevEvent('doc_subscribed', event.detail ?? null)
    if (ok) {
      lifecycle.onSubscribeConfirmed()
      resumeHeldOpsIfSubscribed()
    } else {
      handleRejectedSubscription(detail)
    }
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
    const { created, nodes } = applyFrame(update)
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
    if (
      !isTargetActive.value ||
      detail?.workflowId !== subscribedWorkflowId.value
    )
      return
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
    sender.abortAll()
    events.onReset?.(detail.workflowId)
    connected.value = false
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
      projection.bind(workflowId, bridge.follower)
    }
  }
  const onSchemaError: EventListener = (event) => {
    // KA-11 fail-closed: the bridge refused to propagate an unreadable doc, so
    // nothing was projected. Surface it as its own status rather than as a
    // generic "disconnected", which is indistinguishable from "never connected".
    connected.value = false
    lastFrameType.value = event.type
    lifecycle.clearStaleProbe()
    const detail =
      event instanceof CustomEvent
        ? (event.detail as { workflowId?: string } | null)
        : null
    if (detail?.workflowId !== undefined)
      projection.discardPending(detail.workflowId)
    outcomes.value = { ...outcomes.value, errored: outcomes.value.errored + 1 }
    recordDevEvent(
      'schema_error',
      event instanceof CustomEvent ? (event.detail ?? null) : null
    )
  }
  const onGap: EventListener = (event) => {
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
  const onReconnected: EventListener = () => {
    connected.value = false
    lifecycle.onReconnected()
    recordDevEvent('reconnected', null)
    bridge.reconnect()
  }
  /**
   * Re-drive subscription intent whenever the socket may have become usable.
   *
   * `reconnected` fires only on a RE-connect (`api.ts` guards the dispatch with
   * `isReconnect`), so it can never repair a follower that mounted while the
   * first socket was still being opened — `createSocket` awaits an auth token
   * before `new WebSocket(...)`, and a panel mounted inside that window used to
   * stay inert forever. The ComfyUI server sends a `status` frame immediately
   * on every accepted connection, first one included, so it is the earliest
   * signal available that the socket can now carry a frame. `reconcile()` is a
   * no-op once intent and reality agree, so the extra `status` traffic costs
   * nothing unless a refused subscribe has a scheduled retry. In that case,
   * the retry timer owns the next attempt and its backoff.
   */
  const onSocketActivity: EventListener = () => {
    if (lifecycle.shouldDeferSubscribe()) return
    bridge.reconcile()
    resumeHeldOpsIfSubscribed()
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
  api.addEventListener('reconnected', onReconnected)
  api.addEventListener('status', onSocketActivity)

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
    if (current !== null) projection.unbind(current)
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
      holdOpsForInactiveTab(next)
      return
    }
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

  const activateTarget = (next: string, justActivated: boolean): void => {
    initialBind = false
    rebindProjection(next)
    retarget(next)
    drainRejectedOps(next)
    if (justActivated) applyCollected(next)
  }

  watch(
    [workflowId, isTargetActive],
    (
      [next, active],
      previous: [string | null | undefined, boolean | undefined] | undefined
    ) => {
      // Only the inactive->active edge, and never the `immediate` first run
      // (`previous` is undefined there): a plain mount or retarget has no
      // collected changes to apply, the graph watcher covers readiness.
      const justActivated = active && previous?.[1] === false
      lifecycle.clearForRetarget()
      connected.value = false
      pendingLiveNodeIds.clear()
      if (!active) {
        deactivateTarget(next, previous?.[0] ?? null)
        return
      }
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
      () => api.removeEventListener('reconnected', onReconnected),
      () => api.removeEventListener('status', onSocketActivity),
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
      () => rejectedOpNotifier.cancel(),
      () => pendingRejected.clear(),
      () => coalescer.detach(),
      () => projection.destroy(),
      () => bridge.destroy(),
      () => client.destroy()
    ])
  })

  const status = computed<AgentCrdtStatus>(() => ({
    enabled: true,
    connected: connected.value,
    workflowId: subscribedWorkflowId.value,
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
      projection.noteLocalWrites(operations)
      coalescer.enqueue(operations)
    },
    docInputNames: (nodeId: NodeId) =>
      readDocSlotNames(bridge.follower.doc, String(nodeId), 'inputs'),
    docPromotedWidgets: (nodeId: NodeId) =>
      readDocPromotedWidgets(bridge.follower.doc, String(nodeId))
  }
}
