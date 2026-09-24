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
import { isEqual } from 'es-toolkit'
import * as Y from 'yjs'

import { nodesMap } from '@comfyorg/comfy-multi-player'
import type { Op } from '@comfyorg/comfy-multi-player'

import { st } from '@/i18n'
import { reportError } from '@/platform/telemetry/reportError'
import { useToastStore } from '@/platform/updates/common/toastStore'
import { api } from '@/scripts/api'
import type { RemoteMutationContext } from '@/types/graphMutationContext'
import { parseNodeId } from '@/types/nodeId'
import type { NodeId } from '@/types/nodeId'
import { createUuidv4 } from '@/utils/uuid'
import { useAgentPanelStore } from '@/workbench/extensions/agent/stores/agent/agentPanelStore'

import type { MaterializableGraph } from './agentNodeMaterializer'
import {
  AgentCrdtDocLifecycle,
  STALE_AFTER_MS,
  SUBSCRIBE_CATCHUP_GRACE_MS
} from './agentCrdtDocLifecycle'
import { AgentCrdtProjection } from './agentCrdtProjection'
import { apiTransport, createLoggedTransport } from './agentCrdtTransport'
import { recordDevEvent } from './devPanelLog'
import type { CrdtDebugSnapshot } from './crdtSnapshot'
import { readCrdtSnapshot } from './crdtSnapshot'
import { DocFrameClient } from './docFrameClient'
import type { MutationsForTarget } from './ecsFollowerAdapter'
import type { GraphOperation } from './graphOperations'
import type { ClassifiedDocUpdate } from './layoutFollowerBridge'
import { LayoutFollowerBridge } from './layoutFollowerBridge'
import type { ValidatedLinkEndpoints } from './linkTuple'
import { readLinkTuple, validateLinkEndpoints } from './linkTuple'
import { createOpCoalescer } from './opCoalescer'
import type { OpsResultView } from './opSender'
import { createOpSender } from './opSender'
import type { WithLayoutActor } from './pendingOpRevert'
import {
  applyPendingOpRevert,
  createPendingRevertNodeRegistry,
  createRevertNotifier
} from './pendingOpRevert'
import {
  ALREADY_CURRENT_RETRY_INTERVAL_MS,
  createPendingCorrelation
} from './pendingCorrelation'
import type { PendingOpTrackerEvent } from './pendingOpTracker'
import {
  LEDGER_SETTLE_TIMEOUT_MS,
  createPendingOpTracker
} from './pendingOpTracker'

export {
  ALREADY_CURRENT_RETRY_INTERVAL_MS,
  apiTransport,
  LEDGER_SETTLE_TIMEOUT_MS,
  STALE_AFTER_MS,
  SUBSCRIBE_CATCHUP_GRACE_MS
}

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
interface DocResetDetail {
  workflowId?: string
  actor?: string
  seq?: number
}

interface AgentCrdtOutcomeCounters {
  /** Every `doc_update` event the composable's listener was invoked with. */
  received: number
  /** Passed this composable's own filter and the adapter had a bound session to apply it to. */
  applied: number
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
  graph: MaterializableGraph | null
): NodeId[] {
  if (!graph) return []
  return added.flatMap((id) => {
    const nodeId = parseNodeId(id)
    return nodeId && graph._nodes_by_id[nodeId] ? [nodeId] : []
  })
}

