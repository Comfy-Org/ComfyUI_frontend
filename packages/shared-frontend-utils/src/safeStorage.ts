type StorageBackend = 'localStorage' | 'sessionStorage' | 'memory'

type NativeBackend = Exclude<StorageBackend, 'memory'>

type StorageWriteResult = 'ok' | 'quota-exceeded' | 'failed'

type StorageReadOutcome =
  | { ok: true; value: string | null }
  | { ok: false; error: unknown }

type StorageRemoveOutcome = { ok: true } | { ok: false; error: unknown }

export type StorageWriteOutcome =
  | { result: 'ok' }
  | { result: 'quota-exceeded' | 'failed'; error: unknown }

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

export class SafeStorage {
  private resolved: StorageBackend | undefined
  private memory: Storage | undefined

  constructor(private readonly chain: readonly NativeBackend[]) {}

  private resolve(): { backend: StorageBackend; storage: Storage } {
    const selected = this.resolved
    if (selected !== undefined && selected !== 'memory') {
      const storage = readNative(selected)
      if (storage) return { backend: selected, storage }
    }
    if (selected !== 'memory') {
      const start =
        selected === undefined ? 0 : this.chain.indexOf(selected) + 1
      for (const backend of this.chain.slice(start)) {
        const storage = readNative(backend)
        if (storage && isReadable(storage)) {
          this.resolved = backend
          return { backend, storage }
        }
      }
      this.resolved = 'memory'
    }
    return {
      backend: 'memory',
      storage: (this.memory ??= createMemoryStorage())
    }
  }

  reset(): void {
    this.resolved = undefined
    this.memory = undefined
  }

  get backend(): StorageBackend {
    return this.resolve().backend
  }

  get isPersistent(): boolean {
    return this.backend !== 'memory'
  }

  getItem(key: string): string | null {
    const outcome = this.read(key)
    return outcome.ok ? outcome.value : null
  }

  read(key: string): StorageReadOutcome {
    try {
      return { ok: true, value: this.resolve().storage.getItem(key) }
    } catch (error) {
      return { ok: false, error }
    }
  }

  setItem(key: string, value: string): StorageWriteResult {
    return this.write(key, value).result
  }

  write(key: string, value: string): StorageWriteOutcome {
    try {
      this.resolve().storage.setItem(key, value)
      return { result: 'ok' }
    } catch (error) {
      return {
        result: isQuotaExceeded(error) ? 'quota-exceeded' : 'failed',
        error
      }
    }
  }

  removeItem(key: string): void {
    this.remove(key)
  }

  remove(key: string): StorageRemoveOutcome {
    try {
      this.resolve().storage.removeItem(key)
      return { ok: true }
    } catch (error) {
      return { ok: false, error }
    }
  }

  keys(): string[] {
    try {
      const storage = this.resolve().storage
      const keys: string[] = []
      for (let i = 0; i < storage.length; i++) {
        const key = storage.key(i)
        if (key !== null) keys.push(key)
      }
      return keys
    } catch {
      return []
    }
  }

  asStorage(): Storage {
    return this.resolve().storage
  }

  isStorageArea(area: Storage | null | undefined): boolean {
    if (!area) return false
    try {
      return area === this.resolve().storage
    } catch {
      return false
    }
  }
}

export const safeLocalStorage = new SafeStorage([
  'localStorage',
  'sessionStorage'
])

export const safeSessionStorage = new SafeStorage(['sessionStorage'])
