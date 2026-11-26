import { once } from 'es-toolkit'

import { reportError } from '@comfyorg/telemetry/reportError'
import { safeSessionStorage } from '@comfyorg/shared-frontend-utils/safeStorage'
import { createUuidv4 } from '@comfyorg/graph-model/uuid'

import { recordDevEvent } from './crdtLog'
import {
  STALE_AFTER_MS,
  SUBSCRIBE_ACK_TIMEOUT_MS,
  SUBSCRIBE_CATCHUP_GRACE_MS
} from './lifecycleTiming'
import type { PermanentDocSubscribeRefusalCode } from './docFrameCodes'
import { isPermanentSubscribeRefusalCode } from './docFrameCodes'

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

// FE-1901 (poc-2): a `doc_subscribed {ok:false}` is a SERVER refusal - e.g.
// the subscribe raced the doc-host before the turn ack minted the doc. The
// bridge's transport-level reconcile can never repair it: the frame WAS
// delivered, so intent already equals reality. Retry the subscribe itself
// with bounded exponential backoff while the desired doc is unchanged.
const SUBSCRIBE_RETRY_BASE_MS = 500
const SUBSCRIBE_RETRY_MAX_ATTEMPTS = 6

export type SubscribeGiveUpReason = 'refused' | 'retry_exhausted' | 'timeout'

const SILENT_PERMANENT_REFUSAL_CODES: ReadonlySet<PermanentDocSubscribeRefusalCode> =
  new Set(['unsupported'])

function isNotifyingPermanentRefusalCode(
  code: PermanentDocSubscribeRefusalCode
): boolean {
  return !SILENT_PERMANENT_REFUSAL_CODES.has(code)
}

// The third unanswered attempt is terminal: frames at 0 s, 15 s and 30 s,
// give-up at 45 s. Silent attempts also count into the shared refusal budget.
export const SUBSCRIBE_ACK_MAX_TIMEOUTS = 3

const pageSessionNonce = once(createUuidv4)

interface PersistedDocIdRecord {
  docId: string
  nonce: string
  expiresAt: number
}

function persistDocId(docId: string): void {
  try {
    const record: PersistedDocIdRecord = {
      docId,
      nonce: pageSessionNonce(),
      expiresAt: Date.now() + DOC_ID_TTL_MS
    }
    safeSessionStorage.setItem(DOC_ID_SESSION_KEY, JSON.stringify(record))
  } catch {
    return
  }
}

function readPersistedDocId(): string | null {
  try {
    const raw = safeSessionStorage.getItem(DOC_ID_SESSION_KEY)
    if (!raw) return null
    const record = JSON.parse(raw) as Partial<PersistedDocIdRecord>
    if (
      typeof record.docId !== 'string' ||
      record.docId.length === 0 ||
      typeof record.nonce !== 'string' ||
      typeof record.expiresAt !== 'number'
    ) {
      return null
    }
    if (record.nonce !== pageSessionNonce()) return null
    if (Date.now() >= record.expiresAt) return null
    return record.docId
  } catch {
    return null
  }
}

function clearPersistedDocId(): void {
  safeSessionStorage.removeItem(DOC_ID_SESSION_KEY)
}

