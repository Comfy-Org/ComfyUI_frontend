import { createSharedComposable } from '@vueuse/core'
import { computed, ref, watch } from 'vue'

import { useCreditsBadgesInGraph } from '@/composables/node/usePriceBadge'
import { useFeatureFlags } from '@/composables/useFeatureFlags'
import { remoteConfig } from '@/platform/remoteConfig/remoteConfig'

type FreeTierBalance = {
  allowance: number
  used: number
  remaining: number
}

export const useFreeTierQuota = createSharedComposable(function () {
  const { flags } = useFeatureFlags()
  const creditsBadges = useCreditsBadgesInGraph()

  const freeTierBalance = computed(() => {
    return (remoteConfig.value as { free_tier_balance?: FreeTierBalance })
      ?.free_tier_balance
  })

  const available = ref(0)
  const maxAvailable = ref(0)
  watch(
    () => freeTierBalance.value?.remaining,
    (val) => (available.value = val ?? 0)
  )
  watch(
    () => freeTierBalance.value?.allowance,
    (val) => (maxAvailable.value = val ?? 0)
  )

  const quotaEnabled = computed(
    () => flags.freeTierJobAllowanceEnabled && maxAvailable.value > 0
  )
  const hasInvalidNodes = computed(() => creditsBadges.value.length > 0)
  const freeTierExecutionPermitted = computed(
    () => !hasInvalidNodes.value && quotaEnabled.value && available.value > 0
  )

  function trackRun() {
    if (available.value > 0) available.value--
  }

  return {
    available,
    freeTierExecutionPermitted,
    hasInvalidNodes,
    maxAvailable,
    quotaEnabled,
    trackRun
  }
})
