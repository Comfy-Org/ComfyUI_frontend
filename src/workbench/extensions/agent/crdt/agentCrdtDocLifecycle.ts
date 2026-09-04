import { createUuidv4 } from '@/utils/uuid'

import { recordDevEvent } from './devPanelLog'

const DOC_ID_SESSION_KEY = 'Comfy.Agent.CrdtDocId'
const DOC_ID_TTL_MS = 5 * 60 * 1000
const DOC_ID_REFRESH_INTERVAL_MS = DOC_ID_TTL_MS / 2
const SUBSCRIBE_RETRY_BASE_MS = 500
const SUBSCRIBE_RETRY_MAX_ATTEMPTS = 6

export const STALE_AFTER_MS = 30_000

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
      typeof record.nonce !== 'string' ||
      typeof record.expiresAt !== 'number'
    ) {
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

/** Owns retry, recency, and confirmed-document persistence for one follower mount. */
export class AgentCrdtDocLifecycle {
  private subscribeRetryTimer: ReturnType<typeof setTimeout> | null = null
  private subscribeRetryAttempt = 0
  private staleProbeTimer: ReturnType<typeof setTimeout> | null = null
  private lastPersistedAt = 0

  constructor(
    private readonly workflowId: () => string | null,
    private readonly resubscribe: () => void
  ) {}

  readPersistedDocId(): string | null {
    return readPersistedDocId()
  }

  clearPersistedDocId(): void {
    clearPersistedDocId()
  }

  onSubscribeConfirmed(): void {
    this.clearSubscribeRetry()
    this.armStaleProbe()
    const workflowId = this.workflowId()
    if (workflowId !== null) this.persistConfirmedDocId(workflowId)
  }

  onSubscribeRefused(): void {
    this.clearStaleProbe()
    this.scheduleSubscribeRetry()
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

  clearForRetarget(): void {
    this.clearSubscribeRetry()
    this.clearStaleProbe()
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
      recordDevEvent('stale_probe', { workflowId: this.workflowId() })
      this.resubscribe()
      this.armStaleProbe()
    }, STALE_AFTER_MS)
  }

  private clearSubscribeRetry(): void {
    if (this.subscribeRetryTimer !== null) {
      clearTimeout(this.subscribeRetryTimer)
      this.subscribeRetryTimer = null
    }
    this.subscribeRetryAttempt = 0
  }

  private scheduleSubscribeRetry(): void {
    if (this.subscribeRetryTimer !== null) return
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
