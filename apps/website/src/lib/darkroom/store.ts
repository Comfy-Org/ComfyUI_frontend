/**
 * Where Darkroom keeps what an account has made: every image with the
 * settings that made it, moodboards, and the requests still developing.
 *
 * This is the browser's own storage (IndexedDB), one database per account
 * and workspace, so a feed survives a reload and never mixes two accounts.
 * It lives behind `DarkroomStore` so a Cloud-backed library can replace it
 * without the page changing.
 */
import type { DarkroomRequest } from './request'
import type { DarkroomStats } from './response'

export interface DarkroomItem {
  readonly id: string
  /** Milliseconds since the epoch. */
  readonly created: number
  readonly mime: string
  readonly settings: DarkroomRequest
  readonly stats: DarkroomStats
  readonly text: readonly string[]
  readonly starred?: boolean
  /** Set while the image sits in the trash, where Undo can reach it. */
  readonly trashedAt?: number
  /** The asset this image was saved as in the account's Cloud library. */
  readonly cloudAssetId?: string
}

export interface DarkroomBoard {
  readonly id: string
  readonly name: string
  readonly created: number
  readonly updated: number
  /** Ids of generated images or of images uploaded to the board. */
  readonly items: readonly string[]
}

/** A request Router still holds, so a reload can pick it up again. */
export interface DarkroomPending {
  readonly requestId: string
  readonly settings: DarkroomRequest
  readonly created: number
  /** References sent with it. Their data is not kept, so it cannot be retried. */
  readonly imageCount: number
}

export interface DarkroomStore {
  items(): Promise<DarkroomItem[]>
  blob(id: string): Promise<Blob | undefined>
  saveItem(item: DarkroomItem, blob: Blob): Promise<void>
  patchItem(
    id: string,
    patch: Partial<Pick<DarkroomItem, 'starred' | 'cloudAssetId'>>
  ): Promise<void>
  trash(ids: readonly string[]): Promise<void>
  restore(ids: readonly string[]): Promise<DarkroomItem[]>
  boards(): Promise<DarkroomBoard[]>
  saveBoard(board: DarkroomBoard): Promise<void>
  deleteBoard(id: string): Promise<void>
  /** Keeps an image uploaded to a moodboard and returns its id. */
  saveUpload(blob: Blob): Promise<string>
  deleteUploads(ids: readonly string[]): Promise<void>
  pending(): Promise<DarkroomPending[]>
  savePending(pending: DarkroomPending): Promise<void>
  removePending(requestId: string): Promise<void>
  close(): void
}

/** Trash older than this is cleared for good the next time the store opens. */
export const TRASH_LIFETIME_MS = 24 * 60 * 60 * 1000
const UPLOAD_PREFIX = 'upload-'

export const isUploadId = (id: string) => id.startsWith(UPLOAD_PREFIX)

export function darkroomId(
  now = Date.now(),
  random: () => string = () => crypto.randomUUID().slice(0, 8)
): string {
  return `${now.toString(36)}-${random()}`
}

const ITEMS = 'items'
const BLOBS = 'blobs'
const BOARDS = 'boards'
const PENDING = 'pending'
const STORES = [ITEMS, BLOBS, BOARDS, PENDING] as const
type StoreName = (typeof STORES)[number]

function settled<T>(request: IDBRequest<T>): Promise<T> {
  return new Promise((resolve, reject) => {
    request.onsuccess = () => resolve(request.result)
    request.onerror = () => reject(request.error)
  })
}

function committed(transaction: IDBTransaction): Promise<void> {
  return new Promise((resolve, reject) => {
    transaction.oncomplete = () => resolve()
    transaction.onerror = () => reject(transaction.error)
    transaction.onabort = () => reject(transaction.error)
  })
}

function openDatabase(name: string): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(name, 1)
    request.onupgradeneeded = () => {
      const database = request.result
      database.createObjectStore(ITEMS, { keyPath: 'id' })
      database.createObjectStore(BLOBS)
      database.createObjectStore(BOARDS, { keyPath: 'id' })
      database.createObjectStore(PENDING, { keyPath: 'requestId' })
    }
    request.onsuccess = () => resolve(request.result)
    request.onerror = () => reject(request.error)
    request.onblocked = () => reject(new Error('Darkroom storage is blocked'))
  })
}

