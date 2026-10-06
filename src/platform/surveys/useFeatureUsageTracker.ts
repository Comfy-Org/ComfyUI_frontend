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
  currentUsageData: FeatureUsageRecord,
  now: number
) {
  let oldValue: string | null = null
  let usageData: FeatureUsageRecord | undefined

  try {
    oldValue = localStorage.getItem(STORAGE_KEY)
    const storedUsageData = oldValue
      ? (JSON.parse(oldValue) as FeatureUsageRecord)
      : {}
    usageData = {
      ...storedUsageData,
      ...currentUsageData,
      [featureId]: incrementUsage(
        latestUsage(storedUsageData[featureId], currentUsageData[featureId]),
        now
      )
    }
    const newValue = JSON.stringify(usageData)

    localStorage.setItem(STORAGE_KEY, newValue)
  } catch {
    if (!usageData) return
  }

  window.dispatchEvent(
    new StorageEvent('storage', {
      key: STORAGE_KEY,
      oldValue,
      newValue: JSON.stringify(usageData),
      storageArea: localStorage
    })
  )
  return usageData
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

    usageData.value = persistUsageData(featureId, currentUsageData, now) ?? {
      ...currentUsageData,
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
