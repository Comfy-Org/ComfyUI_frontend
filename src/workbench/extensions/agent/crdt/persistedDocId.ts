import { createUuidv4 } from '@/utils/uuid'
import { AGENT_CRDT_DOC_ID_SESSION_KEY } from '@/platform/workflow/persistence/base/storageKeyConstants'
import { MAX_AGENT_STORAGE_CLOCK_SKEW_MS } from '@/workbench/extensions/agent/persistenceTime'

// The per-tab record restores the in-memory doc binding after reload. Its
// per-page-load nonce prevents a duplicated tab from inheriting ownership,
// while the short expiry bounds how long an explicit reload may adopt it.
export const DOC_ID_SESSION_KEY = AGENT_CRDT_DOC_ID_SESSION_KEY
export const DOC_ID_TTL_MS = 5 * 60 * 1000

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
    .some((entry) => 'type' in entry && entry.type === 'reload')
}

export function reconcilePersistedDocId(): string | null {
  try {
    const raw = safeSessionStorage()?.getItem(DOC_ID_SESSION_KEY)
    if (!raw) return null
    const parsed: unknown = JSON.parse(raw)
    // Every rejection below also drops the key. Leaving a rejected record in
    // place would break the invariant the dock-mount reconcile relies on: a
    // duplicated tab that inherits a lapsed or legacy record would keep
    // re-reading and re-rejecting it on every reconcile instead of consuming it
    // once.
    // `Number.isFinite`, not `typeof === 'number'`: `JSON.parse` turns an
    // out-of-range literal such as `1e400` into `Infinity`, which is a number
    // and is never `<= Date.now()`, so a `typeof` check alone hands back a
    // record that can never expire.
    // The empty string is a string and would subscribe to a doc id of `''`,
    // so length is part of the shape check, not a separate caller concern.
    if (
      typeof parsed !== 'object' ||
      parsed === null ||
      !('docId' in parsed) ||
      typeof parsed.docId !== 'string' ||
      parsed.docId.length === 0 ||
      !('nonce' in parsed) ||
      typeof parsed.nonce !== 'string' ||
      !('expiresAt' in parsed) ||
      typeof parsed.expiresAt !== 'number' ||
      !Number.isFinite(parsed.expiresAt)
    ) {
      clearPersistedDocId()
      return null
    }
    const record: PersistedDocIdRecord = {
      docId: parsed.docId,
      nonce: parsed.nonce,
      expiresAt: parsed.expiresAt
    }
    const now = Date.now()
    if (
      now >= record.expiresAt ||
      record.expiresAt > now + DOC_ID_TTL_MS + MAX_AGENT_STORAGE_CLOCK_SKEW_MS
    ) {
      clearPersistedDocId()
      return null
    }
    if (record.nonce !== currentPageSessionNonce()) {
      if (!isReloadNavigation()) {
        clearPersistedDocId()
        return null
      }
      // Adoption preserves the original expiry, so reloads cannot extend the
      // fallback window.
      writeRecord({
        docId: record.docId,
        nonce: currentPageSessionNonce(),
        expiresAt: record.expiresAt
      })
    }
    return record.docId
  } catch {
    // A legacy bare doc id is not valid JSON, so it lands here rather than
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
