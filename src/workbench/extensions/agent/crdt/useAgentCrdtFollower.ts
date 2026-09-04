import { computed, onBeforeUnmount, readonly, ref, watch } from 'vue'
import type { Ref } from 'vue'

import { reportError } from '@/platform/telemetry/reportError'
import { api } from '@/scripts/api'
import type { RemoteMutationContext } from '@/types/graphMutationContext'
import { createUuidv4 } from '@/utils/uuid'

import type { MaterializableGraph } from './agentNodeMaterializer'
import { reconcileAgentAdapters } from './agentNodeMaterializer'
import { readSubgraphDefinitions } from './agentSubgraphDefinitions'
import { recordDevEvent } from './devPanelLog'
import { wireLog } from './crdtLog'
import type { CrdtDebugSnapshot } from './crdtSnapshot'
import { readCrdtSnapshot } from './crdtSnapshot'
import type {
  DocFrameTransport,
  DocOpsResult,
  DocUpdate
} from './docFrameClient'
import { DocFrameClient } from './docFrameClient'
import type { MutationsForTarget } from './ecsFollowerAdapter'
import { EcsFollowerAdapter } from './ecsFollowerAdapter'
import type { GraphOperation } from './graphOperations'
import { LayoutFollowerBridge } from './layoutFollowerBridge'
import type { OpsResultView } from './opSender'
import { createOpSender } from './opSender'

// FE-1902: the doc id is otherwise held only in memory (set on turn ack), so a
// panel remount loses the binding until the NEXT turn ack. Persist it per-tab
// in sessionStorage so an in-page remount can rebind immediately. A full page
// reload deliberately does NOT rebind (see the nonce below): it mints a new
// nonce, refuses the pre-reload record, and waits for the next turn ack.
//
// FEC-5: a bare `docId` string has no owner and no lifetime, so it survives
// (a) a workflow switch in the same browser tab - the NEXT panel mount rebinds
// to whichever workflow last confirmed a subscribe, not necessarily the one
// about to become active - and (b) a browser-tab duplication, which clones
// sessionStorage verbatim into a second tab that never subscribed to that doc
// at all. Neither case can be caught by re-checking `workflowId`, because the
// whole reason a rebind is attempted is that the caller does NOT yet know
// which workflow it's asking about. Instead the persisted record carries (1)
// a per-page-load session nonce, so a value only ever rebinds within the
// SAME top-level navigation that wrote it - a duplicated tab gets a fresh
// nonce and its inherited record is refused - and (2) a short expiry that
// slides while the doc keeps delivering frames, so a tab left idle past the
// window a doc realistically stays relevant is refused rather than trusted
// indefinitely. (1) closes case (b). Case (a) happens inside one page load,
// so the nonce cannot see it; it is only BOUNDED by (2), not closed. The
// `fec-docid-1` reproducer tracks the remaining same-tab window.
const DOC_ID_SESSION_KEY = 'Comfy.Agent.CrdtDocId'
const DOC_ID_TTL_MS = 5 * 60 * 1000
// Re-stamp the expiry on doc traffic at most this often, so a busy channel
// does not turn every frame into a sessionStorage write.
const DOC_ID_REFRESH_INTERVAL_MS = DOC_ID_TTL_MS / 2

// One nonce per page load (module scope = one per top-level navigation, since
// a full reload re-evaluates the module). A tab duplicated mid-session
// inherits sessionStorage's persisted record but gets its own module
// instance and thus its own nonce, so the inherited record's nonce mismatches
// and is refused.
const pageSessionNonce = createUuidv4()

interface PersistedDocIdRecord {
  docId: string
  nonce: string
  expiresAt: number
}

function safeSessionStorage(): Storage | null {
  try {
    return window.sessionStorage
  } catch {
    return null
  }
}

function persistDocId(docId: string): void {
  try {
    const record: PersistedDocIdRecord = {
      docId,
      nonce: pageSessionNonce,
      expiresAt: Date.now() + DOC_ID_TTL_MS
    }
    safeSessionStorage()?.setItem(DOC_ID_SESSION_KEY, JSON.stringify(record))
  } catch {
    // Quota / privacy mode: persistence is best-effort.
  }
}