export class AgentCrdtDocLifecycle {
  private subscribeRetryTimer: ReturnType<typeof setTimeout> | null = null
  private subscribeRetryAttempt = 0
  // The recency heartbeat: armed only while a subscribe is CONFIRMED (bound +
  // healthy by definition), slid forward by every doc-scoped frame, cancelled
  // by the same lifecycle exits as the subscribe retry. The probe is
  // `resubscribe()` (not `reconcile()`, which no-ops while intent equals
  // reality - and a stale channel's intent DOES equal reality). Within one
  // catch-up-gap episode (see `usedCatchUpGrace`), only the first confirmed
  // subscribe arms SUBSCRIBE_CATCHUP_GRACE_MS instead of the full budget;
  // every later confirm in the same episode, and every re-arm on live
  // traffic or on the probe firing, uses the full budget.
  private staleProbeTimer: ReturnType<typeof setTimeout> | null = null
  // Armed by every subscribe frame that leaves the transport, disarmed by its
  // answer (confirm or refusal). Expiry is the third outcome the bridge cannot
  // see: the frame was delivered, intent equals reality, and nothing answers.
  private ackTimer: ReturnType<typeof setTimeout> | null = null
  private ackTimeouts = 0
  // Latched after the silent budget is spent so neither the recency probe nor
  // a status-frame reconcile can turn the bounded retry into an unbounded one.
  // Released only by a lifecycle edge: confirm, reconnect, retarget.
  private gaveUp = false
  private recoverableGiveUpReason: Extract<
    SubscribeGiveUpReason,
    'retry_exhausted' | 'timeout'
  > | null = null
  private lastReportedRecoverableWorkflowId: string | null = null
  // The workflow id last notified (reportError + onGaveUp) for a permanent
  // refusal. A reconnect to the SAME workflow answered with the SAME
  // permanent code is one unchanged fact, not a new one - re-arm only when
  // the target actually changes (retarget/doc_reset) or a subscribe for it
  // actually succeeds (`onSubscribeConfirmed`), never on a bare reconnect
  // that never recovers. See `resetNotifiedGiveUp`.
  private lastNotifiedGiveUpWorkflowId: string | null = null
  // Stale-ack race: an ack-timeout resubscribe can leave the OLDER attempt
  // still outstanding at the doc-host while a NEWER one (sent on the same
  // lineage) confirms first. A confirm and a permanent refusal can never
  // both be the answer to the SAME subscribe, so once this is true, any
  // permanent refusal that arrives before another subscribe is sent cannot
  // be answering the one that just confirmed - it must be the older
  // attempt's late answer - and `onSubscribeRefused` discards it instead of
  // tearing down the confirm's own probe/latch. Cleared by the next actual
  // send (`onSubscribeSent`), which starts a fresh round.
  private confirmedSinceLastSend = false
  // FEC-5: `Date.now()` of the last persisted-record write by this instance.
  // A confirmed subscribe always writes; doc-scoped frames re-stamp the expiry
  // no more often than DOC_ID_REFRESH_INTERVAL_MS, so a doc that keeps
  // delivering frames keeps its rebind window instead of lapsing mid-session.
  private lastPersistedAt = 0
  // PM-1405: caps the fast catch-up probe to one shot per gap episode. Set on
  // the first confirmed subscribe of an episode, cleared when real content
  // arrives (the episode is over) or the episode restarts (bind/reconnect).
  private usedCatchUpGrace = false
  private socketClosed = false
  private silenceReconnectSpent = false

  constructor(
    private readonly workflowId: () => string | null,
    private readonly resubscribe: () => boolean | void,
    private readonly onGaveUp: (reason: SubscribeGiveUpReason) => void,
    private readonly reconnectTransport?: () => void
  ) {}

  readPersistedDocId(): string | null {
    return readPersistedDocId()
  }

  clearPersistedDocId(): void {
    clearPersistedDocId()
  }

  onSubscribeConfirmed(): void {
    this.clearAckTimer()
    this.gaveUp = false
    this.silenceReconnectSpent = false
    this.recoverableGiveUpReason = null
    this.confirmedSinceLastSend = true
    this.resetNotifiedGiveUp()
    this.clearSubscribeRetry()
    if (this.usedCatchUpGrace) {
      this.armStaleProbe()
    } else {
      this.usedCatchUpGrace = true
      this.armStaleProbe(SUBSCRIBE_CATCHUP_GRACE_MS)
    }
    const workflowId = this.workflowId()
    if (workflowId !== null) this.persistConfirmedDocId(workflowId)
  }

  /** Returns whether this refusal newly triggered a give-up notification. */
  onSubscribeRefused(code?: string): boolean {
    if (code !== undefined && isPermanentSubscribeRefusalCode(code)) {
      if (this.confirmedSinceLastSend) return false
      const supersedesRecoverableGiveUp = this.recoverableGiveUpReason !== null
      this.recoverableGiveUpReason = null
      if (supersedesRecoverableGiveUp) this.gaveUp = false
      this.clearAckTimer()
      this.clearStaleProbe()
      return this.giveUpPermanently(code, isNotifyingPermanentRefusalCode(code))
    }
    this.clearAckTimer()
    this.clearStaleProbe()
    this.scheduleSubscribeRetry()
    return false
  }

  refusalIsFinal(): boolean {
    return !this.confirmedSinceLastSend && this.subscribeRetryTimer === null
  }

  stopProbing(): void {
    this.clearAckTimer()
    this.clearSubscribeRetry()
    this.clearStaleProbe()
    this.gaveUp = true
    this.recoverableGiveUpReason = null
  }

  /** Drops the pending ack and probe while a socket reconnect answers the refusal. */
  awaitReconnect(): void {
    this.clearAckTimer()
    this.clearStaleProbe()
  }

