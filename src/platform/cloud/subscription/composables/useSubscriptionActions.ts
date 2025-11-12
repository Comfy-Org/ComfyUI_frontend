import { computed, onMounted, ref } from 'vue'
import { useI18n } from 'vue-i18n'

import { useFirebaseAuthActions } from '@/composables/auth/useFirebaseAuthActions'
import { useSubscription } from '@/platform/cloud/subscription/composables/useSubscription'
import { isCloud } from '@/platform/distribution/types'
import { useTelemetry } from '@/platform/telemetry'
import { useDialogService } from '@/services/dialogService'
import { useCommandStore } from '@/stores/commandStore'

const MONTHLY_CREDIT_BONUS_USD = 10

/**
 * Composable for handling subscription panel actions and loading states
 */
export function useSubscriptionActions() {
  const { t } = useI18n()
  const dialogService = useDialogService()
  const authActions = useFirebaseAuthActions()
  const commandStore = useCommandStore()
  const telemetry = useTelemetry()
  const { fetchStatus, formattedRenewalDate } = useSubscription()

  const isLoadingSupport = ref(false)

  const refreshTooltip = computed(() => {
    const date =
      formattedRenewalDate.value || t('subscription.nextBillingCycle')
    return t('subscription.refreshesOn', {
      monthlyCreditBonusUsd: MONTHLY_CREDIT_BONUS_USD,
      date
    })
  })

  onMounted(() => {
    void handleRefresh()
  })

  const handleAddApiCredits = () => {
    dialogService.showTopUpCreditsDialog()
  }

  const handleMessageSupport = async () => {
    try {
      isLoadingSupport.value = true
      if (isCloud) {
        telemetry?.trackHelpResourceClicked({
          resource_type: 'help_feedback',
          is_external: true,
          source: 'subscription'
        })
      }
      await commandStore.execute('Comfy.ContactSupport')
    } catch (error) {
      console.error('[useSubscriptionActions] Error contacting support:', error)
    } finally {
      isLoadingSupport.value = false
    }
  }

  const handleRefresh = async () => {
    try {
      await Promise.all([authActions.fetchBalance(), fetchStatus()])
    } catch (error) {
      console.error('[useSubscriptionActions] Error refreshing data:', error)
    }
  }

  const handleLearnMoreClick = () => {
    window.open('https://docs.comfy.org/get_started/cloud', '_blank')
  }

  return {
    isLoadingSupport,
    refreshTooltip,
    handleAddApiCredits,
    handleMessageSupport,
    handleRefresh,
    handleLearnMoreClick
  }
}