// Returns the persisted doc id ONLY when it was written by this same page
// load and has not expired.
function readPersistedDocId(): string | null {
  try {
    const raw = safeSessionStorage()?.getItem(DOC_ID_SESSION_KEY)
    if (!raw) return null
    const record = JSON.parse(raw) as Partial<PersistedDocIdRecord>
    if (
      typeof record.docId !== 'string' ||
      typeof record.nonce !== 'string' ||
      typeof record.expiresAt !== 'number'
    ) {
      // Legacy/malformed record (e.g. pre-FEC-5 bare-string value): treat as
      // absent rather than trusting an unscoped id.
      return null
    }
    if (record.nonce !== pageSessionNonce) return null
    if (Date.now() >= record.expiresAt) return null
    return record.docId
  } catch {
    return null
  }
}

function clearPersistedDocId(): void {
  try {
    safeSessionStorage()?.removeItem(DOC_ID_SESSION_KEY)
  } catch {
    // Best-effort.
  }
}

function failureView(failed: unknown): OpsResultView['failure'] | undefined {
  if (typeof failed !== 'object' || failed === null) return undefined
  const view = {
    ...('op_id' in failed && typeof failed.op_id === 'string'
      ? { op_id: failed.op_id }
      : {}),
    ...('code' in failed && typeof failed.code === 'string'
      ? { code: failed.code }
      : {}),
    ...('message' in failed && typeof failed.message === 'string'
      ? { message: failed.message }
      : {})
  }
  return Object.keys(view).length > 0 ? view : undefined
}

/**
 * Recency heartbeat budget (BE-9740's FE half): a bound, healthy channel that
 * delivers NO doc-scoped frame for this long gets ONE active probe - a
 * resubscribe whose state-vector catch-up is a no-op on a healthy channel and
 * exactly the observed recovery on a stale one. A stale channel and an idle
 * workflow look identical passively, so expiry probes instead of alarming.
 */
export const STALE_AFTER_MS = 30_000

