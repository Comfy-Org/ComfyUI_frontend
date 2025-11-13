import { defineStore } from 'pinia'
import { ref } from 'vue'
import type { LocationQuery, LocationQueryRaw } from 'vue-router'

type PreservedQueryPayload = Record<string, string>

const STORAGE_PREFIX = 'Comfy.PreservedQuery.'

const readQueryParam = (value: unknown): string | undefined => {
  return typeof value === 'string' ? value : undefined
}

const getStorageKey = (namespace: string) => `${STORAGE_PREFIX}${namespace}`

const readPayloadFromStorage = (
  namespace: string
): PreservedQueryPayload | null => {
  try {
    const raw = sessionStorage.getItem(getStorageKey(namespace))
    return raw ? (JSON.parse(raw) as PreservedQueryPayload) : null
  } catch (error) {
    console.warn(
      '[preservedQueryStore] failed to read payload',
      namespace,
      error
    )
    sessionStorage.removeItem(getStorageKey(namespace))
    return null
  }
}

const writePayloadToStorage = (
  namespace: string,
  payload: PreservedQueryPayload | null
) => {
  try {
    if (!payload || Object.keys(payload).length === 0) {
      sessionStorage.removeItem(getStorageKey(namespace))
      return
    }
    sessionStorage.setItem(getStorageKey(namespace), JSON.stringify(payload))
  } catch (error) {
    console.warn(
      '[preservedQueryStore] failed to write payload',
      namespace,
      error
    )
  }
}

export const usePreservedQueryStore = defineStore('preservedQuery', () => {
  const payloads = ref<Record<string, PreservedQueryPayload>>({})

  const setPayload = (namespace: string, payload: PreservedQueryPayload) => {
    payloads.value = { ...payloads.value, [namespace]: payload }
    writePayloadToStorage(namespace, payload)
  }

  const getPayload = (namespace: string) => payloads.value[namespace] || null

  const hydrate = (namespace: string) => {
    if (payloads.value[namespace]) return
    const payload = readPayloadFromStorage(namespace)
    if (payload) {
      payloads.value = { ...payloads.value, [namespace]: payload }
    }
  }

  const capture = (namespace: string, query: LocationQuery, keys: string[]) => {
    const payload: PreservedQueryPayload = {}
    keys.forEach((key) => {
      const value = readQueryParam(query[key])
      if (value) {
        payload[key] = value
      }
    })

    if (Object.keys(payload).length === 0) return

    setPayload(namespace, payload)
  }

  const mergeIntoQuery = (
    namespace: string,
    query?: LocationQueryRaw
  ): LocationQueryRaw | null => {
    const payload = getPayload(namespace)
    if (!payload) return null

    const nextQuery: LocationQueryRaw = { ...(query || {}) }
    let mutated = false

    for (const [key, value] of Object.entries(payload)) {
      if (typeof nextQuery[key] !== 'string') {
        nextQuery[key] = value
        mutated = true
      }
    }

    return mutated ? nextQuery : null
  }

  const clear = (namespace: string) => {
    if (!payloads.value[namespace]) return
    const { [namespace]: _, ...rest } = payloads.value
    payloads.value = rest
    writePayloadToStorage(namespace, null)
  }

  return {
    capture,
    clear,
    getPayload,
    hydrate,
    mergeIntoQuery
  }
})
