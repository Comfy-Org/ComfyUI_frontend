import { createUuidv4 } from '@/utils/uuid'

// FE-1902: the doc id is otherwise held only in memory (set on turn ack), so a
// panel remount or reload loses the binding until the next turn ack. Persist it
// per-tab in sessionStorage so the follower can rebind immediately.
//
// FEC-5: a bare doc id has no owner and no lifetime, so the record carries a
// per-page-load nonce and a short expiry. Browser-tab duplication clones
// sessionStorage, but the cloud dock mount reconciles this record before its
// lazy panel boundary: a duplicated tab gets a fresh nonce and consumes the
// inherited record on its first load, even when the panel stays closed. An
// explicit reload may adopt the previous page load's unexpired record.
const DOC_ID_SESSION_KEY = 'Comfy.Agent.CrdtDocId'
const DOC_ID_TTL_MS = 5 * 60 * 1000
export const DOC_ID_REFRESH_INTERVAL_MS = DOC_ID_TTL_MS / 2

let pageSessionNonce: string | undefined

interface PersistedDocIdRecord {
  docId: string
  nonce: string
  expiresAt: number
}

function currentPageSessionNonce(): string {
  pageSessionNonce ??= createUuidv4()
  return pageSessionNonce
}

function safeSessionStorage(): Storage | null {
  try {
    return window.sessionStorage
  } catch {
    return null
  }
}

export function persistDocId(docId: string): void {
  try {
    const record: PersistedDocIdRecord = {
      docId,
      nonce: currentPageSessionNonce(),
      expiresAt: Date.now() + DOC_ID_TTL_MS
    }
    safeSessionStorage()?.setItem(DOC_ID_SESSION_KEY, JSON.stringify(record))
  } catch {
    // Quota / privacy mode: persistence is best-effort.
  }
}

function isReloadNavigation(): boolean {
  return performance
    .getEntriesByType('navigation')
    .some((entry) => (entry as PerformanceNavigationTiming).type === 'reload')
}

export function reconcilePersistedDocId(): string | null {
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
    if (Date.now() >= record.expiresAt) return null
    if (record.nonce !== currentPageSessionNonce()) {
      if (!isReloadNavigation()) {
        clearPersistedDocId()
        return null
      }
      persistDocId(record.docId)
    }
    return record.docId
  } catch {
    return null
  }
}

export function clearPersistedDocId(): void {
  try {
    safeSessionStorage()?.removeItem(DOC_ID_SESSION_KEY)
  } catch {
    // Best-effort.
  }
}
