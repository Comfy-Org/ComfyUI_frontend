import { computed } from 'vue'
import { customStorageEventName } from '@vueuse/core'

import { safeLocalStorage } from '@/base/storage/safeStorage'
import { useSafeLocalStorage } from '@/platform/storage/useSafeStorage'

interface FeatureUsage {
  useCount: number
  firstUsed: number
  lastUsed: number
}

type FeatureUsageRecord = Partial<Record<string, FeatureUsage>>

const STORAGE_KEY = 'Comfy.FeatureUsage'
const pendingUsage = new Map<string, FeatureUsage>()

function latestUsage(
  storedUsage: FeatureUsage | undefined,
  currentUsage: FeatureUsage | undefined
) {
  if (!storedUsage) return currentUsage
  if (!currentUsage) return storedUsage
  return storedUsage.useCount >= currentUsage.useCount
    ? storedUsage
    : currentUsage
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

function applyPendingUsage(usageData: FeatureUsageRecord) {
  return {
    ...usageData,
    ...Object.fromEntries(
      [...pendingUsage].map(([featureId, usage]) => [
        featureId,
        latestUsage(usageData[featureId], usage)
      ])
    )
  }
}

function persistUsageData(
  featureId: string,
  currentUsageData: FeatureUsageRecord,
  now: number
) {
  try {
    const oldValue = safeLocalStorage.getItem(STORAGE_KEY)
    const storedUsageData = oldValue
      ? (JSON.parse(oldValue) as FeatureUsageRecord)
      : {}
    const mergedUsageData = applyPendingUsage(storedUsageData)
    const usageData = {
      ...mergedUsageData,
      [featureId]: incrementUsage(
        latestUsage(mergedUsageData[featureId], currentUsageData[featureId]),
        now
      )
    }
    const newValue = JSON.stringify(usageData)

    if (safeLocalStorage.setItem(STORAGE_KEY, newValue) !== 'ok') return
    pendingUsage.clear()
    const storageArea = safeLocalStorage.asStorage()
    const change = { key: STORAGE_KEY, oldValue, newValue, storageArea }
    window.dispatchEvent(
      storageArea instanceof Storage
        ? new StorageEvent('storage', change)
        : new CustomEvent(customStorageEventName, { detail: change })
    )
    return usageData
  } catch {
    return
  }
}

/**
 * Tracks feature usage for survey eligibility.
 * Persists to localStorage.
 */
export function useFeatureUsageTracker(featureId: string) {
  const usageData = useSafeLocalStorage<FeatureUsageRecord>(STORAGE_KEY, {})

  const usage = computed(() => usageData.value[featureId])
  const useCount = computed(() => usage.value?.useCount ?? 0)

  function trackUsage() {
    const now = Date.now()
    const currentUsageData = usageData.value
    const existing = currentUsageData[featureId]

    const persistedUsageData = persistUsageData(
      featureId,
      currentUsageData,
      now
    )
    const nextUsageData = persistedUsageData ?? {
      ...currentUsageData,
      [featureId]: incrementUsage(
        latestUsage(pendingUsage.get(featureId), existing),
        now
      )
    }
    if (!persistedUsageData) {
      const nextUsage = nextUsageData[featureId]
      if (nextUsage) pendingUsage.set(featureId, nextUsage)
    }
    usageData.value = nextUsageData
  }

  function reset() {
    delete usageData.value[featureId]
    pendingUsage.delete(featureId)
  }

  return {
    usage,
    useCount,
    trackUsage,
    reset
  }
}
