import { useEventListener, useStorage } from '@vueuse/core'
import { computed, reactive, shallowRef } from 'vue'

import { reportError } from '@/platform/telemetry/reportError'

interface FeatureUsage {
  useCount: number
  firstUsed: number
  lastUsed: number
}

type FeatureUsageRecord = Partial<Record<string, FeatureUsage>>

const STORAGE_KEY = 'Comfy.FeatureUsage'
const MAX_USAGE_COUNT = Number.MAX_SAFE_INTEGER - 1
const resetVersions = new Map<string, number>()
const pendingResets = reactive(new Set<string>())
const reportedErrorTypes = new Set<string>()
const pendingUsageData = shallowRef<FeatureUsageRecord>({})

export function resetFeatureUsageTrackerStateForTest() {
  resetVersions.clear()
  pendingResets.clear()
  reportedErrorTypes.clear()
  pendingUsageData.value = {}
}

function reportStorageError(error: unknown, errorType: string) {
  if (reportedErrorTypes.has(errorType)) return
  reportedErrorTypes.add(errorType)
  reportError(error, { errorType, surface: 'platform' })
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}

function safeInteger(value: unknown): number | undefined {
  if (typeof value !== 'number' && typeof value !== 'string') return
  if (typeof value === 'string' && value.trim() === '') return

  const number = Number(value)
  return Number.isSafeInteger(number) ? number : undefined
}

function isValidUseCount(value: number | undefined): value is number {
  return value !== undefined && value >= 0 && value <= MAX_USAGE_COUNT
}

function normalizeTimestamp(value: unknown, now: number) {
  const timestamp = safeInteger(value)
  return timestamp !== undefined && timestamp > 0
    ? Math.min(timestamp, now)
    : undefined
}

function normalizeUsageData(value: unknown): FeatureUsageRecord {
  if (!isRecord(value)) return {}

  return Object.fromEntries(
    Object.entries(value).flatMap(([featureId, usage]) => {
      if (!isRecord(usage)) return []

      const useCount = safeInteger(usage.useCount)
      const now = Date.now()
      const firstUsed = normalizeTimestamp(usage.firstUsed, now)
      const lastUsed = normalizeTimestamp(usage.lastUsed, now)
      return isValidUseCount(useCount) &&
        firstUsed !== undefined &&
        lastUsed !== undefined
        ? [[featureId, { useCount, firstUsed, lastUsed }]]
        : []
    })
  )
}

function parseUsageData(value: string | null): FeatureUsageRecord {
  if (!value) return {}

  try {
    return normalizeUsageData(JSON.parse(value))
  } catch (error) {
    reportStorageError(error, 'error_parsing_feature_usage')
    return {}
  }
}

function latestUsage(
  storedUsage: FeatureUsage | undefined,
  currentUsage: FeatureUsage | undefined
) {
  if (!storedUsage) return currentUsage
  if (!currentUsage) return storedUsage
  return {
    useCount: Math.max(storedUsage.useCount, currentUsage.useCount),
    firstUsed: Math.min(storedUsage.firstUsed, currentUsage.firstUsed),
    lastUsed: Math.max(storedUsage.lastUsed, currentUsage.lastUsed)
  }
}

function usageFor(
  usageData: FeatureUsageRecord,
  featureId: string
): FeatureUsage | undefined {
  return Object.hasOwn(usageData, featureId) ? usageData[featureId] : undefined
}

function mergeUsageData(...records: FeatureUsageRecord[]): FeatureUsageRecord {
  const featureIds = new Set(records.flatMap(Object.keys))
  return Object.fromEntries(
    [...featureIds].flatMap((featureId) => {
      const usage = records.reduce<FeatureUsage | undefined>(
        (latest, record) => latestUsage(latest, usageFor(record, featureId)),
        undefined
      )
      return usage ? [[featureId, usage]] : []
    })
  )
}

function incrementUsage(
  usage: FeatureUsage | undefined,
  now: number
): FeatureUsage {
  return {
    useCount: Math.min((usage?.useCount ?? 0) + 1, MAX_USAGE_COUNT),
    firstUsed: usage?.firstUsed ?? now,
    lastUsed: now
  }
}

function dispatchStorageUpdate(oldValue: string | null, newValue: string) {
  try {
    const storageArea = localStorage
    window.dispatchEvent(
      new StorageEvent('storage', {
        key: STORAGE_KEY,
        oldValue,
        newValue,
        storageArea
      })
    )
  } catch (error) {
    reportStorageError(error, 'error_dispatching_feature_usage')
  }
}

function withoutFeature(
  usageData: FeatureUsageRecord,
  featureId: string
): FeatureUsageRecord {
  return Object.fromEntries(
    Object.entries(usageData).filter(([id]) => id !== featureId)
  )
}

