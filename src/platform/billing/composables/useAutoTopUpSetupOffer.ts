import { canSetUpAutoTopUp } from '@comfyorg/account-core/billing'

import { billingApi } from '@/platform/billing/api/billingApi'
import { useBillingCapabilities } from '@/platform/billing/composables/useBillingCapabilities'
import { usePlatformHandoff } from '@/platform/billing/composables/usePlatformHandoff'

/** Platform Billing's Turn on auto top-up link while the served facts offer it, and the click's handoff telemetry. */
export function useAutoTopUpSetupOffer() {
  const { autoTopUpEnabled, canManageAutoTopUp, autoTopUpSetup } =
    useBillingCapabilities()
  const { href, track } = usePlatformHandoff(
    '/profile/billing?auto_top_up=setup',
    { target: 'auto_top_up', action: 'turn_on' }
  )

  async function setupUrl(): Promise<string | null> {
    const canSetUp = canSetUpAutoTopUp({
      autoTopUpEnabled: autoTopUpEnabled.value,
      canManageAutoTopUp: canManageAutoTopUp.value,
      setup: autoTopUpSetup.value
    })
    if (!canSetUp) return null
    const settings = await billingApi.getBillingAutoReload()
    return settings.status === 'off' ? href.value : null
  }

  return { setupUrl, track }
}
