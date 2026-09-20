import { reportError } from '@/platform/telemetry/reportError'
import { createUuidv4 } from '@/utils/uuid'

import { recordDevEvent } from './devPanelLog'

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

/**
 * A `doc_subscribe` that left the transport and was never answered is retried
 * on the same lineage after this long. The ingest relay's own resync budget is
 * 15 s, so a shorter window would stack a duplicate subscribe behind a slow but
 * live catch-up.
 */
export const SUBSCRIBE_ACK_TIMEOUT_MS = 15_000
// The third unanswered attempt is terminal: frames at 0 s, 15 s and 30 s,
// give-up at 45 s. Silent attempts also count into the shared refusal budget.
const SUBSCRIBE_ACK_MAX_TIMEOUTS = 3

/**
 * Recency heartbeat budget (BE-9740's FE half): a bound, healthy channel that
 * delivers NO doc-scoped frame for this long gets ONE active probe - a
 * resubscribe whose state-vector catch-up is a no-op on a healthy channel and
 * exactly the observed recovery on a stale one. A stale channel and an idle
 * workflow look identical passively, so expiry probes instead of alarming.
 */
export const STALE_AFTER_MS = 30_000

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

function readPersistedDocId(): string | null {
  try {
    const raw = safeSessionStorage()?.getItem(DOC_ID_SESSION_KEY)
    if (!raw) return null
    const record = JSON.parse(raw) as Partial<PersistedDocIdRecord>
    if (
      typeof record.docId !== 'string' ||
      record.docId.length === 0 ||
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

export class AgentCrdtDocLifecycle {
  private subscribeRetryTimer: ReturnType<typeof setTimeout> | null = null
  private subscribeRetryAttempt = 0
  // The recency heartbeat: armed only while a subscribe is CONFIRMED (bound +
  // healthy by definition), slid forward by every doc-scoped frame, cancelled
  // by the same lifecycle exits as the subscribe retry. The probe is
  // `resubscribe()` (not `reconcile()`, which no-ops while intent equals
  // reality - and a stale channel's intent DOES equal reality).
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
  // FEC-5: `Date.now()` of the last persisted-record write by this instance.
  // A confirmed subscribe always writes; doc-scoped frames re-stamp the expiry
  // no more often than DOC_ID_REFRESH_INTERVAL_MS, so a doc that keeps
  // delivering frames keeps its rebind window instead of lapsing mid-session.
  private lastPersistedAt = 0

  constructor(
    private readonly workflowId: () => string | null,
    private readonly resubscribe: () => void,
    private readonly onGaveUp: () => void
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
    this.clearSubscribeRetry()
    this.armStaleProbe()
    const workflowId = this.workflowId()
    if (workflowId !== null) this.persistConfirmedDocId(workflowId)
  }

  onSubscribeRefused(): void {
    this.clearAckTimer()
    this.clearStaleProbe()
    this.scheduleSubscribeRetry()
  }

  onSubscribeSent(workflowId: string): void {
    this.clearAckTimer()
    if (this.gaveUp) return
    this.ackTimer = setTimeout(() => {
      this.ackTimer = null
      if (this.workflowId() !== workflowId) return
      this.ackTimeouts += 1
      if (
        this.ackTimeouts >= SUBSCRIBE_ACK_MAX_TIMEOUTS ||
        this.subscribeRetryAttempt >= SUBSCRIBE_RETRY_MAX_ATTEMPTS
      ) {
        this.giveUp(workflowId)
        return
      }
      this.subscribeRetryAttempt += 1
      recordDevEvent('subscribe_ack_timeout', {
        attempt: this.subscribeRetryAttempt,
        workflowId
      })
      this.resubscribe()
    }, SUBSCRIBE_ACK_TIMEOUT_MS)
  }

  /** A new socket is a new server-side session: every budget starts over. */
  onReconnected(): void {
    this.clearForRetarget()
  }

  onDocumentUpdate(): void {
    if (this.staleProbeTimer !== null) this.armStaleProbe()
    this.refreshPersistedDocId()
  }

  onDocumentResult(): void {
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

  shouldDeferSubscribe(): boolean {
    return this.gaveUp || this.subscribeRetryTimer !== null
  }

  clearForRetarget(): void {
    this.clearAckTimer()
    this.clearSubscribeRetry()
    this.clearStaleProbe()
    this.gaveUp = false
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

  private armStaleProbe(): void {
    this.clearStaleProbe()
    this.staleProbeTimer = setTimeout(() => {
      this.staleProbeTimer = null
      if (this.gaveUp) return
      this.armStaleProbe()
      // A probe that is still awaiting its own answer is the ack timer's job.
      if (this.ackTimer !== null) return
      recordDevEvent('stale_probe', { workflowId: this.workflowId() })
      this.resubscribe()
    }, STALE_AFTER_MS)
  }

  private clearAckTimer(): void {
    if (this.ackTimer !== null) {
      clearTimeout(this.ackTimer)
      this.ackTimer = null
    }
  }

  private giveUp(workflowId: string): void {
    this.clearStaleProbe()
    this.gaveUp = true
    recordDevEvent(
      'subscribe_ack_timeout',
      { attempt: this.subscribeRetryAttempt, workflowId, terminal: true },
      { level: 'warn' }
    )
    reportError(
      new Error('agent doc subscribe was sent but never acknowledged'),
      {
        errorType: 'failure_confirming_agent_doc_subscribe',
        level: 'warning',
        tags: { feature_area: 'agent', operation: 'sync', outcome: 'gave_up' }
      }
    )
    this.onGaveUp()
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
    if (this.subscribeRetryAttempt >= SUBSCRIBE_RETRY_MAX_ATTEMPTS) return
    const target = this.workflowId()
    if (target === null) return
    const delay = SUBSCRIBE_RETRY_BASE_MS * 2 ** this.subscribeRetryAttempt
    this.subscribeRetryAttempt += 1
    this.subscribeRetryTimer = setTimeout(() => {
      this.subscribeRetryTimer = null
      if (this.workflowId() !== target) return
      recordDevEvent('subscribe_retry', {
        attempt: this.subscribeRetryAttempt,
        workflowId: target
      })
      this.resubscribe()
    }, delay)
  }
}
