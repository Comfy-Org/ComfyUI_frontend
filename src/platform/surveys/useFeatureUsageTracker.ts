import { useStorage } from '@vueuse/core'
import { computed } from 'vue'

interface FeatureUsage {
  useCount: number
  firstUsed: number
  lastUsed: number
}

type FeatureUsageRecord = Partial<Record<string, FeatureUsage>>

const STORAGE_KEY = 'Comfy.FeatureUsage'

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

function persistUsageData(
  featureId: string,
  currentUsage: FeatureUsage | undefined,
  now: number
) {
  try {
    const oldValue = localStorage.getItem(STORAGE_KEY)
    const storedUsageData = oldValue
      ? (JSON.parse(oldValue) as FeatureUsageRecord)
      : {}
    const usageData = {
      ...storedUsageData,
      [featureId]: incrementUsage(
        latestUsage(storedUsageData[featureId], currentUsage),
        now
      )
    }
    const newValue = JSON.stringify(usageData)

    localStorage.setItem(STORAGE_KEY, newValue)
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
    const existing = usageData.value[featureId]

    usageData.value = persistUsageData(featureId, existing, now) ?? {
      ...usageData.value,
      [featureId]: incrementUsage(existing, now)
    }
  }

  function reset() {
    delete usageData.value[featureId]
  }

  return {
    usage,
    useCount,
    trackUsage,
    reset
  }
}
