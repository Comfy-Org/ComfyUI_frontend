type StorageBackend = 'localStorage' | 'sessionStorage' | 'memory'

type NativeBackend = Exclude<StorageBackend, 'memory'>

type StorageWriteResult = 'ok' | 'quota-exceeded' | 'failed'

type StorageReadOutcome =
  | { ok: true; value: string | null }
  | { ok: false; error: unknown }

export type StorageWriteOutcome =
  | { result: 'ok' }
  | { result: 'quota-exceeded' | 'failed'; error: unknown }

/** Web Storage access that never throws; see safeLocalStorage / safeSessionStorage. */
export interface SafeStorage {
  /** @internal Forgets the chosen backend and memory contents; tests only. */
  reset(): void
  /** Backend in use: localStorage → sessionStorage → memory. */
  readonly backend: StorageBackend
  /** False when writes only live in memory. */
  readonly isPersistent: boolean
  getItem(key: string): string | null
  /** Like getItem, but tells a failed read apart from a missing key. */
  read(key: string): StorageReadOutcome
  setItem(key: string, value: string): StorageWriteResult
  /** Like setItem, but keeps the caught error for reporting. */
  write(key: string, value: string): StorageWriteOutcome
  removeItem(key: string): void
  keys(): string[]
  /** Raw backing store for APIs that require a `Storage`; its methods are unguarded. */
  asStorage(): Storage
  isStorageArea(area: Storage | null | undefined): boolean
}

function isQuotaExceeded(error: unknown): boolean {
  return (
    error instanceof DOMException &&
    (error.name === 'QuotaExceededError' ||
      error.name === 'NS_ERROR_DOM_QUOTA_REACHED' ||
      error.code === 22 ||
      error.code === 1014)
  )
}

function readNative(kind: NativeBackend): Storage | undefined {
  try {
    return globalThis[kind]
  } catch {
    return undefined
  }
}

function isReadable(storage: Storage): boolean {
  try {
    storage.getItem('__comfy_storage_probe__')
    return true
  } catch {
    return false
  }
}

function createMemoryStorage(): Storage {
  const data = new Map<string, string>()
  return {
    get length() {
      return data.size
    },
    clear: () => data.clear(),
    getItem: (key) => data.get(key) ?? null,
    key: (index) => [...data.keys()][index] ?? null,
    removeItem: (key) => {
      data.delete(key)
    },
    setItem: (key, value) => {
      data.set(key, value)
    }
  }
}

/** @internal */
export function createSafeStorage(
  chain: readonly NativeBackend[]
): SafeStorage {
  let resolved: NativeBackend | 'memory' | undefined
  let memory: Storage | undefined

  function firstUsable(
    candidates: readonly NativeBackend[]
  ): NativeBackend | 'memory' {
    return (
      candidates.find((kind) => {
        const storage = readNative(kind)
        return storage !== undefined && isReadable(storage)
      }) ?? 'memory'
    )
  }

  function resolve(): NativeBackend | 'memory' {
    resolved ??= firstUsable(chain)
    return resolved
  }

  function memoryStore(): Storage {
    memory ??= createMemoryStorage()
    return memory
  }

  function effective(): NativeBackend | 'memory' {
    const kind = resolve()
    if (kind === 'memory' || readNative(kind)) return kind
    resolved = firstUsable(chain.slice(chain.indexOf(kind) + 1))
    return resolved
  }

  function current(): Storage {
    const kind = effective()
    if (kind === 'memory') return memoryStore()
    return readNative(kind) ?? memoryStore()
  }

  function write(key: string, value: string): StorageWriteOutcome {
    try {
      current().setItem(key, value)
      return { result: 'ok' }
    } catch (error) {
      return {
        result: isQuotaExceeded(error) ? 'quota-exceeded' : 'failed',
        error
      }
    }
  }

  return {
    reset() {
      resolved = undefined
      memory = undefined
    },
    get backend() {
      return effective()
    },
    get isPersistent() {
      return effective() !== 'memory'
    },
    getItem(key) {
      try {
        return current().getItem(key)
      } catch {
        return null
      }
    },
    read(key) {
      try {
        return { ok: true, value: current().getItem(key) }
      } catch (error) {
        return { ok: false, error }
      }
    },
    setItem(key, value) {
      return write(key, value).result
    },
    write,
    removeItem(key) {
      try {
        current().removeItem(key)
      } catch {
        return
      }
    },
    keys() {
      try {
        const storage = current()
        const keys: string[] = []
        for (let i = 0; i < storage.length; i++) {
          const key = storage.key(i)
          if (key !== null) keys.push(key)
        }
        return keys
      } catch {
        return []
      }
    },
    asStorage() {
      return current()
    },
    isStorageArea(area) {
      if (!area) return false
      try {
        return area === current()
      } catch {
        return false
      }
    }
  }
}

export const safeLocalStorage: SafeStorage = createSafeStorage([
  'localStorage',
  'sessionStorage'
])

export const safeSessionStorage: SafeStorage = createSafeStorage([
  'sessionStorage'
])
