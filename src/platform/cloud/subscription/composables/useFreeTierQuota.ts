import { createSharedComposable } from '@vueuse/core'
import { computed, ref, watch } from 'vue'

import { useFeatureFlags } from '@/composables/useFeatureFlags'
import { isCloud } from '@/platform/distribution/types'
import { remoteConfig } from '@/platform/remoteConfig/remoteConfig'
import { app } from '@/scripts/app'
import { graphCreditsBadges } from '@/systems/badgeSystem'

export const useFreeTierQuota = createSharedComposable(function () {
  const { flags } = useFeatureFlags()

  const available = ref(0)
  const maxAvailable = ref(0)
  watch(
    () => remoteConfig.value.free_tier_balance?.remaining,
    (val) => (available.value = val ?? 0),
    { immediate: true }
  )
  watch(
    () => remoteConfig.value.free_tier_balance?.allowance,
    (val) => (maxAvailable.value = val ?? 0),
    { immediate: true }
  )

  const quotaEnabled = computed(
    () => isCloud && flags.freeTierJobAllowanceEnabled && maxAvailable.value > 0
  )
  const hasInvalidNodes = computed(() => {
    return app.isGraphReady && graphCreditsBadges(app.rootGraph).length > 0
  })
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
