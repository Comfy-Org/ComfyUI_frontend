import type { ShallowRef } from 'vue'

import { shallowRef } from 'vue'

export interface SessionTabMap {
  readonly map: ShallowRef<Map<string, string>>
  set(key: string, value: string): void
}

export function createSessionTabMap(
  prefix: string,
  maxEntries: number = 200
): SessionTabMap {
  const capacity = Math.max(0, Math.floor(maxEntries))
  const map = shallowRef<Map<string, string>>(restore(prefix))

  function set(key: string, value: string): void {
    if (map.value.get(key) === value) return
    const next = new Map(map.value)
    next.delete(key)
    next.set(key, value)

    while (next.size > capacity) {
      const oldest = next.keys().next().value
      if (oldest === undefined) break
      next.delete(oldest)
    }

    map.value = next
    persist(prefix, next)
  }

  return { map, set }
}

function storageKey(prefix: string): string | null {
  const clientId = window.name
  return clientId ? `${prefix}:${clientId}` : null
}

function persist(prefix: string, data: Map<string, string>): void {
  const key = storageKey(prefix)
  if (!key) return
  try {
    sessionStorage.setItem(key, JSON.stringify(Array.from(data.entries())))
  } catch {
    // Graceful degradation
  }
}

function restore(prefix: string): Map<string, string> {
  const key = storageKey(prefix)
  if (!key) return new Map()
  try {
    const raw = sessionStorage.getItem(key)
    if (raw) return new Map(JSON.parse(raw) as [string, string][])
    return migrate(prefix, key)
  } catch {
    return new Map()
  }
}

function migrate(prefix: string, newKey: string): Map<string, string> {
  const searchPrefix = `${prefix}:`
  for (let i = 0; i < sessionStorage.length; i++) {
    const existingKey = sessionStorage.key(i)
    if (!existingKey?.startsWith(searchPrefix) || existingKey === newKey)
      continue
    const raw = sessionStorage.getItem(existingKey)
    if (!raw) continue
    sessionStorage.removeItem(existingKey)
    const migrated = new Map(JSON.parse(raw) as [string, string][])
    persist(prefix, migrated)
    return migrated
  }
  return new Map()
}
