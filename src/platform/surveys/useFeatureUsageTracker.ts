import { useStorage } from '@vueuse/core'
import { computed } from 'vue'

import { reportError } from '@/platform/telemetry/reportError'

interface FeatureUsage {
  useCount: number
  firstUsed: number
  lastUsed: number
}

type FeatureUsageRecord = Partial<Record<string, FeatureUsage>>

const STORAGE_KEY = 'Comfy.FeatureUsage'
const resetVersions = new Map<string, number>()
const pendingResets = new Set<string>()
let pendingUsageData: FeatureUsageRecord = {}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}

function nonNegativeSafeInteger(value: unknown): number | undefined {
  if (typeof value !== 'number' && typeof value !== 'string') return
  if (typeof value === 'string' && value.trim() === '') return

  const number = Number(value)
  return Number.isSafeInteger(number) && number >= 0 ? number : undefined
}

function normalizeUsageData(value: unknown): FeatureUsageRecord {
  if (!isRecord(value)) return {}

  return Object.fromEntries(
    Object.entries(value).flatMap(([featureId, usage]) => {
      if (!isRecord(usage)) return []

      const useCount = nonNegativeSafeInteger(usage.useCount)
      const firstUsed = nonNegativeSafeInteger(usage.firstUsed)
      const lastUsed = nonNegativeSafeInteger(usage.lastUsed)
      return useCount !== undefined &&
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
    reportError(error, {
      errorType: 'error_parsing_feature_usage',
      surface: 'platform'
    })
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
    useCount: (usage?.useCount ?? 0) + 1,
    firstUsed: usage?.firstUsed ?? now,
    lastUsed: now
  }
}

function dispatchStorageUpdate(
  oldValue: string | null,
  usageData: FeatureUsageRecord
) {
  try {
    const storageArea = localStorage
    window.dispatchEvent(
      new StorageEvent('storage', {
        key: STORAGE_KEY,
        oldValue,
        newValue: JSON.stringify(usageData),
        storageArea
      })
    )
  } catch (error) {
    reportError(error, {
      errorType: 'error_dispatching_feature_usage',
      surface: 'platform'
    })
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

function persistUsageData(featureId: string, now: number) {
  let oldValue: string | null = null
  let usageData: FeatureUsageRecord | undefined

  try {
    oldValue = localStorage.getItem(STORAGE_KEY)
    const storedUsageData = parseUsageData(oldValue)
    const mergedUsageData = mergeUsageData(
      applyPendingResets(storedUsageData),
      pendingUsageData
    )
    usageData = {
      ...mergedUsageData,
      [featureId]: incrementUsage(usageFor(mergedUsageData, featureId), now)
    }
    const newValue = JSON.stringify(usageData)

    localStorage.setItem(STORAGE_KEY, newValue)
    pendingResets.clear()
    pendingUsageData = {}
  } catch (error) {
    reportError(error, {
      errorType: 'error_persisting_feature_usage',
      surface: 'platform'
    })
    if (!usageData) return
    pendingUsageData = mergeUsageData(pendingUsageData, usageData)
  }

  dispatchStorageUpdate(oldValue, usageData)
  return usageData
}

function resetUsageData(currentUsageData: FeatureUsageRecord) {
  let oldValue: string | null = null
  let usageData: FeatureUsageRecord | undefined

  try {
    oldValue = localStorage.getItem(STORAGE_KEY)
    usageData = mergeUsageData(
      applyPendingResets(parseUsageData(oldValue)),
      pendingUsageData
    )
    localStorage.setItem(STORAGE_KEY, JSON.stringify(usageData))
    pendingResets.clear()
    pendingUsageData = {}
  } catch (error) {
    reportError(error, {
      errorType: 'error_resetting_feature_usage',
      surface: 'platform'
    })
    usageData ??= applyPendingResets(currentUsageData)
  }

  dispatchStorageUpdate(oldValue, usageData)
  return usageData
}

/**
 * Tracks feature usage for survey eligibility.
 * Persists to localStorage.
 */
export function useFeatureUsageTracker(featureId: string) {
  const usageData = useStorage<FeatureUsageRecord>(STORAGE_KEY, {})
  let observedResetVersions = new Map(resetVersions)

  const usage = computed(() =>
    usageFor(normalizeUsageData(usageData.value), featureId)
  )
  const useCount = computed(() => usage.value?.useCount ?? 0)

  function trackUsage() {
    const now = Date.now()
    const normalizedUsageData = normalizeUsageData(usageData.value)
    const currentUsageData = withoutNewlyResetFeatures(
      normalizedUsageData,
      observedResetVersions
    )
    const existing = usageFor(currentUsageData, featureId)
    observedResetVersions = new Map(resetVersions)

    usageData.value = persistUsageData(featureId, now) ?? {
      ...currentUsageData,
      [featureId]: incrementUsage(existing, now)
    }
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
    pendingUsageData = withoutFeature(pendingUsageData, featureId)
    usageData.value = resetUsageData(currentUsageData)
  }

  return {
    usage,
    useCount,
    trackUsage,
    reset
  }
}
