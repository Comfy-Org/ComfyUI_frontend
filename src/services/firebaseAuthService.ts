import { useErrorHandling } from '@/composables/useErrorHandling'
import { t } from '@/i18n'
import { useFirebaseAuthStore } from '@/stores/firebaseAuthStore'
import { useToastStore } from '@/stores/toastStore'
import { usdToMicros } from '@/utils/formatUtil'

/**
 * Service for Firebase Auth actions.
 * All actions are wrapped with error handling.
 * @returns {Object} - Object containing all Firebase Auth actions
 */
export const useFirebaseAuthService = () => {
  const authStore = useFirebaseAuthStore()
  const toastStore = useToastStore()
  const { wrapWithErrorHandlingAsync } = useErrorHandling()

  const reportError = (error: unknown) => {
    toastStore.add({
      severity: 'error',
      summary: t('g.error'),
      detail: error instanceof Error ? error.message : t('g.unknownError'),
      life: 5000
    })
  }

  const logout = wrapWithErrorHandlingAsync(async () => {
    await authStore.logout()
    toastStore.add({
      severity: 'success',
      summary: t('auth.signOut.success'),
      detail: t('auth.signOut.successDetail'),
      life: 5000
    })
  }, reportError)

  const sendPasswordReset = wrapWithErrorHandlingAsync(
    async (email: string) => {
      await authStore.sendPasswordReset(email)
      toastStore.add({
        severity: 'success',
        summary: t('auth.login.passwordResetSent'),
        detail: t('auth.login.passwordResetSentDetail'),
        life: 5000
      })
    },
    reportError
  )

  const purchaseCredits = wrapWithErrorHandlingAsync(async (amount: number) => {
    const response = await authStore.initiateCreditPurchase({
      amount_micros: usdToMicros(amount),
      currency: 'usd'
    })

    if (!response.checkout_url) {
      throw new Error(
        t('toastMessages.failedToPurchaseCredits', {
          error: 'No checkout URL returned'
        })
      )
    }

    // Go to Stripe checkout page
    window.open(response.checkout_url, '_blank')
  }, reportError)

  const accessBillingPortal = wrapWithErrorHandlingAsync(async () => {
    const response = await authStore.accessBillingPortal()
    if (!response.billing_portal_url) {
      throw new Error(
        t('toastMessages.failedToAccessBillingPortal', {
          error: 'No billing portal URL returned'
        })
      )
    }
    window.open(response.billing_portal_url, '_blank')
  }, reportError)

  const fetchBalance = wrapWithErrorHandlingAsync(async () => {
    await authStore.fetchBalance()
  }, reportError)

  return {
    logout,
    sendPasswordReset,
    purchaseCredits,
    accessBillingPortal,
    fetchBalance
  }
}
