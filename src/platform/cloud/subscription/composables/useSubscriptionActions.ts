import { computed, onMounted, ref } from 'vue'
import { useI18n } from 'vue-i18n'

import { useFirebaseAuthActions } from '@/composables/auth/useFirebaseAuthActions'
import { useSubscription } from '@/platform/cloud/subscription/composables/useSubscription'
import { useDialogService } from '@/services/dialogService'
import { useCommandStore } from '@/stores/commandStore'

/**
 * Composable for handling subscription panel actions and loading states
 */
export function useSubscriptionActions() {
  const { t } = useI18n()
  const dialogService = useDialogService()
  const authActions = useFirebaseAuthActions()
  const commandStore = useCommandStore()
  const { fetchStatus, formattedRenewalDate } = useSubscription()

  const isLoadingSupport = ref(false)

  const refreshTooltip = computed(() => {
    const date =
      formattedRenewalDate.value || t('subscription.nextBillingCycle')
    return `Refreshes on ${date}`
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
