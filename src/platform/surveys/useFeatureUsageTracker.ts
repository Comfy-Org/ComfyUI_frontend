import { useStorage } from '@vueuse/core'
import { computed, reactive, shallowRef } from 'vue'

import { reportError } from '@/platform/telemetry/reportError'

interface FeatureUsage {
  useCount: number
  firstUsed: number
  lastUsed: number
}

type FeatureUsageRecord = Partial<Record<string, FeatureUsage>>

interface PendingFeatureUsage {
  useCountDelta: number
  firstUsed: number
  lastUsed: number
}

type PendingFeatureUsageRecord = Partial<Record<string, PendingFeatureUsage>>

const STORAGE_KEY = 'Comfy.FeatureUsage'
const MAX_USAGE_COUNT = Number.MAX_SAFE_INTEGER - 1
const resetVersions = new Map<string, number>()
const pendingResets = reactive(new Set<string>())
const reportedErrorTypes = new Set<string>()
const pendingUsageData = shallowRef<PendingFeatureUsageRecord>({})

export function resetFeatureUsageTrackerStateForTest() {
  if (import.meta.env.MODE !== 'test') return
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

function normalizeTimestamp(value: unknown) {
  const timestamp = safeInteger(value)
  return timestamp !== undefined && timestamp > 0 ? timestamp : undefined
}

function normalizeUsageData(value: unknown): FeatureUsageRecord {
  if (!isRecord(value)) return {}

  return Object.fromEntries(
    Object.entries(value).flatMap(([featureId, usage]) => {
      if (!isRecord(usage)) return []

      const useCount = safeInteger(usage.useCount)
      const firstUsed = normalizeTimestamp(usage.firstUsed)
      const lastUsed = normalizeTimestamp(usage.lastUsed)
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

function reconcileExternalStorage(event: StorageEvent) {
  let storageArea: Storage
  try {
    storageArea = localStorage
  } catch {
    return
  }
  if (event.storageArea !== storageArea) return
  if (event.key === null) {
    pendingResets.clear()
    pendingUsageData.value = {}
    return
  }
  if (event.key !== STORAGE_KEY) return

  const storedUsageData = parseUsageData(event.newValue)
  for (const featureId of pendingResets) {
    if (usageFor(storedUsageData, featureId)) pendingResets.delete(featureId)
  }
}

if (typeof window !== 'undefined') {
  window.addEventListener('storage', reconcileExternalStorage)
}

function usageFor(
  usageData: FeatureUsageRecord,
  featureId: string
): FeatureUsage | undefined {
  return Object.hasOwn(usageData, featureId) ? usageData[featureId] : undefined
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

function withoutFeature<T>(
  usageData: Partial<Record<string, T>>,
  featureId: string
): Partial<Record<string, T>> {
  return Object.fromEntries(
    Object.entries(usageData).filter(([id]) => id !== featureId)
  )
}

function applyPendingUsage(usageData: FeatureUsageRecord): FeatureUsageRecord {
  return Object.entries(pendingUsageData.value).reduce(
    (mergedUsageData, [featureId, pendingUsage]) => {
      if (!pendingUsage) return mergedUsageData
      const storedUsage = usageFor(mergedUsageData, featureId)
      return {
        ...mergedUsageData,
        [featureId]: {
          useCount: Math.min(
            (storedUsage?.useCount ?? 0) + pendingUsage.useCountDelta,
            MAX_USAGE_COUNT
          ),
          firstUsed: Math.min(
            storedUsage?.firstUsed ?? pendingUsage.firstUsed,
            pendingUsage.firstUsed
          ),
          lastUsed: Math.max(
            storedUsage?.lastUsed ?? pendingUsage.lastUsed,
            pendingUsage.lastUsed
          )
        }
      }
    },
    usageData
  )
}

function recordPendingUsage(
  featureId: string,
  usage: FeatureUsage,
  now: number
) {
  const pendingUsage = pendingUsageData.value[featureId]
  pendingUsageData.value = {
    ...pendingUsageData.value,
    [featureId]: {
      useCountDelta: Math.min(
        (pendingUsage?.useCountDelta ?? 0) + 1,
        MAX_USAGE_COUNT
      ),
      firstUsed: pendingUsage?.firstUsed ?? usage.firstUsed,
      lastUsed: now
    }
  }
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
  const fallbackUsageData = applyPendingUsage(
    applyPendingResets(currentUsageData)
  )
  let usageData = {
    ...fallbackUsageData,
    [featureId]: incrementUsage(usageFor(fallbackUsageData, featureId), now)
  }
  let newValue: string | undefined
  let storageWritten = false

  try {
    oldValue = localStorage.getItem(STORAGE_KEY)
    const storedUsageData = parseUsageData(oldValue)
    const mergedUsageData = applyPendingUsage(
      applyPendingResets(storedUsageData)
    )
    usageData = {
      ...mergedUsageData,
      [featureId]: incrementUsage(usageFor(mergedUsageData, featureId), now)
    }
    newValue = JSON.stringify(usageData)

    localStorage.setItem(STORAGE_KEY, newValue)
    storageWritten = true
    pendingResets.clear()
    pendingUsageData.value = {}
  } catch (error) {
    reportStorageError(error, 'error_persisting_feature_usage')
    const failedUsage = usageFor(usageData, featureId)
    if (failedUsage) recordPendingUsage(featureId, failedUsage, now)
  }

  if (storageWritten) {
    dispatchStorageUpdate(oldValue, newValue ?? JSON.stringify(usageData))
  }
  return { storageWritten, usageData }
}

function resetUsageData(currentUsageData: FeatureUsageRecord) {
  let oldValue: string | null = null
  let usageData = applyPendingUsage(applyPendingResets(currentUsageData))
  let newValue: string | undefined
  let storageWritten = false

  try {
    oldValue = localStorage.getItem(STORAGE_KEY)
    usageData = applyPendingUsage(applyPendingResets(parseUsageData(oldValue)))
    newValue = JSON.stringify(usageData)
    localStorage.setItem(STORAGE_KEY, newValue)
    storageWritten = true
    pendingResets.clear()
    pendingUsageData.value = {}
  } catch (error) {
    reportStorageError(error, 'error_resetting_feature_usage')
  }

  if (storageWritten) {
    dispatchStorageUpdate(oldValue, newValue ?? JSON.stringify(usageData))
  }
  return { storageWritten, usageData }
}

/**
 * Tracks feature usage for survey eligibility.
 * Persists to localStorage.
 */
export function useFeatureUsageTracker(featureId: string) {
  const usageData = useStorage<FeatureUsageRecord>(STORAGE_KEY, {})
  let observedResetVersions = new Map(resetVersions)

  const usage = computed(() =>
    usageFor(
      applyPendingUsage(
        applyPendingResets(normalizeUsageData(usageData.value))
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

    const persisted = persistUsageData(featureId, now, currentUsageData)
    if (persisted.storageWritten) usageData.value = persisted.usageData
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
    const persisted = resetUsageData(currentUsageData)
    if (persisted.storageWritten) usageData.value = persisted.usageData
  }

  return {
    usage,
    useCount,
    trackUsage,
    reset
  }
}
