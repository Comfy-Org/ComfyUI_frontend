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
import type { DocOpsResult } from './docFrameClient'
import type { GraphOperation } from './graphOperations'
import type { ClassifiedDocUpdate } from './layoutFollowerBridge'
import { LayoutFollowerBridge } from './layoutFollowerBridge'
import type {
  LiveGraphApplierDeps,
  RemoteApplyContext
} from './liveGraphApplier'
import { readDocSlotNames } from './liveGraphApplier'
import { createOpCoalescer } from './opCoalescer'
import { createOpSender } from './opSender'
import type { OpsResultView } from './opSender'
import type { PendingLocalEdits } from './pendingLocalEdits'
import { collectPendingLocalEdits, docReflects } from './pendingLocalEdits'

export { apiTransport, STALE_AFTER_MS, SUBSCRIBE_CATCHUP_GRACE_MS }

/**
 * s5-metrics-1: per-outcome counters for every `doc_update` the composable's
 * listeners observe, replacing the single overloaded `updatesApplied`
 * observable. Each counter increments exactly once, at the boundary where
 * that outcome is decided — never inferred after the fact. `received` counts
 * only frames the bridge re-dispatched as `doc_update`, so
 * `received === applied + skipped` always holds; `errored`, `gap` and
 * `dropped` are disjoint from it because the bridge returns before
 * re-dispatching in each of those cases (schema gate, FEB-2 seq jump,
 * stale/duplicate discard). Frames the bridge drops for a workflowId other
 * than its `sentWorkflowId` emit no event and are not counted anywhere.
 * `applied` is tracked independently of `bridge.follower.updatesApplied`
 * (which counts Yjs merges, including frames this composable skips) so a
 * divergence between the two is visible instead of hidden behind one number.
 * No payload bodies or actor identifiers are recorded here — see
 * `recordDevEvent` call sites for the (dev-only) frame detail surface.
 */
interface AgentCrdtOutcomeCounters {
  /** Every `doc_update` event the composable's listener was invoked with. */
  received: number
  /** Passed this composable's own filter and the adapter had a bound session to apply it to. */
  applied: number
  /**
   * PM-1575: same as `applied`, excluding a subscribe's own catch-up frame
   * (`update.catchUp`) -- the one-time state-vector sync that lands whenever
   * a workflow is (re)subscribed to, unrelated to any in-flight tool call.
   * `applied` alone is unusable as a canvas-sync gate for that reason: a tool
   * call's baseline, captured before that catch-up lands, would otherwise
   * read the catch-up itself as "the matching update already arrived" for
   * whichever tool call happens to be first after a (re)subscribe. Consumers
   * that need "did a LIVE update land" (agentEventTransport.ts's canvas-sync
   * baseline) must read this field, not `applied`.
   */
  appliedLive: number
  /** Received but not applied: inactive target, workflow mismatch, or no bound adapter session. */
  skipped: number
  /** The merged doc failed the KA-11 read gate (`schema_error`). */
  errored: number
  /** A seq jump was detected upstream; the frame was withheld and a resubscribe forced (`doc_gap`). */
  gap: number
  /** An explicit lineage break (`doc_reset`). */
  reset: number
  /** A stale/duplicate frame the bridge discarded before it became a `doc_update` event (`doc_stale`). */
  dropped: number
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

export interface AgentCrdtStatus {
  enabled: boolean
  connected: boolean
  workflowId: string | null
  /**
   * Mirror of `bridge.follower.updatesApplied` (Yjs merges, reset to 0 on
   * `doc_reset` / `follower_replaced`). Not interchangeable with
   * `outcomes.applied`, which is monotonic and counts only frames that passed
   * this composable's filter. Kept for AgentPanelRoot.vue and CrdtDevPanel.vue.
   */
  updatesApplied: number
  lastFrameType: string | null
  outcomes: AgentCrdtOutcomeCounters
}

export interface AgentCrdtFollowerEvents {
  onMaterialized?: (event: {
    workflowId: string
    actor: string | undefined
    nodeIds: readonly NodeId[]
  }) => void
  onReset?: (workflowId: string) => void
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
        errorType: 'failure_tearing_down_agent_crdt_follower'
      })
    }
  }
}

export type AgentCrdtApplierDeps = Omit<LiveGraphApplierDeps, 'getGraph'>

