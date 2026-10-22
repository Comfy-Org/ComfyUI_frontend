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

type DraftOperation =
  | { type: 'read' | 'delete'; key: string }
  | { type: 'write'; key: string; draft: StoredDraft }
  | { type: 'prune'; limit: number }

function pruneDrafts(store: IDBObjectStore, limit = MAX_DRAFTS) {
  const request = store.index('expiresAt').openKeyCursor(null, 'prev')
  let count = 0
  request.onsuccess = () => {
    const cursor = request.result
    if (!cursor) return
    if (Number(cursor.key) <= Date.now() || ++count > limit)
      store.delete(cursor.primaryKey)
    cursor.continue()
  }
}

function draftRequest(store: IDBObjectStore, operation: DraftOperation) {
  switch (operation.type) {
    case 'prune':
      pruneDrafts(store, operation.limit)
      return undefined
    case 'write': {
      const request = store.put(operation.draft, operation.key)
      pruneDrafts(store)
      return request
    }
    case 'read':
      pruneDrafts(store)
      return store.get(operation.key)
    case 'delete':
      return store.delete(operation.key)
  }
}

function accessDraft(
  operation: DraftOperation,
  signal: AbortSignal,
  deadline = performance.now() + TIMEOUT_MS
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
    const timeout = setTimeout(abort, Math.max(0, deadline - performance.now()))
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
        const result = draftRequest(transaction.objectStore(STORE), operation)
        transaction.oncomplete = () => finish(undefined, result?.result)
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
  const deadline = performance.now() + TIMEOUT_MS
  await accessDraft({ type: 'prune', limit: MAX_DRAFTS - 1 }, signal, deadline)
  await accessDraft(
    {
      type: 'write',
      key,
      draft: { files, expiresAt: Date.now() + LIFETIME_MS }
    },
    signal,
    deadline
  )
}

export async function deleteWorkshopDraft(
  key: string,
  signal: AbortSignal
): Promise<void> {
  await accessDraft({ type: 'delete', key }, signal)
}

export async function readWorkshopDraft(
  key: string,
  signal: AbortSignal
): Promise<unknown> {
  const draft = await accessDraft({ type: 'read', key }, signal)
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
