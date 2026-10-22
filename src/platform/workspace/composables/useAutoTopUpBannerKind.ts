import { computed } from 'vue'

import { useBillingContext } from '@/composables/billing/useBillingContext'
import { useFeatureFlags } from '@/composables/useFeatureFlags'
import { isCloud } from '@/platform/distribution/types'
import { useBillingAutoTopUpCard } from '@/platform/workspace/components/dialogs/settings/billing/useBillingAutoTopUpCard'
import { deriveAutoTopUpBanner } from '@/platform/workspace/composables/deriveAutoTopUpBanner'
import { useBillingCapabilities } from '@/platform/workspace/composables/useBillingCapabilities'
import { usePausedBanner } from '@/platform/workspace/composables/usePausedBanner'

export function useAutoTopUpBannerKind() {
  const billing = useBillingContext()
  const { flags } = useFeatureFlags()
  const { canManageAutoTopUp, autoTopUpSetup } = useBillingCapabilities()
  const { isPaused } = usePausedBanner()

  const readEnabled = computed(() => {
    if (!flags.autoTopUpEnabled) return false
    return canManageAutoTopUp.value
  })
  const { state } = useBillingAutoTopUpCard(
    () => autoTopUpSetup.value?.state !== 'unavailable',
    readEnabled
  )

  return computed(() => {
    const read = state.value
    const loaded = read.kind === 'loaded' ? read.settings : null
    return deriveAutoTopUpBanner({
      enabled: flags.autoTopUpEnabled,
      canManageAutoTopUp: canManageAutoTopUp.value,
      isPaused: isPaused.value,
      hasActivePlan: !isCloud || billing.canAccessSubscriptionFeatures.value,
      status: loaded?.status ?? null,
      disabledReason: loaded?.disabled_reason ?? null
    })
  })
}
