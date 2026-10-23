import { computed, watch } from 'vue'

import { useBillingContext } from '@/platform/billing/composables/useBillingContext'
import { useFeatureFlags } from '@/composables/useFeatureFlags'
import { isCloud } from '@/platform/distribution/types'
import { useBillingAutoTopUpCard } from '@/platform/billing/composables/useBillingAutoTopUpCard'
import { deriveAutoTopUpBanner } from '@/platform/billing/composables/deriveAutoTopUpBanner'
import { useBillingCapabilities } from '@/platform/billing/composables/useBillingCapabilities'
import { usePausedBanner } from '@/platform/billing/composables/usePausedBanner'

export function useAutoTopUpBannerKind() {
  const billing = useBillingContext()
  const { flags } = useFeatureFlags()
  const { canManageAutoTopUp } = useBillingCapabilities()
  const { isPaused } = usePausedBanner()

  const readEnabled = computed(() => {
    if (!flags.autoTopUpEnabled) return false
    return canManageAutoTopUp.value
  })
  const { state, ensureRead } = useBillingAutoTopUpCard()
  watch(
    readEnabled,
    (enabled) => {
      if (enabled) ensureRead()
    },
    { immediate: true }
  )

  return computed(() => {
    const read = state.value
    const loaded = read.kind === 'loaded' ? read.settings : null
    return deriveAutoTopUpBanner({
      enabled: flags.autoTopUpEnabled,
      canManageAutoTopUp: canManageAutoTopUp.value,
      isPaused: isPaused.value,
      hasActivePlan: !isCloud || billing.subscription.value?.isActive === true,
      status: loaded?.status ?? null,
      disabledReason: loaded?.disabled_reason ?? null
    })
  })
}
