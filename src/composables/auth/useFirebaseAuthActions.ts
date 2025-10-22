import { FirebaseError } from 'firebase/app'
import { AuthErrorCodes } from 'firebase/auth'
import { ref } from 'vue'
import { useRouter } from 'vue-router'

import { useErrorHandling } from '@/composables/useErrorHandling'
import type { ErrorRecoveryStrategy } from '@/composables/useErrorHandling'
import { t } from '@/i18n'
import { isCloud } from '@/platform/distribution/types'
import { useToastStore } from '@/platform/updates/common/toastStore'
import { useDialogService } from '@/services/dialogService'
import { useFirebaseAuthStore } from '@/stores/firebaseAuthStore'
import { usdToMicros } from '@/utils/formatUtil'

/**
 * Service for Firebase Auth actions.
 * All actions are wrapped with error handling.
 * @returns {Object} - Object containing all Firebase Auth actions
 */
export const useFirebaseAuthActions = () => {
  const authStore = useFirebaseAuthStore()
  const toastStore = useToastStore()
  const { wrapWithErrorHandlingAsync, toastErrorHandler } = useErrorHandling()

  const accessError = ref(false)

  const reportError = (error: unknown) => {
    // Ref: https://firebase.google.com/docs/auth/admin/errors
    if (
      error instanceof FirebaseError &&
      [
        'auth/unauthorized-domain',
        'auth/invalid-dynamic-link-domain',
        'auth/unauthorized-continue-uri'
      ].includes(error.code)
    ) {
      accessError.value = true
      toastStore.add({
        severity: 'error',
        summary: t('g.error'),
        detail: t('toastMessages.unauthorizedDomain', {
          domain: window.location.hostname,
          email: 'support@comfy.org'
        })
      })
    } else {
      toastErrorHandler(error)
    }
  }

  const logout = wrapWithErrorHandlingAsync(async () => {
    await authStore.logout()
    toastStore.add({
      severity: 'success',
      summary: t('auth.signOut.success'),
      detail: t('auth.signOut.successDetail'),
      life: 5000
    })

    if (isCloud) {
      try {
        const router = useRouter()
        await router.push({ name: 'cloud-login' })
      } catch (error) {
        // needed for local development until we bring in cloud login pages.
        window.location.reload()
      }
    }
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
    return await authStore.fetchBalance()
  }, reportError)

  const signInWithGoogle = wrapWithErrorHandlingAsync(async () => {
    return await authStore.loginWithGoogle()
  }, reportError)

  const signInWithGithub = wrapWithErrorHandlingAsync(async () => {
    return await authStore.loginWithGithub()
  }, reportError)

  const signInWithEmail = wrapWithErrorHandlingAsync(
    async (email: string, password: string) => {
      return await authStore.login(email, password)
    },
    reportError
  )

  const signUpWithEmail = wrapWithErrorHandlingAsync(
    async (email: string, password: string) => {
      return await authStore.register(email, password)
    },
    reportError
  )

  /**
   * Recovery strategy for Firebase auth/requires-recent-login errors.
   * Prompts user to reauthenticate and retries the operation after successful login.
   */
  const createReauthenticationRecovery = <
    TArgs extends unknown[],
    TReturn
  >(): ErrorRecoveryStrategy<TArgs, TReturn> => {
    const dialogService = useDialogService()

    return {
      shouldHandle: (error: unknown) =>
        error instanceof FirebaseError &&
        error.code === AuthErrorCodes.CREDENTIAL_TOO_OLD_LOGIN_AGAIN,

      recover: async (
        _error: unknown,
        retry: (...args: TArgs) => Promise<TReturn> | TReturn,
        args: TArgs
      ) => {
        const confirmed = await dialogService.confirm({
          title: t('auth.reauthRequired.title'),
          message: t('auth.reauthRequired.message'),
          type: 'default'
        })

        if (!confirmed) {
          return
        }

        await authStore.logout()

        const signedIn = await dialogService.showSignInDialog()

        if (signedIn) {
          await retry(...args)
        }
      }
    }
  }

  const updatePassword = wrapWithErrorHandlingAsync(
    async (newPassword: string) => {
      await authStore.updatePassword(newPassword)
      toastStore.add({
        severity: 'success',
        summary: t('auth.passwordUpdate.success'),
        detail: t('auth.passwordUpdate.successDetail'),
        life: 5000
      })
    },
    reportError,
    undefined,
    [createReauthenticationRecovery<[string], void>()]
  )

  const deleteAccount = wrapWithErrorHandlingAsync(
    async () => {
      await authStore.deleteAccount()
      toastStore.add({
        severity: 'success',
        summary: t('auth.deleteAccount.success'),
        detail: t('auth.deleteAccount.successDetail'),
        life: 5000
      })
    },
    reportError,
    undefined,
    [createReauthenticationRecovery<[], void>()]
  )

  return {
    logout,
    sendPasswordReset,
    purchaseCredits,
    accessBillingPortal,
    fetchBalance,
    signInWithGoogle,
    signInWithGithub,
    signInWithEmail,
    signUpWithEmail,
    updatePassword,
    deleteAccount,
    accessError,
    reportError
  }
}
