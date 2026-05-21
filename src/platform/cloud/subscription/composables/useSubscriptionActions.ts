import { onMounted, ref } from 'vue'

import { useBillingContext } from '@/composables/billing/useBillingContext'
import { isCloud } from '@/platform/distribution/types'
import { SupportForm } from '@/platform/support/config'
import { useSupportContext } from '@/platform/support/useSupportContext'
import { useTelemetry } from '@/platform/telemetry'
import { useDialogService } from '@/services/dialogService'

/**
 * Composable for handling subscription panel actions and loading states
 */
export function useSubscriptionActions() {
  const dialogService = useDialogService()
  const { openSupport } = useSupportContext()
  const telemetry = useTelemetry()
  const { fetchBalance, fetchStatus } = useBillingContext()

  const isLoadingSupport = ref(false)

  onMounted(() => {
    void handleRefresh()
  })

  const handleAddApiCredits = () => {
    telemetry?.trackAddApiCreditButtonClicked({
      source: 'settings_billing_panel'
    })
    void dialogService.showTopUpCreditsDialog()
  }

  const handleMessageSupport = () => {
    try {
      isLoadingSupport.value = true
      if (isCloud) {
        telemetry?.trackHelpResourceClicked({
          resource_type: 'help_feedback',
          is_external: true,
          source: 'subscription'
        })
      }
      openSupport(SupportForm.Billing, { productArea: 'Billing' })
    } catch (error) {
      console.error('[useSubscriptionActions] Error contacting support:', error)
    } finally {
      isLoadingSupport.value = false
    }
  }

  const handleRefresh = async () => {
    try {
      await Promise.all([fetchBalance(), fetchStatus()])
    } catch (error) {
      console.error('[useSubscriptionActions] Error refreshing data:', error)
    }
  }

  const handleLearnMoreClick = () => {
    window.open('https://docs.comfy.org/get_started/cloud', '_blank')
  }

  return {
    isLoadingSupport,
    handleAddApiCredits,
    handleMessageSupport,
    handleRefresh,
    handleLearnMoreClick
  }
}
