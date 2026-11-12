import { canSetUpAutoTopUp } from '@comfyorg/account-core/billing'

import { useTelemetry } from '@comfyorg/telemetry'
import { billingApi } from '@/platform/billing/api/billingApi'
import { useBillingCapabilities } from '@/platform/billing/composables/useBillingCapabilities'
import { usePlatformHandoff } from '@/platform/billing/composables/usePlatformHandoff'

/** Platform Billing's Turn on auto top-up link while the served facts offer it, and the offer's telemetry. */
export function useAutoTopUpSetupOffer() {
  const { autoTopUpEnabled, canManageAutoTopUp, autoTopUpSetup } =
    useBillingCapabilities()
  const { href, track, available } = usePlatformHandoff(
    '/profile/billing?auto_top_up=setup',
    { target: 'auto_top_up', action: 'turn_on' }
  )

  function trackOffer(stage: 'viewed' | 'declined') {
    useTelemetry()?.trackBillingEvent({
      operation: 'auto_top_up_offer',
      stage,
      outcome: 'pending'
    })
  }

  async function setupUrl(): Promise<string | null> {
    const canSetUp = canSetUpAutoTopUp({
      autoTopUpEnabled: autoTopUpEnabled.value,
      canManageAutoTopUp: canManageAutoTopUp.value,
      setup: autoTopUpSetup.value
    })
    if (!canSetUp) return null
    const settings = await billingApi.getBillingAutoReload()
    if (settings.status !== 'off') return null
    if (!available.value) return null
    trackOffer('viewed')
    return href.value
  }

  return { setupUrl, track, trackDeclined: () => trackOffer('declined') }
}
