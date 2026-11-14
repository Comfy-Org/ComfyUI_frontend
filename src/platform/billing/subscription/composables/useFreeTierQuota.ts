import { defineStore, storeToRefs } from 'pinia'
import { computed, ref, watch } from 'vue'

import { isCloud } from '@/platform/distribution/types'
import { useRemoteConfigStore } from '@/platform/remoteConfig/remoteConfigStore'
import { useApp } from '@/scripts/appInstance'
import { graphCreditsBadges } from '@/systems/badgeSystem'

const useFreeTierQuotaStore = defineStore('freeTierQuota', () => {
  const remoteConfigStore = useRemoteConfigStore()
  const available = ref(0)
  const maxAvailable = ref(0)
  watch(
    () => remoteConfigStore.config.free_tier_balance?.remaining,
    (val) => (available.value = val ?? 0),
    { immediate: true }
  )
  watch(
    () => remoteConfigStore.config.free_tier_balance?.allowance,
    (val) => (maxAvailable.value = val ?? 0),
    { immediate: true }
  )

  const quotaEnabled = computed(() => isCloud && maxAvailable.value > 0)
  const hasInvalidNodes = computed(() => {
    const app = useApp()
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

/** Free Cloud runs left this session, seeded from remote config and decremented per run. */
export function useFreeTierQuota() {
  const store = useFreeTierQuotaStore()
  const {
    available,
    freeTierExecutionPermitted,
    hasInvalidNodes,
    maxAvailable,
    quotaEnabled
  } = storeToRefs(store)
  return {
    available,
    freeTierExecutionPermitted,
    hasInvalidNodes,
    maxAvailable,
    quotaEnabled,
    trackRun: store.trackRun
  }
}
