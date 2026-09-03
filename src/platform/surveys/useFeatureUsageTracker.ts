import { useStorage } from '@vueuse/core'
import { computed } from 'vue'
import { widenToNullish } from '@/utils/widenToNullish'

interface FeatureUsage {
  useCount: number
  firstUsed: number
  lastUsed: number
}

type FeatureUsageRecord = Record<string, FeatureUsage>

const STORAGE_KEY = 'Comfy.FeatureUsage'

/**
 * Tracks feature usage for survey eligibility.
 * Persists to localStorage.
 */
export function useFeatureUsageTracker(featureId: string) {
  const usageData = useStorage<FeatureUsageRecord>(STORAGE_KEY, {})

  const usage = computed(() => usageData.value[featureId])
  const currentUsage = computed(() => widenToNullish(usage.value))

  const useCount = computed(() => currentUsage.value?.useCount ?? 0)

  function trackUsage() {
    const now = Date.now()
    const existing = widenToNullish(usageData.value[featureId])

    usageData.value[featureId] = {
      useCount: (existing?.useCount ?? 0) + 1,
      firstUsed: existing?.firstUsed ?? now,
      lastUsed: now
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
