import { computed, ref, watch } from 'vue'
import type { Ref } from 'vue'

import { remoteConfigState } from '@/platform/remoteConfig/remoteConfig'
import { api } from '@/scripts/api'
import { useTelemetry } from '@/platform/telemetry'
import { getDevOverride } from '@/utils/devFeatureFlagOverride'

type FeatureGateState = 'unloaded' | 'loading' | 'resolved' | 'error'

const FEATURE_GATE_TIMEOUT_MS = 5_000

interface FeatureGateEntry {
  state: Ref<FeatureGateState>
  value: Ref<boolean>
}

const entries = new Map<string, FeatureGateEntry>()
const fallbackRecordedExposures = new Set<string>()
let generation = 0
let pendingRefresh: { generation: number; promise: Promise<void> } | null = null
let refreshAgain = false

function failClosed(state: FeatureGateState): void {
  for (const entry of entries.values()) {
    entry.value.value = false
    entry.state.value = state
  }
}

function getFeatureGateEntry(key: string): FeatureGateEntry {
  const existingEntry = entries.get(key)
  if (existingEntry) return existingEntry

  const entry: FeatureGateEntry = {
    state: ref('unloaded'),
    value: ref(false)
  }
  entries.set(key, entry)
  return entry
}

watch(
  remoteConfigState,
  (state) => {
    generation++
    pendingRefresh = null
    refreshAgain = false
    if (state === 'authenticated') {
      void refreshFeatureGates()
      return
    }
    failClosed(state === 'error' ? 'error' : 'unloaded')
  },
  { flush: 'sync' }
)

export function refreshFeatureGates(): Promise<void> {
  if (remoteConfigState.value !== 'authenticated' || entries.size === 0) {
    return Promise.resolve()
  }

  if (pendingRefresh?.generation === generation) {
    refreshAgain = true
    return pendingRefresh.promise
  }

  const requestGeneration = generation
  const keys = [...entries.keys()]
  for (const key of keys) {
    const entry = entries.get(key)
    if (entry) entry.state.value = 'loading'
  }

  const promise = api
    .fetchApi('/feature-flags/evaluate', {
      body: JSON.stringify({ keys }),
      headers: { 'Content-Type': 'application/json' },
      method: 'POST',
      signal: AbortSignal.timeout(FEATURE_GATE_TIMEOUT_MS)
    })
    .then(async (response) => {
      if (!response.ok) throw new Error(`HTTP ${response.status}`)
      const payload = (await response.json()) as {
        flags?: Record<string, unknown>
      }
      if (
        generation !== requestGeneration ||
        remoteConfigState.value !== 'authenticated'
      ) {
        return
      }

      for (const key of keys) {
        const entry = entries.get(key)
        if (!entry) continue
        entry.value.value =
          typeof payload.flags?.[key] === 'boolean' ? payload.flags[key] : false
        entry.state.value = 'resolved'
      }
    })
    .catch(() => {
      if (
        generation !== requestGeneration ||
        remoteConfigState.value !== 'authenticated'
      ) {
        return
      }
      for (const key of keys) {
        const entry = entries.get(key)
        if (!entry) continue
        entry.value.value = false
        entry.state.value = 'error'
      }
    })
    .finally(() => {
      if (pendingRefresh?.promise === promise) pendingRefresh = null
      if (refreshAgain && generation === requestGeneration) {
        refreshAgain = false
        void refreshFeatureGates()
      }
    })

  pendingRefresh = { generation: requestGeneration, promise }
  return promise
}

function hasRecordedExposure(key: string): boolean {
  try {
    return (
      sessionStorage.getItem(key) !== null || fallbackRecordedExposures.has(key)
    )
  } catch {
    return fallbackRecordedExposures.has(key)
  }
}

function markExposureRecorded(key: string): void {
  fallbackRecordedExposures.add(key)

  try {
    sessionStorage.setItem(key, '1')
  } catch {
    return
  }
}

export function useFeatureGate(key: string) {
  const override = getDevOverride<boolean>(key)
  const entry = getFeatureGateEntry(key)
  if (
    typeof override !== 'boolean' &&
    remoteConfigState.value === 'authenticated'
  ) {
    void refreshFeatureGates()
  }

  const state = computed<FeatureGateState>(() => {
    if (typeof override === 'boolean') return 'resolved'
    if (remoteConfigState.value === 'error') return 'error'
    if (remoteConfigState.value !== 'authenticated') return 'unloaded'
    return entry.state.value
  })
  const value = computed(() => {
    if (typeof override === 'boolean') return override
    if (state.value !== 'resolved') return false
    return entry.value.value
  })

  function recordExposure(): void {
    if (state.value !== 'resolved' && state.value !== 'error') return

    const exposureKey = `feature-flag-exposure:${key}:${value.value}`
    if (hasRecordedExposure(exposureKey)) return

    const telemetry = useTelemetry()
    if (!telemetry) return

    telemetry.trackFeatureFlagExposure(key, value.value)
    markExposureRecorded(exposureKey)
  }

  return {
    state,
    value,
    recordExposure
  }
}
