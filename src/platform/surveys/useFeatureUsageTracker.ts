import { useStorage } from '@vueuse/core'
import { computed } from 'vue'

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
    const oldValue = localStorage.getItem(STORAGE_KEY)
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

    localStorage.setItem(STORAGE_KEY, newValue)
    pendingUsage.clear()
    window.dispatchEvent(
      new StorageEvent('storage', {
        key: STORAGE_KEY,
        oldValue,
        newValue,
        storageArea: localStorage
      })
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
  const usageData = useStorage<FeatureUsageRecord>(STORAGE_KEY, {})

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
