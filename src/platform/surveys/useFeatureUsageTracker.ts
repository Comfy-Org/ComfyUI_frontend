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

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}

function finiteNumber(value: unknown): number | undefined {
  if (typeof value !== 'number' && typeof value !== 'string') return
  if (typeof value === 'string' && value.trim() === '') return

  const number = Number(value)
  return Number.isFinite(number) ? number : undefined
}

function normalizeUsageData(value: unknown): FeatureUsageRecord {
  if (!isRecord(value)) return {}

  return Object.fromEntries(
    Object.entries(value).flatMap(([featureId, usage]) => {
      if (!isRecord(usage)) return []

      const useCount = finiteNumber(usage.useCount)
      const firstUsed = finiteNumber(usage.firstUsed)
      const lastUsed = finiteNumber(usage.lastUsed)
      return useCount !== undefined &&
        Number.isInteger(useCount) &&
        useCount >= 0 &&
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

function mergeUsageData(...records: FeatureUsageRecord[]): FeatureUsageRecord {
  const featureIds = new Set(records.flatMap(Object.keys))
  return Object.fromEntries(
    [...featureIds].flatMap((featureId) => {
      const usage = records.reduce<FeatureUsage | undefined>(
        (latest, record) => latestUsage(latest, record[featureId]),
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
  window.dispatchEvent(
    new StorageEvent('storage', {
      key: STORAGE_KEY,
      oldValue,
      newValue: JSON.stringify(usageData),
      storageArea: localStorage
    })
  )
}

function withoutFeature(
  usageData: FeatureUsageRecord,
  featureId: string
): FeatureUsageRecord {
  return Object.fromEntries(
    Object.entries(usageData).filter(([id]) => id !== featureId)
  )
}

function persistUsageData(
  featureId: string,
  currentUsageData: FeatureUsageRecord,
  now: number
) {
  let oldValue: string | null = null
  let usageData: FeatureUsageRecord | undefined

  try {
    oldValue = localStorage.getItem(STORAGE_KEY)
    const storedUsageData = parseUsageData(oldValue)
    const mergedUsageData = mergeUsageData(storedUsageData, currentUsageData)
    usageData = {
      ...mergedUsageData,
      [featureId]: incrementUsage(mergedUsageData[featureId], now)
    }
    const newValue = JSON.stringify(usageData)

    localStorage.setItem(STORAGE_KEY, newValue)
  } catch (error) {
    reportError(error, {
      errorType: 'error_persisting_feature_usage',
      surface: 'platform'
    })
    if (!usageData) return
  }

  dispatchStorageUpdate(oldValue, usageData)
  return usageData
}

function resetUsageData(
  featureId: string,
  currentUsageData: FeatureUsageRecord
) {
  let oldValue: string | null = null
  let usageData: FeatureUsageRecord

  try {
    oldValue = localStorage.getItem(STORAGE_KEY)
    usageData = withoutFeature(
      mergeUsageData(parseUsageData(oldValue), currentUsageData),
      featureId
    )
    localStorage.setItem(STORAGE_KEY, JSON.stringify(usageData))
  } catch (error) {
    reportError(error, {
      errorType: 'error_resetting_feature_usage',
      surface: 'platform'
    })
    usageData = withoutFeature(currentUsageData, featureId)
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
  let observedResetVersion = resetVersions.get(featureId) ?? 0

  const usage = computed(() => usageData.value[featureId])
  const useCount = computed(() => usage.value?.useCount ?? 0)

  function trackUsage() {
    const now = Date.now()
    const resetVersion = resetVersions.get(featureId) ?? 0
    const normalizedUsageData = normalizeUsageData(usageData.value)
    const currentUsageData =
      resetVersion === observedResetVersion
        ? normalizedUsageData
        : withoutFeature(normalizedUsageData, featureId)
    const existing = currentUsageData[featureId]
    observedResetVersion = resetVersion

    usageData.value = persistUsageData(featureId, currentUsageData, now) ?? {
      ...currentUsageData,
      [featureId]: incrementUsage(existing, now)
    }
  }

  function reset() {
    observedResetVersion = (resetVersions.get(featureId) ?? 0) + 1
    resetVersions.set(featureId, observedResetVersion)
    usageData.value = resetUsageData(
      featureId,
      normalizeUsageData(usageData.value)
    )
  }

  return {
    usage,
    useCount,
    trackUsage,
    reset
  }
}
