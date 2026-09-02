import { computed, onBeforeUnmount, readonly, ref, watch } from 'vue'
import type { Ref } from 'vue'

import { useTelemetry } from '@/platform/telemetry'
import { api } from '@/scripts/api'
import type { RemoteMutationContext } from '@/types/graphMutationContext'
import { createUuidv4 } from '@/utils/uuid'

import type { MaterializableGraph } from './agentNodeMaterializer'
import { reconcileAgentAdapters } from './agentNodeMaterializer'
import { recordDevEvent } from './devPanelLog'
import { wireLog } from './crdtLog'
import type { CrdtDebugSnapshot } from './crdtSnapshot'
import { readCrdtSnapshot } from './crdtSnapshot'
import type { DocFrameTransport, DocUpdate } from './docFrameClient'
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

/**
 * Recency heartbeat budget (BE-9740's FE half): a bound, healthy channel that
 * delivers NO doc-scoped frame for this long gets ONE active probe - a
 * resubscribe whose state-vector catch-up is a no-op on a healthy channel and
 * exactly the observed recovery on a stale one. A stale channel and an idle
 * workflow look identical passively, so expiry probes instead of alarming.
 */
export const STALE_AFTER_MS = 30_000

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
  getGraph: () => MaterializableGraph | null = () => null
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
        const detail = event.detail as OpsResultView & { failed?: unknown }
        listener({
          ok: detail.ok,
          applied: detail.applied,
          skipped: detail.skipped,
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
  let subscribeRetryStartedAt: number | null = null
  let subscribeRetryFailureReported = false

  // TEL-10: mirrors the retry-exhaustion bookkeeping above, but for the
  // recovery path — armed by the SAME two disconnect signals
  // (`onReconnected`'s socket drop and a server `doc_subscribed{ok:false}`
  // refusal). `null` means "no reconnect in flight"; a confirmed subscribe
  // while it is non-null is a reconnect SUCCESS, not just a mount.
  //
  // The report is NOT emitted at the ok ack. The relay sends the ack first and
  // the catch-up `doc_update` (same seq as the ack) AFTER it, so emitting at
  // the ack would always report `replayed_bytes: 0`. Instead the ack turns the
  // bookkeeping into a PENDING report (`reconnectAckSeq` non-null) that is
  // flushed by the catch-up frame, by the first live frame above the ack seq
  // (no catch-up was needed), or by any later lifecycle exit.
  let reconnectStartedAt: number | null = null
  let reconnectFromVersion = 0
  let reconnectReplayedBytes = 0
  let reconnectAckSeq: number | null = null
  // Snapshot of the attempt count taken at the ack, so the deferred report is
  // not distorted by the counters resetting on that same confirmed subscribe.
  // Distinct from `reconnectAttempt` below, which is TEL-9's live
  // socket-reconnect counter.
  let reconnectReportAttempt = 0
  let reconnectDurationMs = 0
  let reconnectToVersion = 0

  // The recency heartbeat: armed only while a subscribe is CONFIRMED (bound +
  // healthy by definition), slid forward by every doc-scoped frame, cancelled
  // by the same lifecycle exits as the subscribe retry. The probe is
  // `resubscribe()` (not `reconcile()`, which no-ops while intent equals
  // reality - and a stale channel's intent DOES equal reality).
  let staleProbeTimer: ReturnType<typeof setTimeout> | null = null

  // BE-9740 (started leg): the last moment a doc-scoped frame confirmed the
  // channel was alive. `onReconnected` diffs against this to report how long
  // the follower was actually offline, not just how long since mount.
  let lastActivityAt: number | null = null
  let reconnectAttempt = 0
  const markActivity = (): void => {
    lastActivityAt = performance.now()
  }

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
    subscribeRetryStartedAt = null
    subscribeRetryFailureReported = false
  }

  const clearReconnectTracking = (): void => {
    reconnectStartedAt = null
    reconnectFromVersion = 0
    reconnectReplayedBytes = 0
    reconnectAckSeq = null
    reconnectReportAttempt = 0
    reconnectDurationMs = 0
    reconnectToVersion = 0
  }

  // Emit the PENDING report (ack already seen) with whatever catch-up bytes
  // were counted so far, then drop the bookkeeping. No-op unless pending, so
  // every exit path can call it unconditionally. `attempt`, the duration and
  // `to_version` were snapshotted at the ack: the wait for the catch-up frame
  // (or for the first live frame that proves none was needed) must not stretch
  // the duration.
  const emitReconnectReport = (): void => {
    useTelemetry()?.trackAgentReconnectSucceeded({
      attempt: reconnectReportAttempt,
      reconnect_duration_ms: reconnectDurationMs,
      replayed_bytes: reconnectReplayedBytes,
      from_version: reconnectFromVersion,
      to_version: reconnectToVersion
    })
    clearReconnectTracking()
  }
  const flushPendingReconnectReport = (): void => {
    if (reconnectStartedAt === null || reconnectAckSeq === null) return
    emitReconnectReport()
  }

  // Arm reconnect tracking on the FIRST disconnect signal only — a later
  // retry attempt or a second `onReconnected` mid-recovery must not reset the
  // duration clock or the from_version baseline it already captured. A
  // disconnect signal while a report is PENDING is a new reconnect, so the
  // pending one is flushed first and the clock restarts.
  const armReconnectTracking = (): void => {
    flushPendingReconnectReport()
    if (reconnectStartedAt !== null) return
    reconnectStartedAt = performance.now()
    reconnectFromVersion = bridge.lastSequence
    reconnectReplayedBytes = 0
  }

  // Confirmed subscribe while a reconnect is in flight. A numeric ack seq means
  // a catch-up frame with that seq MAY follow, so the report goes pending; an
  // ack without a seq has nothing to wait for and is reported at once. A second
  // ok ack while already pending (the stale probe's `resubscribe()`) proves no
  // catch-up arrived, so it flushes rather than re-arming.
  const onReconnectConfirmed = (ackSeq: number | null): void => {
    if (reconnectStartedAt === null) return
    if (reconnectAckSeq !== null) {
      flushPendingReconnectReport()
      return
    }
    // Both disconnect signals produce subscribe attempts and both counters
    // reset on this same confirmed subscribe, so the recovery cost is their
    // sum: `onReconnected`'s immediate resubscribe plus every refusal-driven
    // retry. Floored at 1 because a socket-drop recovery that never retried
    // still took one attempt.
    reconnectReportAttempt = Math.max(
      1,
      reconnectAttempt + subscribeRetryAttempt
    )
    reconnectDurationMs = Math.max(
      0,
      Math.round(performance.now() - reconnectStartedAt)
    )
    if (ackSeq === null) {
      reconnectToVersion = 0
      emitReconnectReport()
      return
    }
    reconnectToVersion = ackSeq
    reconnectAckSeq = ackSeq
  }

  // Doc frame while a reconnect is in flight. Before the ack every frame is
  // counted (the ack can be overtaken). After the ack, frames at or below the
  // ack seq are the catch-up: count them and flush on the one that matches
  // the ack. A frame ABOVE the ack seq is live traffic, which proves the
  // catch-up was empty (or already flushed): flush first, do not count it.
  const trackReconnectUpdate = (update: DocUpdate): void => {
    if (reconnectStartedAt === null) return
    const bytes = update.update instanceof Uint8Array ? update.update.length : 0
    if (reconnectAckSeq === null) {
      reconnectReplayedBytes += bytes
      return
    }
    if (update.seq > reconnectAckSeq) {
      flushPendingReconnectReport()
      return
    }
    reconnectReplayedBytes += bytes
    if (update.seq === reconnectAckSeq) flushPendingReconnectReport()
  }

  const reportSubscribeRetryExhausted = (): void => {
    if (
      subscribeRetryFailureReported ||
      subscribeRetryAttempt < SUBSCRIBE_RETRY_MAX_ATTEMPTS
    )
      return
    // The pending timer here is the final attempt's answer deadline.
    if (subscribeRetryTimer !== null) {
      clearTimeout(subscribeRetryTimer)
      subscribeRetryTimer = null
    }
    subscribeRetryFailureReported = true
    useTelemetry()?.trackAgentReconnectFailed({
      attempt: subscribeRetryAttempt,
      error_class: 'subscription_refused',
      retryable: true,
      reconnect_duration_ms: Math.max(
        0,
        Math.round(
          performance.now() - (subscribeRetryStartedAt ?? performance.now())
        )
      )
    })
  }

  const scheduleSubscribeRetry = (): void => {
    // A refusal after the final attempt is the exhaustion signal itself; it
    // must win over the answer deadline armed below.
    if (subscribeRetryAttempt >= SUBSCRIBE_RETRY_MAX_ATTEMPTS) {
      reportSubscribeRetryExhausted()
      return
    }
    if (subscribeRetryTimer !== null) return
    const target = subscribedWorkflowId.value
    if (target === null) return
    subscribeRetryStartedAt ??= performance.now()
    armReconnectTracking()
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
      // The final attempt has no retry to reveal a silently dropped answer,
      // so treat silence for one more backoff step as a refusal. A confirmed
      // subscribe cancels this through clearSubscribeRetry.
      if (subscribeRetryAttempt >= SUBSCRIBE_RETRY_MAX_ATTEMPTS) {
        subscribeRetryTimer = setTimeout(
          () => {
            subscribeRetryTimer = null
            reportSubscribeRetryExhausted()
          },
          SUBSCRIBE_RETRY_BASE_MS * 2 ** subscribeRetryAttempt
        )
      }
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
      // Snapshot before clearSubscribeRetry() resets the attempt counter. A
      // non-null start time means this confirm follows a disconnect signal
      // (onReconnected or a prior refusal), i.e. it is a RECOVERY, not the
      // panel's first-ever bind. The report itself is deferred until the
      // catch-up frame (see `trackReconnectUpdate`).
      const seq = event.detail?.seq
      onReconnectConfirmed(typeof seq === 'number' ? seq : null)
      clearSubscribeRetry()
      armStaleProbe()
      reconnectAttempt = 0
      markActivity()
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
    trackReconnectUpdate(update)
    if (staleProbeTimer !== null) armStaleProbe()
    markActivity()
    refreshPersistedDocId()
    updatesApplied.value = bridge.follower.updatesApplied
    lastFrameType.value = event.type
    const applied = adapter.applyFrame(update)
    outcomes.value = applied
      ? { ...outcomes.value, applied: outcomes.value.applied + 1 }
      : { ...outcomes.value, skipped: outcomes.value.skipped + 1 }
    if (applied) reconcileLiveGraph(update.workflowId)
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
  const onOpsResult: EventListener = (event) => {
    if (staleProbeTimer !== null) {
      armStaleProbe()
      refreshPersistedDocId()
    }
    lastFrameType.value = event.type
    if (event instanceof CustomEvent) {
      recordDevEvent('doc_ops_result', event.detail ?? null)
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
    updatesApplied.value = 0
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
      updatesApplied.value = 0
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
    // Only a workflow already bound to this follower has a connection to
    // lose; a reconnect firing before any subscribe intent exists is the
    // initial-open case, not a loss/recovery, and is not reported.
    if (subscribedWorkflowId.value !== null) {
      reconnectAttempt += 1
      useTelemetry()?.trackAgentReconnectStarted({
        disconnect_class: 'socket_reconnect',
        attempt: reconnectAttempt,
        last_seen_version: bridge.lastSequence,
        offline_duration_ms:
          lastActivityAt === null
            ? null
            : Math.max(0, Math.round(performance.now() - lastActivityAt))
      })
    }
    connected.value = false
    clearStaleProbe()
    armReconnectTracking()
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
  bridge.addEventListener('doc_update', onUpdate)
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
    const nodeIds = reconcileAgentAdapters(graph)
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
      // A reconnect that was confirmed but still waiting for its catch-up
      // frame DID succeed: report it before the binding changes. One that was
      // never confirmed is dropped without a report.
      flushPendingReconnectReport()
      clearReconnectTracking()
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
      flushPendingReconnectReport()
      clearReconnectTracking()
      clearStaleProbe()
      api.removeEventListener('reconnected', onReconnected)
      api.removeEventListener('status', onSocketActivity)
      bridge.removeEventListener('doc_subscribed', onSubscribed)
      bridge.removeEventListener('doc_update', onUpdate)
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
      sender.enqueue(operations)
  }
}
