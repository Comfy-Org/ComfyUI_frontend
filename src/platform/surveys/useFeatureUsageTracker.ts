import { useStorage } from '@vueuse/core'
import { computed } from 'vue'

interface FeatureUsage {
  useCount: number
  firstUsed: number
  lastUsed: number
}

type FeatureUsageRecord = Partial<Record<string, FeatureUsage>>

const STORAGE_KEY = 'Comfy.FeatureUsage'

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
    const existing = storedUsageData[featureId] ?? currentUsage
    const usage = {
      useCount: (existing?.useCount ?? 0) + 1,
      firstUsed: existing?.firstUsed ?? now,
      lastUsed: now
    }
    const usageData = { ...storedUsageData, [featureId]: usage }
    const newValue = JSON.stringify(usageData)
    if (oldValue === newValue) return usageData

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
  const usageData = useStorage<FeatureUsageRecord>(STORAGE_KEY, {}, undefined, {
    flush: 'sync'
  })

  const usage = computed(() => usageData.value[featureId])
  const useCount = computed(() => usage.value?.useCount ?? 0)

  function trackUsage() {
    const now = Date.now()
    const existing = usageData.value[featureId]

    const nextUsage = {
      useCount: (existing?.useCount ?? 0) + 1,
      firstUsed: existing?.firstUsed ?? now,
      lastUsed: now
    }
    usageData.value = persistUsageData(featureId, existing, now) ?? {
      ...usageData.value,
      [featureId]: nextUsage
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