function updateNodeIds(update: Uint8Array): NodeId[] {
  try {
    return Y.decodeUpdate(update).structs.flatMap((struct) => {
      if (!(struct instanceof Y.Item)) return []
      if (
        String(struct.parent) !== 'nodes' ||
        typeof struct.parentSub !== 'string'
      )
        return []
      const nodeId = parseNodeId(struct.parentSub)
      return nodeId ? [nodeId] : []
    })
  } catch {
    return []
  }
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
  added: readonly string[],
  materialized: readonly NodeId[],
  graph: MaterializableGraph | null,
  pendingLiveNodeIds: Set<NodeId>,
  events: AgentCrdtFollowerEvents
): void {
  const isLiveAgentUpdate =
    !update.catchUp && update.actor?.startsWith('agent:') === true
  if (isLiveAgentUpdate) {
    if (update.update instanceof Uint8Array) {
      for (const nodeId of updateNodeIds(update.update))
        pendingLiveNodeIds.add(nodeId)
    }
    for (const nodeId of materialized) pendingLiveNodeIds.add(nodeId)
    for (const id of added) {
      const nodeId = parseNodeId(id)
      if (nodeId) pendingLiveNodeIds.add(nodeId)
    }
  }
  const available = new Set([
    ...materialized,
    ...liveAddedNodeIds(added, graph)
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

function addNodeEffectPresent(
  doc: Y.Doc,
  op: Extract<Op, { op: 'add_node' }>
): boolean {
  const node = nodesMap(doc).get(String(op.node_id))
  if (!node) return false
  const docType = node.get('type')
  if (docType === op.class_type) return true
  reportError(
    new Error('Delivery-unknown add_node collided with an unrelated doc node'),
    {
      errorType: 'agent_crdt_node_id_collision',
      context: {
        nodeId: String(op.node_id),
        opType: op.class_type,
        docType
      }
    }
  )
  return false
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}

function readNumberField(
  record: Record<string, unknown>,
  key: string
): number | undefined {
  const value = record[key]
  return typeof value === 'number' ? value : undefined
}

/** Narrows a `doc_subscribed` event's `detail` without casting it. */
function readSubscribedAckDetail(detail: unknown): {
  seq: number | undefined
} {
  if (!isRecord(detail)) return { seq: undefined }
  return { seq: readNumberField(detail, 'seq') }
}

function deleteNodeEffectPresent(
  doc: Y.Doc,
  op: Extract<Op, { op: 'delete_node' }>
): boolean {
  return !nodesMap(doc).has(String(op.node_id))
}

function connectEndpointsMatch(
  link: ValidatedLinkEndpoints,
  op: Extract<Op, { op: 'connect' }>
): boolean {
  const originMatches =
    link.originId === String(op.from_node) && link.originSlot === op.from_slot
  const targetMatches = link.targetId === String(op.to_node)
  const slotMatches = op.to_slot == null || link.targetSlot === op.to_slot
  return originMatches && targetMatches && slotMatches
}

function connectEffectPresent(
  doc: Y.Doc,
  op: Extract<Op, { op: 'connect' }>
): boolean {
  const tuple = readLinkTuple(doc, String(op.link_id))
  const link = tuple && validateLinkEndpoints(tuple)
  if (!link) return false
  return connectEndpointsMatch(link, op) && link.type === op.link_type
}

/**
 * ADR-CRDT-RECONCILE-0035 (a), round 7: `set_widget` presence is the target
 * widget's CURRENT value equalling the op's value — never an unconditional
 * clear, since last-writer-wins does not make an arbitrary document value
 * proof that THIS op landed. Reads the raw `nodes`/`widgets` Y.Maps directly
 * (like {@link addNodeEffectPresent}), not the package's `readGraph` snapshot
 * surface, which gates on a readable `meta.schema_version` this hand-built
 * test/merge doc need not carry. Only a top-level write has a target this way
 * at all: an interior (definition-scoped) write's widget lives inside a
 * subgraph definition, which this doc shape doesn't reach, so it stays
 * unresolvable (`null`), exactly like the other {@link UNPROJECTED_OP_KINDS}.
 */
function setWidgetEffectPresent(
  doc: Y.Doc,
  op: Extract<Op, { op: 'set_widget' }>
): boolean | null {
  if (op.path != null && op.path.length > 0) return null
  const node = nodesMap(doc).get(String(op.node_id))
  const widgets = node?.get('widgets')
  if (!(widgets instanceof Y.Map) || !widgets.has(op.widget)) return null
  return isEqual(widgets.get(op.widget), op.value)
}

/**
 * Op kinds `docEffectPresent` has no effect-presence check for yet: `null`
 * leaves a parked entry parked rather than guessing.
 */
type UnprojectedOp = Extract<
  Op,
  {
    op: 'disconnect' | 'define_subgraph' | 'insert_workflow' | 'set_node_field'
  }
>
const UNPROJECTED_OP_KINDS = new Set<Op['op']>([
  'disconnect',
  'define_subgraph',
  'insert_workflow',
  'set_node_field'
])
function isUnprojectedOp(op: Op): op is UnprojectedOp {
  return UNPROJECTED_OP_KINDS.has(op.op)
}

export function useAgentCrdtFollower(
  workflowId: Ref<string | null>,
  graphMutations: MutationsForTarget,
  userId: () => string | null = () => null,
  isTargetActive: Ref<boolean> = ref(true),
  /**
   * Live graph that receives node adapters for store-only records. Reactive
   * reads inside the getter are tracked, so a `null` → graph flip triggers a
   * reconcile without waiting for the next remote frame.
   */
  getGraph: () => MaterializableGraph | null = () => null,
  events: AgentCrdtFollowerEvents = {},
  withLayoutActor: WithLayoutActor = (_actor, fn) => fn()
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
          graphMutations,
          userId,
          isTargetActive,
          getGraph,
          events,
          withLayoutActor
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
      follower.value?.enqueueHumanOperations(operations)
  }
}

function startAgentCrdtFollower(
  workflowId: Ref<string | null>,
  graphMutations: MutationsForTarget,
  userId: () => string | null,
  isTargetActive: Ref<boolean>,
  getGraph: () => MaterializableGraph | null,
  events: AgentCrdtFollowerEvents,
  withLayoutActor: WithLayoutActor
) {
  const connected = ref(false)
  const updatesApplied = ref(0)
  const lastFrameType = ref<string | null>(null)
  const subscribedWorkflowId = ref<string | null>(null)
  const outcomes = ref<AgentCrdtOutcomeCounters>({
    received: 0,
    applied: 0,
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
  const pendingRevertNodes = createPendingRevertNodeRegistry({
    getGraph,
    withLayoutActor
  })
  const notifyReverted = createRevertNotifier((undone) => {
    useToastStore().add({
      severity: 'warn',
      summary: undone
        ? st(
            'toastMessages.agentSyncEditReverted',
            "Your edit couldn't be synced and was undone."
          )
        : st(
            'toastMessages.agentSyncEditFailed',
            "Your edit couldn't be synced."
          ),
      life: 5000
    })
  })
  /**
   * ADR-CRDT-RECONCILE-0035 (a), round 8: the bounded ledger terminal path's
   * `unresolved` event is deliberately NOT a rejection — the entry stays
   * parked and the optimistic projection stays on the canvas — so it gets
   * its own, distinct, non-rejection notification rather than
   * `notifyReverted`'s toast.
   */
  const notifyUnresolved = (event: PendingOpTrackerEvent): void => {
    if (event.type !== 'unresolved') return
    useToastStore().add({
      severity: 'warn',
      summary: st(
        'toastMessages.agentSyncEditUnconfirmed',
        "Your edit couldn't be confirmed as synced."
      ),
      life: 5000
    })
  }
  // Construction order is acyclic: the watermark and tracker exist before
  // anything that reads them, the projection exists before
  // `pendingCorrelation` (which needs its `reconcileFromDoc` as a plain,
  // non-null function — no forward reference, no `projectionRef`), and
  // `pendingCorrelation` closes over `sender` (needed for its
  // reactivation-invalidation seam).
  let projectedSeq: number | null = null
  const pendingOps = createPendingOpTracker({
    // Applied seq only, never the ack fallback: between doc_subscribed(seq=N)
    // and the catch-up doc_update(seq=N) the canvas still shows pre-subscribe
    // state, so a skipped result must park there rather than clear on the ack.
    currentSeq: () => projectedSeq ?? 0,
    onEvent: (event) => {
      notifyReverted(event, applyPendingOpRevert(event, pendingRevertNodes))
      notifyUnresolved(event)
      recordDevEvent('pending_ops', event)
    }
  })
  const sender = createOpSender({
    sendOps: (target, tab, ops) => client.sendOps(target, tab, ops),
    onOpsResult(listener) {
      const handler: EventListener = (event) => {
        if (!(event instanceof CustomEvent)) return
        const detail = event.detail as OpsResultView & { failed?: unknown }
        listener({
          workflowId: detail.workflowId,
          ok: detail.ok,
          applied: detail.applied,
          skipped: detail.skipped,
          ...(typeof detail.seq === 'number' ? { seq: detail.seq } : {}),
          ...(detail.failed && typeof detail.failed === 'object'
            ? { failure: detail.failed }
            : {})
        })
      }
      bridge.addEventListener('doc_ops_result', handler)
      return () => bridge.removeEventListener('doc_ops_result', handler)
    },
    // Send REALITY, not this composable's intent: the sender re-reads it before
    // every send and resend, so ops never reach a doc we are not subscribed to.
    workflowId: () => bridge.subscribedWorkflowId,
    tab: tabId,
    actor: () => `human:${userId() ?? 'anonymous'}:${tabId}`,
    baseVersion: () => bridge.lastSequence,
    onBatchMinted: (ops) => {
      pendingRevertNodes.onBatchMinted(ops)
      pendingOps.onBatchMinted(ops)
    },
    onBatchTransmitted: (ops) => pendingOps.onBatchTransmitted(ops),
    onBatchSettled: (outcome) => {
      recordDevEvent('human_ops_settled', outcome)
      pendingOps.onBatchSettled(outcome)
    }
  })
  const projection = new AgentCrdtProjection<ClassifiedDocUpdate>(
    graphMutations,
    getGraph,
    () => bridge.follower.doc,
    // ADR-CRDT-RECONCILE-0035 (c): an incoming `add` for a node id already
    // registered locally is the page's own accepted-add echo, never a fresh
    // add, exactly when the ledger still holds an `add_node` for that id, of
    // the SAME type, in a state the host can have reflected back already. An
    // indexed lookup, not a scan/clone of every pending entry.
    pendingOps.pendingAddType,
    {
      // The pending-op tracker is the single source of PENDING DELETE IDS —
      // a `delete_node` still queued, in flight, or `applied`-but-not-yet-
      // reflected in the doc (KEEP-ALIVE #9) — replacing the two independent
      // reconstructions (`confirmedDeletes` plus a `sender.pendingOps()`
      // scan) this used to be. The live doc-presence filter on top is a
      // computed READ, not a second source: it stops suppressing an id the
      // instant the doc itself no longer has it, which the ledger's own
      // effect-clearing already does whenever the settling frame's `opIds`
      // names the op, and this is the same guarantee for the rarer case
      // where it doesn't. `workflowId` is compared against `boundWorkflowId`
      // rather than threaded into the tracker itself: this composable only
      // ever binds the tracker to ONE lineage at a time (reset on every
      // lineage change), so a mismatched `workflowId` here can only mean a
      // stale/foreign caller, never a second concurrently-tracked workflow.
      pendingDeletes: (workflowId) => {
        if (awaitingReactivationContinuity || workflowId !== boundWorkflowId)
          return new Set<string>()
        const docNodeIds = currentDocNodeIds()
        const pending = new Set<string>()
        for (const id of pendingOps.pendingDeleteNodeIds()) {
          if (docNodeIds.has(id)) pending.add(id)
        }
        return pending
      },
      // A pending human `add_node`/`connect` — queued through
      // delivery-unknown — that a reactivation's full reconcile must not
      // delete/drop just because the doc does not have it yet.
      //
      // Empty while `awaitingReactivationContinuity` is still true: a
      // catch-up (or any live) frame can reach this reconcile BEFORE the
      // resume's own `doc_subscribed` ack is processed (the bridge already
      // documents that a live frame can outrun its ack), so continuity with
      // what this correlation last projected is not yet established either
      // way. Retaining the ledger's ids against a doc this follower cannot
      // yet vouch for is exactly the risk `pendingCorrelation.ts`'s
      // reactivation-continuity check exists to guard against; until the ack
      // is consumed, "continuity unknown" is treated the same as "continuity
      // not yet established" for THIS reconcile, and the ledger itself is
      // left untouched (never reverted) for the ack to resolve normally once
      // it arrives.
      pendingAdds: () =>
        awaitingReactivationContinuity
          ? new Set<string>()
          : pendingOps.pendingAddNodeIds(),
      pendingConnects: () =>
        awaitingReactivationContinuity
          ? new Set<string>()
          : pendingOps.pendingConnectLinkIds()
    }
  )
  // ADR-CRDT-RECONCILE-0035 (a): owns the pending-op ledger's lineage and its
  // catch-up settlement, INCLUDING the already-current retry timer — see
  // `pendingCorrelation.ts`. Distinct from `boundWorkflowId` below, which the
  // `!active` watch branch nulls on every tab deactivation: the ledger must
  // NOT reset there, only on a lineage break (doc_reset, follower_replaced,
  // or a bind to a workflow other than this one), which `pendingCorrelation`
  // tracks independently of activity.
  const pendingCorrelation = createPendingCorrelation({
    pendingOps,
    getWatermark: () => projectedSeq,
    setWatermark: (seq) => {
      projectedSeq = seq
    },
    reconcileFromDoc: (id, seq) => projection.reconcileFromDoc(id, seq),
    effectPresent: (op) => docEffectPresent(op)
  })
  const coalescer = createOpCoalescer(sender.admit, sender.flush)

  // Dev-panel tap (poc-4): track the doc's node-id set so the panel can show
  // exactly which nodes each doc_update added/removed. Rebuilt from zero on
  // doc_reset (remint) because the lineage broke.
  let knownDocNodeIds: Set<string> = new Set()
  const pendingLiveNodeIds = new Set<NodeId>()
  const currentDocNodeIds = (): Set<string> => {
    try {
      const doc = bridge.follower.doc as unknown as {
        getMap: (k: string) => { toJSON: () => Record<string, unknown> }
      }
      return new Set(Object.keys(doc.getMap('nodes').toJSON()))
    } catch {
      return new Set()
    }
  }
  const reconcileAndReportPending = (workflowId: string): void => {
    const materialized = projection.reconcileLiveGraph(workflowId)
    emitPendingMaterializations(
      workflowId,
      undefined,
      new Set(materialized),
      pendingLiveNodeIds,
      events
    )
  }
  const incrementOutcome = (
    key: 'received' | 'applied' | 'skipped' | 'reset'
  ): void => {
    outcomes.value = { ...outcomes.value, [key]: outcomes.value[key] + 1 }
  }
  const isCurrentWorkflow = (workflowId: unknown): workflowId is string =>
    isTargetActive.value && workflowId === subscribedWorkflowId.value
  const trackNodeChanges = (): string[] => {
    const ids = currentDocNodeIds()
    const added = [...ids].filter((id) => !knownDocNodeIds.has(id))
    const removed = [...knownDocNodeIds].filter((id) => !ids.has(id))
    if (added.length > 0 || removed.length > 0)
      recordDevEvent('doc_nodes_changed', { added, removed })
    for (const id of removed) {
      const nodeId = parseNodeId(id)
      if (nodeId) pendingLiveNodeIds.delete(nodeId)
    }
    knownDocNodeIds = ids
    return added
  }
  const applyAndReconcile = (update: ClassifiedDocUpdate): NodeId[] => {
    // ADR-CRDT-RECONCILE-0035: per-frame order is fixed as resolve, apply,
    // clear. Resolution reads the follower doc directly, which the bridge
    // has already merged by the time this frame's event fires, so it needs
    // neither this frame's ECS apply nor its seq-coverage clear to have run
    // first; running it first also keeps a just-reverted entry's id out of
    // the SAME frame's full-reconcile `pendingAdds`/`pendingConnects`.
    //
    // Round 8: an ordinary same-lineage frame's presence check only ever
    // settles a PRESENT entry (or, for `delete_node`, an absent one — its
    // own success condition). Nothing else ever reverts an entry from here;
    // the bounded terminal path notifies without touching the projection,
    // and only an explicit host rejection reverts.
    if (update.catchUp) pendingOps.resolveDeliveryUnknown(docEffectPresent)
    const applied = projection.applyFrame(update)
    incrementOutcome(applied ? 'applied' : 'skipped')
    if (!applied) return []
    onProjected(update)
    return projection.reconcileLiveGraph(update.workflowId)
  }

  const onSubscribeConfirmed = (event: CustomEvent): void => {
    lifecycle.onSubscribeConfirmed()
    if (subscribedWorkflowId.value !== null)
      retryPendingProjection(subscribedWorkflowId.value)
    // Consumed once per ack: only the ack that follows a resume from a
    // paused (tab-inactive) subscription is checked for continuity — see
    // `pendingCorrelation.ts`'s `resolveIfAlreadyCurrent` doc comment.
    const isReactivation = awaitingReactivationContinuity
    awaitingReactivationContinuity = false
    const { seq } = readSubscribedAckDetail(event.detail)
    // `resumeHeldOpsIfSubscribed` is passed in, not called here first: the
    // held sender must not resume until continuity is decided, so
    // `resolveIfAlreadyCurrent` is the one that calls it.
    pendingCorrelation.resolveIfAlreadyCurrent(
      {
        workflowId: subscribedWorkflowId.value,
        seq,
        isReactivation
      },
      resumeHeldOpsIfSubscribed
    )
  }
  // FE #16637 residual: a refusal is the earliest signal the sender can get
  // that its in-flight batch's doc is gone — don't make it wait out the 10 s
  // result-silence window to notice on its own.
  const onSubscribeRefusedAndBackoff = (): void => {
    lifecycle.onSubscribeRefused()
    releaseHeldOps()
    sender.abortIfUnbound()
  }
  const onSubscribed: EventListener = (event) => {
    if (!(event instanceof CustomEvent)) return
    if (!isTargetActive.value) return
    const ok = event.detail?.ok === true
    connected.value = ok
    lastFrameType.value = event.type
    recordDevEvent('doc_subscribed', event.detail ?? null)
    if (ok) onSubscribeConfirmed(event)
    else onSubscribeRefusedAndBackoff()
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
    const materialized = applyAndReconcile(update)
    recordDevEvent('doc_update', {
      workflowId: update.workflowId,
      seq: update.seq,
      actor: update.actor,
      bytes: update.update instanceof Uint8Array ? update.update.length : null
    })
    const added = trackNodeChanges()
    if (!update.actor?.startsWith('agent:')) {
      const liveDocIds = currentDocNodeIds()
      for (const nodeId of pendingLiveNodeIds) {
        if (!liveDocIds.has(nodeId)) pendingLiveNodeIds.delete(nodeId)
      }
    }
    notifyAgentMaterialization(
      update,
      added,
      materialized,
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
  const performDocResetBookkeeping = (
    workflowId: string,
    detail: DocResetDetail,
    event: Event
  ): void => {
    const context: RemoteMutationContext = {
      source: 'agent-remote',
      actor: detail.actor ?? 'agent-reset',
      opId: `doc-reset:${detail.seq ?? 'unknown'}`
    }
    projection.clearForReset(workflowId, context)
    sender.abortAll()
    events.onReset?.(workflowId)
    connected.value = false
    updatesApplied.value = 0
    lastFrameType.value = event.type
    lifecycle.clearStaleProbe()
    knownDocNodeIds = new Set()
    pendingLiveNodeIds.clear()
    recordDevEvent(
      'doc_reset',
      event instanceof CustomEvent ? (event.detail ?? null) : null
    )
  }
  const onDocReset: EventListener = (event) => {
    const detail =
      event instanceof CustomEvent
        ? (event.detail as DocResetDetail)
        : undefined
    incrementOutcome('reset')
    pendingCorrelation.resetIfTracked(detail?.workflowId)
    if (!isCurrentWorkflow(detail?.workflowId)) return
    performDocResetBookkeeping(detail.workflowId, detail, event)
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
    pendingCorrelation.resetIfTracked(workflowId)
    if (
      isTargetActive.value &&
      typeof workflowId === 'string' &&
      workflowId === subscribedWorkflowId.value
    ) {
      updatesApplied.value = 0
      projection.clearForReset(workflowId, {
        source: 'agent-remote',
        actor: 'agent-lineage',
        opId: `follower-replaced:${workflowId}`
      })
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
    // No later doc update can retire entries after the read path closes.
    pendingCorrelation.reset()
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

  /**
   * A same-lineage catch-up: whatever the doc holds right now is the best
   * evidence available for a `delivery_unknown` (parked) entry whose result
   * never arrived (ADR-CRDT-RECONCILE-0035 (a)).
   */
  function docEffectPresent(op: Op): boolean | null {
    if (isUnprojectedOp(op)) return null
    const doc = bridge.follower.doc
    switch (op.op) {
      case 'add_node':
        return addNodeEffectPresent(doc, op)
      case 'delete_node':
        return deleteNodeEffectPresent(doc, op)
      case 'connect':
        return connectEffectPresent(doc, op)
      case 'set_widget':
        return setWidgetEffectPresent(doc, op)
      case 'clear':
        // Never parked as delivery_unknown, so this check never runs for it.
        return null
      default: {
        const exhaustive: never = op
        return exhaustive
      }
    }
  }

  function onProjected(update: ClassifiedDocUpdate): void {
    pendingCorrelation.onProjected(update)
  }

  function retryPendingProjection(workflowId: string): boolean {
    const update = projection.retryPending(workflowId)
    if (!update) return false
    onProjected(update)
    reconcileAndReportPending(workflowId)
    return true
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
  let boundWorkflowId: string | null = null
  // Readiness only. The other ordering -- graph ready first, target activated
  // second -- cannot be caught here: `getGraph` does not change when activity
  // flips, and even if this watcher also took `isTargetActive` as a source it
  // was created before the binding watcher below, so it would run first and
  // still see `boundWorkflowId === null`. Activation is therefore reconciled at
  // the bind site instead, once the binding actually exists.
  watch(getGraph, (graph) => {
    if (graph && boundWorkflowId !== null && isTargetActive.value) {
      if (!retryPendingProjection(boundWorkflowId))
        reconcileAndReportPending(boundWorkflowId)
    }
  })
  // The bound workflow whose tab went inactive while the sender still held
  // batches for it. A tab switch pauses the subscription without rebinding
  // the session, so those batches are held rather than aborted (see
  // ADR-CRDT-WRITE-0035); anything else that moves the binding releases
  // them into the normal abort path.
  let heldForWorkflowId: string | null = null
  // Set whenever the subscription is paused for a tab-away hold, consumed by
  // the NEXT `onSubscribeConfirmed` (the resume's own ack): see
  // `pendingCorrelation.ts`'s continuity rule. Left false for every other
  // resubscribe (gap detection, reconnect), whose state vector was never
  // stale, so a seq mismatch there is trusted to mean a genuine catch-up is
  // coming rather than a lineage risk.
  let awaitingReactivationContinuity = false
  const releaseHeldOps = (): void => {
    heldForWorkflowId = null
    // Cleared together: an ordinary subscription right after — even for
    // another workflow — must never be classified as this hold's
    // reactivation ack.
    awaitingReactivationContinuity = false
    sender.resume()
  }
  const resumeHeldOpsIfSubscribed = (): void => {
    if (
      heldForWorkflowId !== null &&
      // `bridge.subscribedWorkflowId` is send reality, latched the instant
      // the resubscribe frame leaves the transport — well before its ack.
      // While a continuity check is still outstanding for THIS hold, that
      // send alone must never release it: `onSubscribeConfirmed` is what
      // calls this once the ack has actually decided continuity holds.
      !awaitingReactivationContinuity &&
      bridge.subscribedWorkflowId === heldForWorkflowId
    ) {
      releaseHeldOps()
    }
  }
  const holdOpsForInactiveTab = (workflowId: string): void => {
    heldForWorkflowId = workflowId
    awaitingReactivationContinuity = true
    // Freeze the pre-hold watermark now, before the eventual resubscribe: see
    // `pendingCorrelation.ts`'s `beginReactivation` doc comment.
    pendingCorrelation.beginReactivation()
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
    // Target deactivation (e.g. a tab switch away) unbinds the live
    // projection, but it is NOT a lineage break: the pending-op ledger
    // survives it untouched (ADR-CRDT-RECONCILE-0035 (a)), so a
    // same-workflow reactivation below finds `pendingCorrelation`'s tracked
    // lineage unchanged and does not reset it.
    if (boundWorkflowId !== null) {
      projection.unbind(boundWorkflowId)
      boundWorkflowId = null
    }
    subscribedWorkflowId.value = null
    if (next !== null && next === previousWorkflowId)
      holdOpsForInactiveTab(next)
    else retarget(null)
  }

  const restorePersistedTarget = (justActivated: boolean): void => {
    const persisted = initialBind ? lifecycle.readPersistedDocId() : null
    initialBind = false
    if (persisted === null) {
      lifecycle.clearPersistedDocId()
      if (boundWorkflowId !== null) {
        projection.unbind(boundWorkflowId)
      }
      boundWorkflowId = null
      // A real detach (no persisted id to rebind to): nothing is bound any
      // more, so the ledger's lineage ends too.
      pendingCorrelation.adopt(null)
      subscribedWorkflowId.value = null
      retarget(null)
      return
    }
    recordDevEvent('rebind', { workflowId: persisted })
    if (boundWorkflowId !== persisted) {
      if (boundWorkflowId !== null) {
        projection.unbind(boundWorkflowId)
      }
      projection.bind(persisted, bridge.follower)
      boundWorkflowId = persisted
    }
    if (pendingCorrelation.lineageChanged(persisted))
      pendingCorrelation.adopt(persisted)
    subscribedWorkflowId.value = persisted
    retarget(persisted)
    if (justActivated) reconcileAndReportPending(persisted)
  }

  const activateTarget = (next: string, justActivated: boolean): void => {
    initialBind = false
    if (boundWorkflowId !== next) {
      if (boundWorkflowId !== null) {
        projection.unbind(boundWorkflowId)
      }
      projection.bind(next, bridge.follower)
      boundWorkflowId = next
    }
    if (pendingCorrelation.lineageChanged(next)) pendingCorrelation.adopt(next)
    subscribedWorkflowId.value = next
    retarget(next)
    if (justActivated) reconcileAndReportPending(next)
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
      knownDocNodeIds = new Set()
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
      // abortAll() before detach(): a plain detach() drops queued, open and
      // in-flight batches without settling them, so their ledger entries
      // would outlive this scope in a non-terminal state with no outcome to
      // resolve them. abortAll() settles every one of them first — revert
      // (with toast) for queued/open, parked `unconfirmed` for an in-flight
      // one — so `detach()` only has to stop the sender from admitting or
      // transmitting anything new.
      () => sender.abortAll(),
      () => sender.detach(),
      // Destruction, not an ordinary lineage-break reset
      // (ADR-CRDT-RECONCILE-0035 (a)'s ledger-ownership bullet, round 8): no
      // later frame can ever arrive to settle a still-parked entry from here,
      // so it drops as `abandoned` — never reverted, never toasted as a
      // rejection — instead of vanishing exactly like a lineage break's
      // silent `reset`.
      () => pendingCorrelation.destroy(),
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
      coalescer.enqueue(operations)
  }
}