  onSubscribeSent(workflowId: string): void {
    this.clearAckTimer()
    this.confirmedSinceLastSend = false
    if (this.gaveUp) return
    this.ackTimer = setTimeout(() => {
      this.ackTimer = null
      if (this.workflowId() !== workflowId) return
      this.ackTimeouts += 1
      if (
        this.ackTimeouts >= SUBSCRIBE_ACK_MAX_TIMEOUTS ||
        this.subscribeRetryAttempt >= SUBSCRIBE_RETRY_MAX_ATTEMPTS
      ) {
        if (this.reopenSilentSocket(workflowId)) return
        this.giveUp(
          workflowId,
          this.subscribeRetryAttempt >= SUBSCRIBE_RETRY_MAX_ATTEMPTS
            ? 'retry_exhausted'
            : 'timeout'
        )
        return
      }
      this.subscribeRetryAttempt += 1
      recordDevEvent('subscribe_ack_timeout', {
        attempt: this.subscribeRetryAttempt,
        workflowId
      })
      this.resubscribeOrScheduleRetry()
    }, SUBSCRIBE_ACK_TIMEOUT_MS)
  }

  /**
   * A new socket is a new server-side session: every budget starts over,
   * including the permanent-give-up latch (a redeployed host may now be
   * readable). `lastNotifiedGiveUpWorkflowId` deliberately survives this -
   * see `resetNotifiedGiveUp` - so a refusal that recurs for the same
   * workflow after reconnecting doesn't re-fire the notification.
   */
  onReconnected(): void {
    this.resetForNewAttempt()
  }

  /** Parks every timer until `onReconnected`. */
  onSocketClosed(): void {
    this.clearAckTimer()
    this.clearSubscribeRetry()
    this.clearStaleProbe()
    this.socketClosed = true
  }

  onDocumentUpdate(): void {
    this.usedCatchUpGrace = false
    if (this.staleProbeTimer !== null) this.armStaleProbe()
    this.refreshPersistedDocId()
  }

  onDocumentResult(): void {
    this.usedCatchUpGrace = false
    if (this.staleProbeTimer === null) return
    this.armStaleProbe()
    this.refreshPersistedDocId()
  }

  clearStaleProbe(): void {
    if (this.staleProbeTimer !== null) {
      clearTimeout(this.staleProbeTimer)
      this.staleProbeTimer = null
    }
  }

  private shouldDeferSubscribe(): boolean {
    return this.gaveUp || this.socketClosed || this.subscribeRetryTimer !== null
  }

  clearForRetarget(): void {
    this.resetForNewAttempt()
    this.resetNotifiedGiveUp()
    this.silenceReconnectSpent = false
  }

  /** Re-reads the bound document, deferring to a retry or give-up in progress. */
  refresh(): void {
    if (this.shouldDeferSubscribe()) return
    this.resubscribeOrScheduleRetry()
  }

  retry(): boolean {
    const reason = this.recoverableGiveUpReason
    if (reason === null) return false
    this.resetForNewAttempt()
    if (this.resubscribe() === true) return true
    this.gaveUp = true
    this.recoverableGiveUpReason = reason
    return false
  }

  /**
   * Lets a permanent refusal for a different episode of the same workflow
   * id notify again. Called when the subscribed target actually changes
   * (retarget), its lineage restarts (`doc_reset`), or it actually confirms
   * (`onSubscribeConfirmed`) - never on a bare reconnect that never
   * recovers, which keeps the same episode and the same unrecoverable fact.
   */
  resetNotifiedGiveUp(): void {
    this.lastNotifiedGiveUpWorkflowId = null
    this.lastReportedRecoverableWorkflowId = null
  }

  destroy(): void {
    this.clearForRetarget()
  }

  private persistConfirmedDocId(docId: string): void {
    persistDocId(docId)
    this.lastPersistedAt = Date.now()
  }

  private refreshPersistedDocId(): void {
    const workflowId = this.workflowId()
    if (workflowId === null) return
    if (Date.now() - this.lastPersistedAt < DOC_ID_REFRESH_INTERVAL_MS) return
    this.persistConfirmedDocId(workflowId)
  }

  private armStaleProbe(delayMs: number = STALE_AFTER_MS): void {
    this.clearStaleProbe()
    const isCatchUpProbe = delayMs !== STALE_AFTER_MS
    this.staleProbeTimer = setTimeout(() => {
      this.staleProbeTimer = null
      if (this.gaveUp) return
      this.armStaleProbe()
      if (this.ackTimer !== null) return
      recordDevEvent(isCatchUpProbe ? 'catchup_probe' : 'stale_probe', {
        workflowId: this.workflowId()
      })
      this.resubscribeOrScheduleRetry()
    }, delayMs)
  }

  private resetForNewAttempt(): void {
    this.clearAckTimer()
    this.clearSubscribeRetry()
    this.clearStaleProbe()
    this.gaveUp = false
    this.recoverableGiveUpReason = null
    this.usedCatchUpGrace = false
    this.socketClosed = false
  }