export interface OpNack {
  workflowId: string
  code: string | null
  message: string | null
  failed: OpsResultView['failure'] | null
  applied: number
  skipped: number
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
export interface AgentCrdtOutcomeCounters {
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

export interface AgentCrdtStatus {
  enabled: boolean
  connected: boolean
  workflowId: string | null
  updatesReceived: number
  /**
   * Successful adapter commits for the current follower lineage. Reset to 0
   * on `doc_reset` / `follower_replaced`; unlike `outcomes.applied`, it does
   * not remain monotonic across those resets. Kept for AgentPanelRoot.vue and
   * CrdtDevPanel.vue.
   */
  updatesApplied: number
  updatesSkipped: number
  updatesErrored: number
  lastFrameType: string | null
  opNacks: number
  lastOpNack: OpNack | null
  projectionErrors: number
  outcomes: AgentCrdtOutcomeCounters
}

export const apiTransport: DocFrameTransport = {
  send(frame) {
    // Never throws: a closed socket is a recoverable state, not an error. See
    // DocFrameTransport.send — throwing here aborted both the immediate
    // subscribe watcher and the unmount hook.
    if (api.socket?.readyState !== WebSocket.OPEN) return false
    api.socket.send(frame)
    return true
  },
  addEventListener(type, listener) {
    api.addCustomEventListener(type, listener)
  },
  removeEventListener(type, listener) {
    api.removeCustomEventListener(type, listener)
  }
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
  onFailure: (
    type: 'op_rejected' | 'apply_failed',
    details: string
  ) => void = () => {}
) {
  const connected = ref(false)
  const updatesReceived = ref(0)
  const updatesApplied = ref(0)
  const updatesSkipped = ref(0)
  const updatesErrored = ref(0)
  const lastFrameType = ref<string | null>(null)
  const subscribedWorkflowId = ref<string | null>(null)
  const opNacks = ref(0)
  const lastOpNack = ref<OpNack | null>(null)
  const projectionErrors = ref(0)
  // One Sentry report per failure class per WORKFLOW; the counters stay
  // monotonic per mount so the dev panel keeps its running totals.
  let projectionFailureReported = false
  let opNackReported = false

  const resetWorkflowDiagnostics = (): void => {
    lastOpNack.value = null
    projectionFailureReported = false
    opNackReported = false
  }

  const resetUpdateCounters = (): void => {
    updatesReceived.value = 0
    updatesApplied.value = 0
    updatesSkipped.value = 0
    updatesErrored.value = 0
  }
  const outcomes = ref<AgentCrdtOutcomeCounters>({
    received: 0,
    applied: 0,
    skipped: 0,
    errored: 0,
    gap: 0,
    reset: 0,
    dropped: 0
  })

  // Dev-panel tap (poc-4): log every outbound frame with its delivery result.
  // Wraps locally instead of modifying the exported apiTransport, whose
  // never-throw contract is covered by tests.
  const transport: DocFrameTransport = {
    send(frame) {
      const delivered = apiTransport.send(frame)
      let parsed: unknown = frame
      try {
        parsed = JSON.parse(frame)
      } catch {
        // Leave the raw string.
      }
      wireLog.trace('ws_out', 'outbound frame', { delivered, frame: parsed })
      return delivered
    },
    addEventListener(type, listener) {
      apiTransport.addEventListener(type, listener)
    },
    removeEventListener(type, listener) {
      apiTransport.removeEventListener(type, listener)
    }
  }
  const client = new DocFrameClient(transport)
  const bridge = new LayoutFollowerBridge(client)
  const adapter = new EcsFollowerAdapter(graphMutations)
  const tabId = createUuidv4()

  const sender = createOpSender({
    sendOps: (target, tab, ops) => client.sendOps(target, tab, ops),
    onOpsResult(listener) {
      const handler: EventListener = (event) => {
        if (!(event instanceof CustomEvent)) return
        const detail = event.detail as Partial<DocOpsResult> | null
        if (
          detail === null ||
          typeof detail.workflowId !== 'string' ||
          typeof detail.ok !== 'boolean'
        )
          return
        // Not filtered on the current subscription: after a workflow switch
        // the previous workflow's batch is still the one in flight, and its
        // result must settle it. The sender attributes by batch workflow.
        const failure = failureView(detail.failed)
        listener({
          ok: detail.ok,
          workflowId: detail.workflowId,
          applied: detail.applied ?? [],
          skipped: detail.skipped ?? [],
          ...(failure && { failure })
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
    onBatchSettled: (outcome) => recordDevEvent('human_ops_settled', outcome)
  })

  // Dev-panel tap (poc-4): track the doc's node-id set so the panel can show
  // exactly which nodes each doc_update added/removed. Rebuilt from zero on
  // doc_reset (remint) because the lineage broke.
  let knownDocNodeIds: Set<string> = new Set()
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

  // FE-1901 (poc-2): a `doc_subscribed {ok:false}` is a SERVER refusal — e.g.
  // the subscribe raced the doc-host before the turn ack minted the doc. The
  // bridge's transport-level reconcile can never repair it: the frame WAS
  // delivered, so intent already equals reality. Retry the subscribe itself
  // with bounded exponential backoff while the desired doc is unchanged.
  const SUBSCRIBE_RETRY_BASE_MS = 500
  const SUBSCRIBE_RETRY_MAX_ATTEMPTS = 6
  let subscribeRetryTimer: ReturnType<typeof setTimeout> | null = null
  let subscribeRetryAttempt = 0

  // The recency heartbeat: armed only while a subscribe is CONFIRMED (bound +
  // healthy by definition), slid forward by every doc-scoped frame, cancelled
  // by the same lifecycle exits as the subscribe retry. The probe is
  // `resubscribe()` (not `reconcile()`, which no-ops while intent equals
  // reality - and a stale channel's intent DOES equal reality).
  let staleProbeTimer: ReturnType<typeof setTimeout> | null = null

  // FEC-5: `Date.now()` of the last persisted-record write by this instance.
  // A confirmed subscribe always writes; doc-scoped frames re-stamp the expiry
  // no more often than DOC_ID_REFRESH_INTERVAL_MS, so a doc that keeps
  // delivering frames keeps its rebind window instead of lapsing mid-session.
  let lastPersistedAt = 0
  const persistConfirmedDocId = (docId: string): void => {
    persistDocId(docId)
    lastPersistedAt = Date.now()
  }
  const refreshPersistedDocId = (): void => {
    const docId = subscribedWorkflowId.value
    if (docId === null) return
    if (Date.now() - lastPersistedAt < DOC_ID_REFRESH_INTERVAL_MS) return
    persistConfirmedDocId(docId)
  }

  const clearStaleProbe = (): void => {
    if (staleProbeTimer !== null) {
      clearTimeout(staleProbeTimer)
      staleProbeTimer = null
    }
  }

  const armStaleProbe = (): void => {
    clearStaleProbe()
    staleProbeTimer = setTimeout(() => {
      staleProbeTimer = null
      recordDevEvent('stale_probe', {
        workflowId: subscribedWorkflowId.value
      })
      bridge.resubscribe()
      armStaleProbe()
    }, STALE_AFTER_MS)
  }

  const clearSubscribeRetry = (): void => {
    if (subscribeRetryTimer !== null) {
      clearTimeout(subscribeRetryTimer)
      subscribeRetryTimer = null
    }
    subscribeRetryAttempt = 0
  }

  const scheduleSubscribeRetry = (): void => {
    if (subscribeRetryTimer !== null) return
    if (subscribeRetryAttempt >= SUBSCRIBE_RETRY_MAX_ATTEMPTS) return
    const target = subscribedWorkflowId.value
    if (target === null) return
    const delay = SUBSCRIBE_RETRY_BASE_MS * 2 ** subscribeRetryAttempt
    subscribeRetryAttempt += 1
    subscribeRetryTimer = setTimeout(() => {
      subscribeRetryTimer = null
      // The desired doc changed while we waited — the watch owns that path.
      if (subscribedWorkflowId.value !== target) return
      recordDevEvent('subscribe_retry', {
        attempt: subscribeRetryAttempt,
        workflowId: target
      })
      bridge.resubscribe()
    }, delay)
  }

  const onSubscribed: EventListener = (event) => {
    if (!(event instanceof CustomEvent)) return
    if (!isTargetActive.value) return
    const ok = event.detail?.ok === true
    connected.value = ok
    lastFrameType.value = event.type
    recordDevEvent('doc_subscribed', event.detail ?? null)
    if (ok) {
      clearSubscribeRetry()
      armStaleProbe()
      // FE-1902 (poc-3): only a CONFIRMED binding is worth rebinding to after
      // a remount — persist on ok, not on intent.
      if (subscribedWorkflowId.value !== null)
        persistConfirmedDocId(subscribedWorkflowId.value)
    } else {
      clearStaleProbe()
      scheduleSubscribeRetry()
      // FE #16637 residual: a refusal is the earliest signal the sender can
      // get that its in-flight batch's doc is gone — don't make it wait out
      // the 10 s result-silence window to notice on its own.
      sender.abortIfUnbound()
    }
  }
  const handleProjectionFailure = (error: unknown, update: DocUpdate): void => {
    projectionErrors.value += 1
    const failure = {
      workflowId: update.workflowId,
      seq: update.seq,
      message: error instanceof Error ? error.message : String(error)
    }
    recordDevEvent('projection_error', failure)
    onFailure('apply_failed', failure.message)
    // Count and report only. A state-vector resubscribe cannot redeliver this
    // frame: the bridge merged its Yjs bytes before dispatching, so the host's
    // catch-up delta is empty, and the adapter dropped its pending diff before
    // batching. Healing needs an empty-vector resubscribe, which ADR-0024
    // reserves for an explicit doc_reset. The channel itself is healthy, so
    // `connected` stays as the subscription reported it.
    if (!projectionFailureReported) {
      projectionFailureReported = true
      reportError(error, {
        errorType: 'agent_crdt_projection_failure',
        tags: { workflow_id: update.workflowId },
        context: { sequence: update.seq }
      })
    }
  }
  const onUpdate: EventListener = (event) => {
    if (!(event instanceof CustomEvent)) return
    const update = event.detail as DocUpdate
    outcomes.value = {
      ...outcomes.value,
      received: outcomes.value.received + 1
    }
    if (
      !isTargetActive.value ||
      update.workflowId !== subscribedWorkflowId.value
    ) {
      outcomes.value = {
        ...outcomes.value,
        skipped: outcomes.value.skipped + 1
      }
      return
    }
    if (staleProbeTimer !== null) armStaleProbe()
    refreshPersistedDocId()
    lastFrameType.value = event.type
    try {
      if (!adapter.applyFrame(update)) {
        updatesSkipped.value += 1
        outcomes.value = {
          ...outcomes.value,
          skipped: outcomes.value.skipped + 1
        }
        handleProjectionFailure(
          new Error('ECS mutation batch rejected the authoritative update'),
          update
        )
        return
      }
      updatesApplied.value += 1
      outcomes.value = {
        ...outcomes.value,
        applied: outcomes.value.applied + 1
      }
      reconcileLiveGraph(update.workflowId)
    } catch (error) {
      updatesErrored.value += 1
      outcomes.value = {
        ...outcomes.value,
        errored: outcomes.value.errored + 1
      }
      handleProjectionFailure(error, update)
      return
    }
    recordDevEvent('doc_update', {
      workflowId: update.workflowId,
      seq: update.seq,
      actor: update.actor,
      bytes: update.update instanceof Uint8Array ? update.update.length : null
    })
    const ids = currentDocNodeIds()
    const added = [...ids].filter((id) => !knownDocNodeIds.has(id))
    const removed = [...knownDocNodeIds].filter((id) => !ids.has(id))
    if (added.length > 0 || removed.length > 0)
      recordDevEvent('doc_nodes_changed', { added, removed })
    knownDocNodeIds = ids
  }
  const onUpdateReceived = (): void => {
    updatesReceived.value += 1
  }
  const onUpdateSkipped = (): void => {
    updatesSkipped.value += 1
  }
  const onUpdateError = (): void => {
    updatesErrored.value += 1
  }
  const onOpsResult: EventListener = (event) => {
    if (!(event instanceof CustomEvent)) return
    const detail = event.detail as Partial<DocOpsResult> | null
    if (detail === null) return
    const resultWorkflowId = detail?.workflowId
    if (
      !isTargetActive.value ||
      typeof resultWorkflowId !== 'string' ||
      resultWorkflowId !== subscribedWorkflowId.value
    )
      return
    const failed = failureView(detail.failed)
    recordDevEvent('doc_ops_result', {
      workflowId: resultWorkflowId,
      ok: detail.ok,
      seq: detail.seq,
      applied: detail.applied ?? [],
      skipped: detail.skipped ?? [],
      code: detail.code,
      message: detail.message,
      failed: failed ?? null
    })
    if (staleProbeTimer !== null) {
      armStaleProbe()
      refreshPersistedDocId()
    }
    lastFrameType.value = event.type
    if (detail.ok !== false) return

    const nack: OpNack = {
      workflowId: resultWorkflowId,
      code: detail.code ?? null,
      message: detail.message ?? null,
      failed: failed ?? null,
      applied: detail.applied?.length ?? 0,
      skipped: detail.skipped?.length ?? 0
    }
    opNacks.value += 1
    lastOpNack.value = nack
    recordDevEvent('op_nack', nack)
    onFailure(
      'op_rejected',
      nack.message ??
        nack.failed?.message ??
        nack.code ??
        nack.failed?.code ??
        'The host rejected the workflow edit.'
    )
    if (!opNackReported) {
      opNackReported = true
      reportError(new Error('Host rejected CRDT operations'), {
        errorType: 'agent_crdt_host_operation_rejected',
        tags: {
          workflow_id: nack.workflowId,
          applied_ops: nack.applied,
          skipped_ops: nack.skipped
        },
        context: {
          failed: nack.failed,
          host_code: nack.code,
          host_message: nack.message
        }
      })
    }
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
    outcomes.value = { ...outcomes.value, reset: outcomes.value.reset + 1 }
    if (
      !isTargetActive.value ||
      detail?.workflowId !== subscribedWorkflowId.value
    )
      return
    const context: RemoteMutationContext = {
      source: 'agent-remote',
      actor: detail?.actor ?? 'agent-reset',
      opId: `doc-reset:${detail?.seq ?? 'unknown'}`
    }
    if (detail?.workflowId !== undefined) {
      adapter.clearForReset(detail.workflowId, context)
      // A lineage break empties the stores but leaves every live adapter
      // standing, and those adapters are what a save serialises. Without a
      // reconcile here the pre-reset nodes survive -- and can be written back
      // -- until some later frame happens to arrive.
      reconcileLiveGraph(detail.workflowId)
    }
    connected.value = false
    resetUpdateCounters()
    resetWorkflowDiagnostics()
    lastFrameType.value = event.type
    clearStaleProbe()
    knownDocNodeIds = new Set()
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
      resetUpdateCounters()
      adapter.clearForReset(workflowId, {
        source: 'agent-remote',
        actor: 'agent-lineage',
        opId: `follower-replaced:${workflowId}`
      })
      // Same reasoning as `onDocReset`: the clear is store-only, so the stale
      // live adapters have to be swept before the replacement doc's frames
      // start landing.
      reconcileLiveGraph(workflowId)
      adapter.bind(workflowId, bridge.follower)
    }
  }
  const onSchemaError: EventListener = (event) => {
    // KA-11 fail-closed: the bridge refused to propagate an unreadable doc, so
    // nothing was projected. Surface it as its own status rather than as a
    // generic "disconnected", which is indistinguishable from "never connected".
    connected.value = false
    updatesErrored.value += 1
    lastFrameType.value = event.type
    clearStaleProbe()
    const detail =
      event instanceof CustomEvent
        ? (event.detail as { workflowId?: string } | null)
        : null
    if (detail?.workflowId !== undefined)
      adapter.discardPending(detail.workflowId)
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
  const onReconnected: EventListener = () => {
    connected.value = false
    clearStaleProbe()
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
   * nothing.
   */
  const onSocketActivity: EventListener = () => {
    bridge.reconcile()
  }

  bridge.addEventListener('doc_subscribed', onSubscribed)
  bridge.addEventListener('doc_update_received', onUpdateReceived)
  bridge.addEventListener('doc_update', onUpdate)
  bridge.addEventListener('doc_update_skipped', onUpdateSkipped)
  bridge.addEventListener('doc_update_error', onUpdateError)
  bridge.addEventListener('doc_ops_result', onOpsResult)
  bridge.addEventListener('doc_reset', onDocReset)
  bridge.addEventListener('follower_replaced', onFollowerReplaced)
  bridge.addEventListener('schema_error', onSchemaError)
  bridge.addEventListener('doc_gap', onGap)
  bridge.addEventListener('doc_stale', onStale)
  api.addEventListener('reconnected', onReconnected)
  api.addEventListener('status', onSocketActivity)

  // FE-1902 (poc-3): distinguish the mount-time null (in-memory doc id died
  // with the previous mount — rebind from sessionStorage) from a later null
  // (a REAL detach, e.g. new chat — drop the persisted id too).
  let initialBind = true
  let boundWorkflowId: string | null = null
  // The op layer writes remote frames to the stores only; the live graph
  // catches up here, after each applied frame and once a graph exists.
  function reconcileLiveGraph(docId: string): void {
    const graph = getGraph()
    if (!graph) return
    const nodeIds = reconcileAgentAdapters(
      graph,
      readSubgraphDefinitions(bridge.follower.doc)
    )
    if (nodeIds.length > 0) {
      recordDevEvent('agent_node_adapters_materialized', {
        workflowId: docId,
        nodeIds
      })
    }
  }
  // Readiness only. The other ordering -- graph ready first, target activated
  // second -- cannot be caught here: `getGraph` does not change when activity
  // flips, and even if this watcher also took `isTargetActive` as a source it
  // was created before the binding watcher below, so it would run first and
  // still see `boundWorkflowId === null`. Activation is therefore reconciled at
  // the bind site instead, once the binding actually exists.
  watch(getGraph, (graph) => {
    if (graph && boundWorkflowId !== null && isTargetActive.value) {
      reconcileLiveGraph(boundWorkflowId)
    }
  })
  // Drive the bridge's intent, then give the sender the same eager signal the
  // refusal branch gets: `reconcile()` clears send reality synchronously when
  // the desired doc changes, and a batch minted for the old doc would
  // otherwise wait out the 10 s result-silence window before noticing.
  const retarget = (next: string | null): void => {
    if (next === null) bridge.unsubscribe()
    else bridge.subscribe(next)
    sender.abortIfUnbound()
  }
  watch(
    [workflowId, isTargetActive],
    ([next, active], previous) => {
      // Only the inactive->active edge, and never the `immediate` first run
      // (`previous` is undefined there), so a plain mount or retarget keeps its
      // existing "reconcile on frame or on graph readiness" behaviour.
      const justActivated = active && previous?.[1] === false
      clearSubscribeRetry()
      clearStaleProbe()
      connected.value = false
      knownDocNodeIds = new Set()
      if (!active) {
        if (next !== null) initialBind = false
        if (boundWorkflowId !== null) {
          adapter.unbind(boundWorkflowId)
          boundWorkflowId = null
        }
        subscribedWorkflowId.value = null
        retarget(null)
        return
      }
      if (next === null) {
        const persisted = initialBind ? readPersistedDocId() : null
        initialBind = false
        if (persisted !== null) {
          recordDevEvent('rebind', { workflowId: persisted })
          if (boundWorkflowId !== persisted) {
            if (boundWorkflowId !== null) adapter.unbind(boundWorkflowId)
            adapter.bind(persisted, bridge.follower)
            boundWorkflowId = persisted
          }
          subscribedWorkflowId.value = persisted
          retarget(persisted)
          if (justActivated) reconcileLiveGraph(persisted)
          return
        }
        clearPersistedDocId()
        if (boundWorkflowId !== null) {
          adapter.unbind(boundWorkflowId)
          boundWorkflowId = null
        }
        subscribedWorkflowId.value = null
        retarget(null)
        return
      }
      initialBind = false
      if (boundWorkflowId !== next) {
        resetWorkflowDiagnostics()
        if (boundWorkflowId !== null) adapter.unbind(boundWorkflowId)
        adapter.bind(next, bridge.follower)
        boundWorkflowId = next
      }
      subscribedWorkflowId.value = next
      retarget(next)
      if (justActivated) reconcileLiveGraph(next)
    },
    { immediate: true }
  )

  onBeforeUnmount(() => {
    // Teardown must be total. Anything that survives would apply every later
    // update twice after a remount.
    try {
      clearSubscribeRetry()
      clearStaleProbe()
      api.removeEventListener('reconnected', onReconnected)
      api.removeEventListener('status', onSocketActivity)
      bridge.removeEventListener('doc_subscribed', onSubscribed)
      bridge.removeEventListener('doc_update_received', onUpdateReceived)
      bridge.removeEventListener('doc_update', onUpdate)
      bridge.removeEventListener('doc_update_skipped', onUpdateSkipped)
      bridge.removeEventListener('doc_update_error', onUpdateError)
      bridge.removeEventListener('doc_ops_result', onOpsResult)
      bridge.removeEventListener('doc_reset', onDocReset)
      bridge.removeEventListener('follower_replaced', onFollowerReplaced)
      bridge.removeEventListener('schema_error', onSchemaError)
      bridge.removeEventListener('doc_gap', onGap)
      bridge.removeEventListener('doc_stale', onStale)
      sender.detach()
      adapter.destroy()
      bridge.destroy()
    } finally {
      client.destroy()
    }
  })

  const status = computed<AgentCrdtStatus>(() => ({
    enabled: true,
    connected: connected.value,
    workflowId: subscribedWorkflowId.value,
    updatesReceived: updatesReceived.value,
    updatesApplied: updatesApplied.value,
    updatesSkipped: updatesSkipped.value,
    updatesErrored: updatesErrored.value,
    lastFrameType: lastFrameType.value,
    opNacks: opNacks.value,
    lastOpNack: lastOpNack.value,
    projectionErrors: projectionErrors.value,
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
      sender.enqueue(operations)
  }
}
