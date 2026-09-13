import type { DraftFiles } from './workshop-draft-files'

const DATABASE = 'comfy-workshop-drafts'
const STORE = 'forms'
const MAX_DRAFTS = 4
const LIFETIME_MS = 60 * 60 * 1000
const TIMEOUT_MS = 5000

interface StoredDraft {
  readonly expiresAt: number
  readonly files: unknown
}

function pruneDrafts(store: IDBObjectStore) {
  const request = store.index('expiresAt').openKeyCursor(null, 'prev')
  let count = 0
  request.onsuccess = () => {
    const cursor = request.result
    if (!cursor) return
    if (Number(cursor.key) <= Date.now() || ++count > MAX_DRAFTS)
      store.delete(cursor.primaryKey)
    cursor.continue()
  }
}

function draftRequest(store: IDBObjectStore, key: string, draft?: StoredDraft) {
  if (draft) {
    const request = store.put(draft, key)
    pruneDrafts(store)
    return request
  }
  const request = store.get(key)
  store.delete(key)
  return request
}

function accessDraft(
  key: string,
  signal: AbortSignal,
  draft?: StoredDraft
): Promise<unknown> {
  return new Promise((resolve, reject) => {
    signal.throwIfAborted()
    let database: IDBDatabase | undefined
    let transaction: IDBTransaction | undefined
    let finished = false
    function finish(error?: unknown, value?: unknown) {
      if (finished) return
      finished = true
      clearTimeout(timeout)
      signal.removeEventListener('abort', abort)
      database?.close()
      if (error) reject(error)
      else resolve(value)
    }
    function abort() {
      transaction?.abort()
      finish(new DOMException('Draft storage cancelled', 'AbortError'))
    }
    const timeout = setTimeout(abort, TIMEOUT_MS)
    signal.addEventListener('abort', abort, { once: true })
    let request: IDBOpenDBRequest
    try {
      request = indexedDB.open(DATABASE, 1)
    } catch (error) {
      finish(error)
      return
    }
    request.onupgradeneeded = () => {
      request.result
        .createObjectStore(STORE)
        .createIndex('expiresAt', 'expiresAt')
    }
    request.onerror = () => finish(request.error)
    request.onsuccess = () => {
      database = request.result
      if (finished) {
        database.close()
        return
      }
      database.onversionchange = () => database?.close()
      try {
        transaction = database.transaction(STORE, 'readwrite')
        const operation = draftRequest(
          transaction.objectStore(STORE),
          key,
          draft
        )
        transaction.oncomplete = () => finish(undefined, operation.result)
        transaction.onabort = () =>
          finish(transaction?.error ?? new Error('Draft storage failed'))
        transaction.onerror = () =>
          finish(transaction?.error ?? new Error('Draft storage failed'))
      } catch (error) {
        finish(error)
      }
    }
  })
}

export async function storeWorkshopDraft(
  key: string,
  files: DraftFiles,
  signal: AbortSignal
): Promise<void> {
  await accessDraft(key, signal, { files, expiresAt: Date.now() + LIFETIME_MS })
}

export async function takeWorkshopDraft(
  key: string,
  signal: AbortSignal
): Promise<unknown> {
  const draft = await accessDraft(key, signal)
  if (
    !draft ||
    typeof draft !== 'object' ||
    !('expiresAt' in draft) ||
    typeof draft.expiresAt !== 'number' ||
    draft.expiresAt <= Date.now() ||
    !('files' in draft)
  )
    return undefined
  return draft.files
}