  private reopenSilentSocket(workflowId: string): boolean {
    if (this.reconnectTransport === undefined || this.silenceReconnectSpent)
      return false
    if (this.ackTimeouts < SUBSCRIBE_ACK_MAX_TIMEOUTS) return false
    this.silenceReconnectSpent = true
    this.onSocketClosed()
    recordDevEvent('subscribe_ack_reconnect', { workflowId })
    this.reconnectTransport()
    return true
  }

  private clearAckTimer(): void {
    if (this.ackTimer !== null) {
      clearTimeout(this.ackTimer)
      this.ackTimer = null
    }
  }

  /** Returns whether this call actually notified (reportError + onGaveUp). */
  private giveUpPermanently(code: string, notify: boolean): boolean {
    // A redelivered/duplicate refusal frame answers nothing new once the
    // latch is already set — without this guard it would re-run the report
    // and the caller's `onGaveUp` (toast/telemetry) a second time.
    if (this.gaveUp) return false
    this.gaveUp = true
    // An already-armed retry from an earlier, retryable refusal must not
    // survive the permanent latch: its callback checks only `workflowId()`,
    // not `gaveUp`, so left alone it would still fire a resubscribe later.
    this.clearSubscribeRetry()
    if (!notify) return false
    const workflowId = this.workflowId()
    // A reconnect that lands the same permanent code for the same workflow
    // is one unchanged fact - only a different workflow (retarget/doc_reset,
    // see `resetNotifiedGiveUp`) is a new one worth telling the person about.
    if (workflowId !== null && workflowId === this.lastNotifiedGiveUpWorkflowId)
      return false
    this.lastNotifiedGiveUpWorkflowId = workflowId
    recordDevEvent(
      'subscribe_refused_permanent',
      { code, terminal: true },
      { level: 'warn' }
    )
    reportError(new Error(`agent doc subscribe permanently refused: ${code}`), {
      surface: 'agent',
      errorType: 'failure_confirming_agent_doc_subscribe',
      level: 'warning',
      tags: { feature_area: 'agent', operation: 'sync', outcome: 'gave_up' }
    })
    this.onGaveUp('refused')
    return true
  }

  private giveUp(
    workflowId: string,
    reason: Extract<SubscribeGiveUpReason, 'retry_exhausted' | 'timeout'>
  ): void {
    this.clearStaleProbe()
    this.gaveUp = true
    this.recoverableGiveUpReason = reason
    recordDevEvent(
      reason === 'timeout' ? 'subscribe_ack_timeout' : 'subscribe_retry',
      { attempt: this.subscribeRetryAttempt, workflowId, terminal: true },
      { level: 'warn' }
    )
    if (workflowId !== this.lastReportedRecoverableWorkflowId) {
      this.lastReportedRecoverableWorkflowId = workflowId
      reportError(
        new Error(
          reason === 'timeout'
            ? 'agent doc subscribe was sent but never acknowledged'
            : 'agent doc subscription retries were exhausted'
        ),
        {
          surface: 'agent',
          errorType: 'failure_confirming_agent_doc_subscribe',
          level: 'warning',
          tags: { feature_area: 'agent', operation: 'sync', outcome: 'gave_up' }
        }
      )
    }
    this.onGaveUp(reason)
  }

  private clearSubscribeRetry(): void {
    if (this.subscribeRetryTimer !== null) {
      clearTimeout(this.subscribeRetryTimer)
      this.subscribeRetryTimer = null
    }
    this.subscribeRetryAttempt = 0
    this.ackTimeouts = 0
  }

  private scheduleSubscribeRetry(): void {
    if (this.shouldDeferSubscribe()) return
    const target = this.workflowId()
    if (target === null) return
    if (this.subscribeRetryAttempt >= SUBSCRIBE_RETRY_MAX_ATTEMPTS) {
      this.giveUp(target, 'retry_exhausted')
      return
    }
    const delay = SUBSCRIBE_RETRY_BASE_MS * 2 ** this.subscribeRetryAttempt
    this.subscribeRetryAttempt += 1
    this.subscribeRetryTimer = setTimeout(() => {
      this.subscribeRetryTimer = null
      if (this.workflowId() !== target) return
      recordDevEvent('subscribe_retry', {
        attempt: this.subscribeRetryAttempt,
        workflowId: target
      })
      this.resubscribeOrScheduleRetry()
    }, delay)
  }

  private resubscribeOrScheduleRetry(): void {
    if (this.resubscribe() !== false) return
    this.clearStaleProbe()
    this.scheduleSubscribeRetry()
  }
}
