import type { LocationQuery, LocationQueryRaw } from 'vue-router'

const STORAGE_PREFIX = 'Comfy.PreservedQuery.'
const preservedQueries = new Map<string, Record<string, string>>()

function readQueryParam(value: unknown): string | undefined {
  return typeof value === 'string' ? value : undefined
}

function getStorageKey(namespace: string) {
  return `${STORAGE_PREFIX}${namespace}`
}

function isValidQueryRecord(value: unknown): value is Record<string, string> {
  if (typeof value !== 'object' || value === null || Array.isArray(value)) {
    return false
  }
  return Object.values(value).every((v) => typeof v === 'string')
}

function readFromStorage(namespace: string): Record<string, string> | null {
  try {
    const raw = sessionStorage.getItem(getStorageKey(namespace))
    if (!raw) return null

    const parsed = JSON.parse(raw)
    if (!isValidQueryRecord(parsed)) {
      console.warn('[preservedQuery] invalid storage format')
      sessionStorage.removeItem(getStorageKey(namespace))
      return null
    }
    return parsed
  } catch (error) {
    console.warn('[preservedQuery] storage operation failed')
    sessionStorage.removeItem(getStorageKey(namespace))
    return null
  }
}

function writeToStorage(
  namespace: string,
  payload: Record<string, string> | null
) {
  try {
    if (!payload || Object.keys(payload).length === 0) {
      sessionStorage.removeItem(getStorageKey(namespace))
      return
    }
    sessionStorage.setItem(getStorageKey(namespace), JSON.stringify(payload))
  } catch (error) {
    console.warn('[preservedQuery] failed to write storage', {
      namespace,
      error
    })
  }
}

export function hydratePreservedQuery(namespace: string) {
  if (preservedQueries.has(namespace)) {
    return
  }
  const payload = readFromStorage(namespace)
  if (payload) {
    preservedQueries.set(namespace, payload)
  }
}

export function capturePreservedQuery(
  namespace: string,
  query: LocationQuery,
  keys: string[]
) {
  const payload: Record<string, string> = {}

  keys.forEach((key) => {
    const value = readQueryParam(query[key])
    if (value) {
      payload[key] = value
    }
  })

  if (Object.keys(payload).length === 0) {
    return
  }

  preservedQueries.set(namespace, payload)
  writeToStorage(namespace, payload)
}

export function mergePreservedQueryIntoQuery(
  namespace: string,
  query?: LocationQueryRaw
): LocationQueryRaw | undefined {
  const payload = preservedQueries.get(namespace)
  if (!payload) return undefined

  const nextQuery: LocationQueryRaw = { ...(query || {}) }
  let changed = false

  for (const [key, value] of Object.entries(payload)) {
    if (typeof nextQuery[key] === 'string') continue
    nextQuery[key] = value
    changed = true
  }

  return changed ? nextQuery : undefined
}

export function clearPreservedQuery(namespace: string) {
  if (!preservedQueries.has(namespace)) return
  preservedQueries.delete(namespace)
  writeToStorage(namespace, null)
}
