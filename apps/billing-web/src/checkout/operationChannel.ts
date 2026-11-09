/**
 * How sibling tabs on the same checkout hear that an operation started or
 * settled. A notice is a nudge, never state: a tab that receives one re-reads
 * the server, so a forged or stale notice can at worst cost a read. The
 * channel is scoped to one signed-in user and one workspace, like the
 * operation pointer, and a notice for any other workspace is dropped.
 *
 * BroadcastChannel where the browser has it; otherwise the `storage` event on
 * a localStorage key, which also fires only in other tabs. Feature detection
 * follows `crossTabRefresh.ts`: a present API can still refuse construction,
 * so it is probed once and the fallback used whenever it does.
 */
export interface OperationNotice {
  readonly workspaceId: string
  readonly operationId: string
  readonly kind: 'started' | 'settled'
}

export interface OperationChannel {
  readonly publish: (notice: OperationNotice) => void
  /** Hands over a sibling's notice for this workspace; returns the unsubscribe. */
  readonly subscribe: (
    listener: (notice: OperationNotice) => void
  ) => () => void
  readonly close: () => void
}

export function operationChannelName(uid: string, workspaceId: string): string {
  return `comfy:billing:op:${uid}:${workspaceId}`
}

const NOTICE_KIND: Readonly<Record<OperationNotice['kind'], true>> = {
  started: true,
  settled: true
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null
}

function isNotice(value: unknown): value is OperationNotice {
  if (!isRecord(value)) return false
  return (
    typeof value.workspaceId === 'string' &&
    typeof value.operationId === 'string' &&
    Object.hasOwn(NOTICE_KIND, String(value.kind))
  )
}

/** Only a notice for the workspace this channel is scoped to reaches the listener. */
function scopedListener(
  workspaceId: string,
  listener: (notice: OperationNotice) => void
): (value: unknown) => void {
  return (value) => {
    if (isNotice(value) && value.workspaceId === workspaceId) listener(value)
  }
}

function broadcastChannelAvailable(): boolean {
  if (typeof BroadcastChannel === 'undefined') return false
  try {
    new BroadcastChannel('@comfyorg/billing-web op-channel probe').close()
    return true
  } catch {
    return false
  }
}

function broadcastChannelOf(
  name: string,
  workspaceId: string
): OperationChannel {
  const channel = new BroadcastChannel(name)
  return {
    publish: (notice) => channel.postMessage(notice),
    subscribe: (listener) => {
      const scoped = scopedListener(workspaceId, listener)
      const handler = (event: MessageEvent) => scoped(event.data)
      channel.addEventListener('message', handler)
      return () => channel.removeEventListener('message', handler)
    },
    close: () => channel.close()
  }
}

function parsed(value: string): unknown {
  try {
    return JSON.parse(value)
  } catch {
    return undefined
  }
}

function storageChannelOf(
  name: string,
  workspaceId: string,
  storage: Storage,
  target: Window
): OperationChannel {
  const handlers = new Set<(event: StorageEvent) => void>()
  return {
    publish: (notice) => {
      // The event fires only when the value changes, so each notice is stamped.
      storage.setItem(
        name,
        JSON.stringify({ ...notice, at: Date.now(), nonce: Math.random() })
      )
    },
    subscribe: (listener) => {
      const scoped = scopedListener(workspaceId, listener)
      const handler = (event: StorageEvent) => {
        if (event.key === name && event.newValue !== null)
          scoped(parsed(event.newValue))
      }
      handlers.add(handler)
      target.addEventListener('storage', handler)
      return () => {
        handlers.delete(handler)
        target.removeEventListener('storage', handler)
      }
    },
    close: () => {
      for (const handler of handlers)
        target.removeEventListener('storage', handler)
      handlers.clear()
    }
  }
}

function localStorageOf(): Storage | undefined {
  try {
    return globalThis.localStorage
  } catch {
    return undefined
  }
}

/** Undefined where neither transport exists, such as a non-browser environment. */
export function createOperationChannel(
  uid: string,
  workspaceId: string
): OperationChannel | undefined {
  const name = operationChannelName(uid, workspaceId)
  if (broadcastChannelAvailable()) return broadcastChannelOf(name, workspaceId)
  const storage = localStorageOf()
  if (storage === undefined || typeof window === 'undefined') return undefined
  return storageChannelOf(name, workspaceId, storage, window)
}
