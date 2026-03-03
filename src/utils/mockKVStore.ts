type Identifiable = { id: string }

interface KVCollection<T extends Identifiable> {
  create(data: Omit<T, 'id'> & Partial<Pick<T, 'id'>>): T
  get(id: string): T | null
  update(id: string, partial: Partial<T>): T | null
  delete(id: string): boolean
  list(): T[]
  find(predicate: (item: T) => boolean): T[]
  clear(): void
}

interface MockKVStore {
  get<T>(key: string): T | null
  set<T>(key: string, value: T): void
  delete(key: string): boolean
  keys(prefix?: string): string[]
  clear(): void
  collection<T extends Identifiable>(name: string): KVCollection<T>
}

function generateId(): string {
  return `${Date.now()}-${Math.random().toString(36).slice(2, 9)}`
}

export function useMockKVStore(namespace: string): MockKVStore {
  const prefix = `mockKV:${namespace}:`

  function prefixedKey(key: string): string {
    return `${prefix}${key}`
  }

  function get<T>(key: string): T | null {
    const raw = localStorage.getItem(prefixedKey(key))
    if (raw === null) return null
    try {
      return JSON.parse(raw) as T
    } catch {
      return null
    }
  }

  function set<T>(key: string, value: T): void {
    localStorage.setItem(prefixedKey(key), JSON.stringify(value))
  }

  function deleteEntry(key: string): boolean {
    const exists = localStorage.getItem(prefixedKey(key)) !== null
    localStorage.removeItem(prefixedKey(key))
    return exists
  }

  function keys(filterPrefix?: string): string[] {
    const result: string[] = []
    const fullPrefix = filterPrefix ? `${prefix}${filterPrefix}` : prefix
    for (let i = 0; i < localStorage.length; i++) {
      const key = localStorage.key(i)
      if (key?.startsWith(fullPrefix)) {
        result.push(key.slice(prefix.length))
      }
    }
    return result
  }

  function clear(): void {
    const toRemove = keys()
    for (const key of toRemove) {
      localStorage.removeItem(prefixedKey(key))
    }
  }

  function collection<T extends Identifiable>(name: string): KVCollection<T> {
    const collectionPrefix = `${name}:`

    return {
      create(data) {
        const id = data.id ?? generateId()
        const record = { ...data, id } as T
        set(`${collectionPrefix}${id}`, record)
        return record
      },

      get(id) {
        return get<T>(`${collectionPrefix}${id}`)
      },

      update(id, partial) {
        const existing = get<T>(`${collectionPrefix}${id}`)
        if (!existing) return null
        const updated = { ...existing, ...partial, id }
        set(`${collectionPrefix}${id}`, updated)
        return updated
      },

      delete(id) {
        return deleteEntry(`${collectionPrefix}${id}`)
      },

      list() {
        return keys(collectionPrefix).map((key) => get<T>(key) as T)
      },

      find(predicate) {
        return this.list().filter(predicate)
      },

      clear() {
        const ids = keys(collectionPrefix)
        for (const key of ids) {
          localStorage.removeItem(prefixedKey(key))
        }
      }
    }
  }

  return { get, set, delete: deleteEntry, keys, clear, collection }
}