function applyPendingResets(usageData: FeatureUsageRecord): FeatureUsageRecord {
  return [...pendingResets].reduce(withoutFeature, usageData)
}

function withoutNewlyResetFeatures(
  usageData: FeatureUsageRecord,
  observedResetVersions: ReadonlyMap<string, number>
): FeatureUsageRecord {
  return Object.fromEntries(
    Object.entries(usageData).filter(
      ([featureId]) =>
        (resetVersions.get(featureId) ?? 0) <=
        (observedResetVersions.get(featureId) ?? 0)
    )
  )
}

function persistUsageData(
  featureId: string,
  now: number,
  currentUsageData: FeatureUsageRecord
) {
  let oldValue: string | null = null
  const fallbackUsageData = mergeUsageData(
    applyPendingResets(currentUsageData),
    pendingUsageData.value
  )
  let usageData = {
    ...fallbackUsageData,
    [featureId]: incrementUsage(usageFor(fallbackUsageData, featureId), now)
  }
  let newValue: string | undefined
  let storageRead = false

  try {
    oldValue = localStorage.getItem(STORAGE_KEY)
    storageRead = true
    const storedUsageData = parseUsageData(oldValue)
    const mergedUsageData = mergeUsageData(
      applyPendingResets(storedUsageData),
      pendingUsageData.value
    )
    usageData = {
      ...mergedUsageData,
      [featureId]: incrementUsage(usageFor(mergedUsageData, featureId), now)
    }
    newValue = JSON.stringify(usageData)

    localStorage.setItem(STORAGE_KEY, newValue)
    pendingResets.clear()
    pendingUsageData.value = {}
  } catch (error) {
    reportStorageError(error, 'error_persisting_feature_usage')
    pendingUsageData.value = mergeUsageData(pendingUsageData.value, {
      [featureId]: usageFor(usageData, featureId)
    })
  }

  if (storageRead) {
    dispatchStorageUpdate(oldValue, newValue ?? JSON.stringify(usageData))
  }
  return usageData
}

function resetUsageData(currentUsageData: FeatureUsageRecord) {
  let oldValue: string | null = null
  let usageData = applyPendingResets(currentUsageData)
  let newValue: string | undefined

  try {
    oldValue = localStorage.getItem(STORAGE_KEY)
    usageData = mergeUsageData(
      applyPendingResets(parseUsageData(oldValue)),
      pendingUsageData.value
    )
    newValue = JSON.stringify(usageData)
    localStorage.setItem(STORAGE_KEY, newValue)
    pendingResets.clear()
    pendingUsageData.value = {}
  } catch (error) {
    reportStorageError(error, 'error_resetting_feature_usage')
  }

  dispatchStorageUpdate(oldValue, newValue ?? JSON.stringify(usageData))
  return usageData
}

/**
 * Tracks feature usage for survey eligibility.
 * Persists to localStorage.
 */
export function useFeatureUsageTracker(featureId: string) {
  const usageData = useStorage<FeatureUsageRecord>(STORAGE_KEY, {})
  let observedResetVersions = new Map(resetVersions)

  useEventListener(window, 'storage', (event) => {
    if (event.key !== STORAGE_KEY) return
    const storedUsageData = parseUsageData(event.newValue)
    pendingUsageData.value = Object.fromEntries(
      Object.entries(pendingUsageData.value).filter(([pendingFeatureId]) =>
        usageFor(storedUsageData, pendingFeatureId)
      )
    )
  })

  const usage = computed(() =>
    usageFor(
      mergeUsageData(
        applyPendingResets(normalizeUsageData(usageData.value)),
        pendingUsageData.value
      ),
      featureId
    )
  )
  const useCount = computed(() => usage.value?.useCount ?? 0)

  function trackUsage() {
    const now = Date.now()
    const normalizedUsageData = normalizeUsageData(usageData.value)
    const currentUsageData = withoutNewlyResetFeatures(
      normalizedUsageData,
      observedResetVersions
    )
    observedResetVersions = new Map(resetVersions)

    usageData.value = persistUsageData(featureId, now, currentUsageData)
  }

  function reset() {
    const currentUsageData = withoutNewlyResetFeatures(
      normalizeUsageData(usageData.value),
      observedResetVersions
    )
    const resetVersion = (resetVersions.get(featureId) ?? 0) + 1
    resetVersions.set(featureId, resetVersion)
    observedResetVersions.set(featureId, resetVersion)
    pendingResets.add(featureId)
    pendingUsageData.value = withoutFeature(pendingUsageData.value, featureId)
    usageData.value = resetUsageData(currentUsageData)
  }

  return {
    usage,
    useCount,
    trackUsage,
    reset
  }
}
