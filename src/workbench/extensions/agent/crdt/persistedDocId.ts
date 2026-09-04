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
// Exported so the identity-transition key list in the workflow persistence layer
// can be pinned to this spelling by test rather than by comment.
export const DOC_ID_SESSION_KEY = 'Comfy.Agent.CrdtDocId'
export const DOC_ID_TTL_MS = 5 * 60 * 1000
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

function writeRecord(record: PersistedDocIdRecord): void {
  try {
    safeSessionStorage()?.setItem(DOC_ID_SESSION_KEY, JSON.stringify(record))
  } catch {
    // Quota / privacy mode: persistence is best-effort.
  }
}

export function persistDocId(docId: string): void {
  writeRecord({
    docId,
    nonce: currentPageSessionNonce(),
    expiresAt: Date.now() + DOC_ID_TTL_MS
  })
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
    // Every rejection below also drops the key. Leaving a rejected record in
    // place would break the invariant the dock-mount reconcile relies on: a
    // duplicated tab that inherits a lapsed or pre-FEC-5 record would keep
    // re-reading and re-rejecting it on every reconcile instead of consuming it
    // once.
    if (
      typeof record.docId !== 'string' ||
      typeof record.nonce !== 'string' ||
      typeof record.expiresAt !== 'number'
    ) {
      clearPersistedDocId()
      return null
    }
    if (Date.now() >= record.expiresAt) {
      clearPersistedDocId()
      return null
    }
    if (record.nonce !== currentPageSessionNonce()) {
      if (!isReloadNavigation()) {
        clearPersistedDocId()
        return null
      }
      // Adoption renews the owner, never the lifetime. Re-stamping a full TTL
      // here would let a tab reloaded inside the window keep an arbitrarily old
      // doc id rebindable forever, removing the only bound the TTL places on
      // the same-page-load workflow-switch case.
      writeRecord({
        docId: record.docId,
        nonce: currentPageSessionNonce(),
        expiresAt: record.expiresAt
      })
    }
    return record.docId
  } catch {
    // A pre-FEC-5 bare doc id is not valid JSON, so it lands here rather than
    // in the shape check above; drop it so it is consumed exactly once.
    clearPersistedDocId()
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