function reportRejectedHumanOps(
  workflowId: string | null,
  ops: readonly Op[],
  result: OpsResultView
): void {
  const settled = new Set([...result.applied, ...result.skipped])
  const rejected = ops.filter((op) => !settled.has(op.op_id))
  const { failure } = result
  reportError(
    new Error(
      `The doc host rejected ${rejected.length} local edit(s): ${failure?.message ?? 'no diagnostics'}`
    ),
    {
      errorType: 'agent_crdt_human_ops_rejected',
      context: {
        workflowId,
        opId: failure?.op_id ?? rejected[0]?.op_id,
        code: failure?.code,
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
  applierDeps: AgentCrdtApplierDeps = {}
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
          applierDeps
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
      follower.value?.docInputNames(nodeId) ?? null
  }
}

function startAgentCrdtFollower(
  workflowId: Ref<string | null>,
  userId: () => string | null,
  isTargetActive: Ref<boolean>,
  getGraph: () => LGraph | null,
  events: AgentCrdtFollowerEvents,
  applierDeps: AgentCrdtApplierDeps
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
  // Human ops the host has applied but whose effect frame has not yet reached
  // the doc. Still pending for a full sync, so the result-to-effect window
  // can neither resurrect a deleted node nor drop an added one.
  let acknowledgedOps: Op[] = []
  const sender = createOpSender({
    sendOps: (target, tab, ops) => client.sendOps(target, tab, ops),
    onOpsResult(listener) {
      const handler: EventListener = (event) => {
        if (!(event instanceof CustomEvent)) return
        const detail = event.detail as DocOpsResult
        listener({
          workflowId: detail.workflowId,
          ok: detail.ok,
          applied: detail.applied,
          skipped: detail.skipped,
          ...(detail.failed ? { failure: detail.failed } : {})
        })
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
    onBatchSettled: (outcome) => {
      recordDevEvent('human_ops_settled', outcome)
      if (outcome.state !== 'acknowledged') return
      const applied = new Set(outcome.result.applied)
      acknowledgedOps.push(...outcome.ops.filter((op) => applied.has(op.op_id)))
      if (outcome.result.ok) return
      const workflowId =
        outcome.result.workflowId ?? bridge.subscribedWorkflowId
      reportRejectedHumanOps(workflowId, outcome.ops, outcome.result)
      // The rejected edits are no longer pending, so the doc is the graph's
      // whole truth again: put the live graph back on it.
      if (workflowId !== null) syncAndReportPending(workflowId)
    }
  })
  const pendingHumanEdits = (workflowId: string): PendingLocalEdits => {
    const doc = bridge.follower.doc
    acknowledgedOps = acknowledgedOps.filter((op) => !docReflects(doc, op))
    const inFlight = sender
      .pendingOps()
      .filter((batch) => batch.workflowId === workflowId)
      .flatMap((batch) => batch.ops)
    return collectPendingLocalEdits([...acknowledgedOps, ...inFlight])
  }
  const projection = new AgentCrdtProjection(getGraph, applierDeps, {
    pendingEdits: pendingHumanEdits
  })
  const coalescer = createOpCoalescer(sender.admit, sender.flush)

  const pendingLiveNodeIds = new Set<NodeId>()
  const syncAndReportPending = (workflowId: string): void => {
    const materialized = projection.syncFromDoc(workflowId)
    emitPendingMaterializations(
      workflowId,
      undefined,
      new Set(materialized),
      pendingLiveNodeIds,
      events
    )
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
    if (isOwnEcho(update)) {
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

  const onSubscribed: EventListener = (event) => {
    if (!(event instanceof CustomEvent)) return
    if (!isTargetActive.value) return
    const ok = event.detail?.ok === true
    connected.value = ok
    lastFrameType.value = event.type
    recordDevEvent('doc_subscribed', event.detail ?? null)
    if (ok) {
      lifecycle.onSubscribeConfirmed()
      resumeHeldOpsIfSubscribed()
    } else {
      lifecycle.onSubscribeRefused()
      // FE #16637 residual: a refusal is the earliest signal the sender can
      // get that its in-flight batch's doc is gone — don't make it wait out
      // the 10 s result-silence window to notice on its own.
      releaseHeldOps()
      sender.abortIfUnbound()
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
        ? (event.detail as {
            workflowId?: string
            actor?: string
            seq?: number
          })
        : undefined
    incrementOutcome('reset')
    if (!isCurrentWorkflow(detail?.workflowId)) return
    const context: RemoteApplyContext = {
      actor: detail.actor ?? 'agent-reset',
      opIds: [`doc-reset:${detail.seq ?? 'unknown'}`]
    }
    projection.clearForReset(detail.workflowId, context)
    sender.abortAll()
    events.onReset?.(detail.workflowId)
    connected.value = false
    updatesApplied.value = 0
    lastFrameType.value = event.type
    lifecycle.clearStaleProbe()
    pendingLiveNodeIds.clear()
    acknowledgedOps = []
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
      acknowledgedOps = []
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
    bridge.resubscribe()
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
  // still see no subscribed workflow. Activation is therefore reconciled at
  // the bind site instead, once the binding actually exists.
  watch(getGraph, (graph) => {
    const bound = subscribedWorkflowId.value
    if (graph && bound !== null && isTargetActive.value) {
      syncAndReportPending(bound)
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

  const deactivateTarget = (
    next: string | null,
    previousWorkflowId: string | null
  ): void => {
    if (next !== null) initialBind = false
    rebindProjection(null)
    if (next !== null && next === previousWorkflowId)
      holdOpsForInactiveTab(next)
    else retarget(null)
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
    if (justActivated) syncAndReportPending(persisted)
  }

  const activateTarget = (next: string, justActivated: boolean): void => {
    initialBind = false
    rebindProjection(next)
    retarget(next)
    if (justActivated) syncAndReportPending(next)
  }

  watch(
    [workflowId, isTargetActive],
    (
      [next, active],
      previous: [string | null | undefined, boolean | undefined] | undefined
    ) => {
      // Only the inactive->active edge, and never the `immediate` first run
      // (`previous` is undefined there), so a plain mount or retarget keeps its
      // existing "reconcile on frame or on graph readiness" behaviour.
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
      () => sender.detach(),
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
    enqueueHumanOperations: (operations: GraphOperation[]) =>
      coalescer.enqueue(operations),
    docInputNames: (nodeId: NodeId) =>
      readDocSlotNames(bridge.follower.doc, String(nodeId), 'inputs')
  }
}