function darkroomDatabaseName(uid: string, workspaceId: string): string {
  return `comfy-darkroom:${uid}:${workspaceId}`
}

/** Opens the store for one account and clears trash that has aged out. */
export async function openDarkroomStore(
  uid: string,
  workspaceId: string,
  now: () => number = Date.now
): Promise<DarkroomStore> {
  const database = await openDatabase(darkroomDatabaseName(uid, workspaceId))

  async function write<T>(
    names: readonly StoreName[],
    action: (store: (name: StoreName) => IDBObjectStore) => T
  ): Promise<T> {
    const transaction = database.transaction([...names], 'readwrite')
    const done = committed(transaction)
    const result = action((name) => transaction.objectStore(name))
    await done
    return result
  }

  function all<T>(name: StoreName): Promise<T[]> {
    return settled<T[]>(
      database.transaction(name, 'readonly').objectStore(name).getAll()
    )
  }

  async function setTrashed(
    ids: readonly string[],
    trashedAt: number | undefined
  ): Promise<DarkroomItem[]> {
    const wanted = new Set(ids)
    const changed = (await all<DarkroomItem>(ITEMS))
      .filter((item) => wanted.has(item.id))
      .map(({ trashedAt: _previous, ...item }) =>
        trashedAt === undefined ? item : { ...item, trashedAt }
      )
    await write([ITEMS], (store) => {
      for (const item of changed) store(ITEMS).put(item)
    })
    return changed
  }

  const expired = (await all<DarkroomItem>(ITEMS)).filter(
    (item) =>
      item.trashedAt !== undefined && now() - item.trashedAt > TRASH_LIFETIME_MS
  )
  if (expired.length)
    await write([ITEMS, BLOBS], (store) => {
      for (const item of expired) {
        store(ITEMS).delete(item.id)
        store(BLOBS).delete(item.id)
      }
    })

  return {
    async items() {
      return (await all<DarkroomItem>(ITEMS))
        .filter((item) => item.trashedAt === undefined)
        .sort((a, b) => b.created - a.created)
    },
    blob(id) {
      return settled<Blob | undefined>(
        database.transaction(BLOBS, 'readonly').objectStore(BLOBS).get(id)
      )
    },
    async saveItem(item, blob) {
      await write([ITEMS, BLOBS], (store) => {
        store(ITEMS).put(item)
        store(BLOBS).put(blob, item.id)
      })
    },
    async patchItem(id, patch) {
      const item = await settled<DarkroomItem | undefined>(
        database.transaction(ITEMS, 'readonly').objectStore(ITEMS).get(id)
      )
      if (!item) return
      const { starred, ...rest } = { ...item, ...patch }
      const next = starred ? { ...rest, starred: true } : rest
      await write([ITEMS], (store) => {
        store(ITEMS).put(next)
      })
    },
    async trash(ids) {
      await setTrashed(ids, now())
    },
    restore(ids) {
      return setTrashed(ids, undefined)
    },
    boards() {
      return all<DarkroomBoard>(BOARDS)
    },
    async saveBoard(board) {
      await write([BOARDS], (store) => {
        store(BOARDS).put(board)
      })
    },
    async deleteBoard(id) {
      await write([BOARDS], (store) => {
        store(BOARDS).delete(id)
      })
    },
    async saveUpload(blob) {
      const id = `${UPLOAD_PREFIX}${darkroomId(now())}`
      await write([BLOBS], (store) => {
        store(BLOBS).put(blob, id)
      })
      return id
    },
    async deleteUploads(ids) {
      await write([BLOBS], (store) => {
        for (const id of ids.filter(isUploadId)) store(BLOBS).delete(id)
      })
    },
    pending() {
      return all<DarkroomPending>(PENDING)
    },
    async savePending(pending) {
      await write([PENDING], (store) => {
        store(PENDING).put(pending)
      })
    },
    async removePending(requestId) {
      await write([PENDING], (store) => {
        store(PENDING).delete(requestId)
      })
    },
    close() {
      database.close()
    }
  }
}
