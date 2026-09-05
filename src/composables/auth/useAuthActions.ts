import { FirebaseError } from 'firebase/app'
import { AuthErrorCodes } from 'firebase/auth'
import { ref } from 'vue'

import {
  classifyAuthError,
  isFirebaseAuthErrorLike
} from '@comfyorg/auth-core/firebaseAuthError'

import { useBillingContext } from '@/composables/billing/useBillingContext'
import { watchForTopupBalanceUpdate } from '@/composables/billing/topupBalanceRefresh'
import { useErrorHandling } from '@/composables/useErrorHandling'
import type { ErrorRecoveryStrategy } from '@/composables/useErrorHandling'
import { st, t } from '@/i18n'
import { isCloud } from '@/platform/distribution/types'
import { useTelemetry } from '@/platform/telemetry'
import type { AuthFlowAction } from '@/platform/telemetry/types'
import { useToastStore } from '@/platform/updates/common/toastStore'
import {
  clearAllWorkflowStorage,
  prepareWorkflowLogoutTransition
} from '@/platform/workflow/persistence/base/storageIO'
import { useWorkflowService } from '@/platform/workflow/core/services/workflowService'
import { useWorkflowStore } from '@/platform/workflow/management/stores/workflowStore'
import { usePendingTopup } from '@/composables/billing/usePendingTopup'
import { useDialogService } from '@/services/dialogService'
import { useAuthStore } from '@/stores/authStore'
import type { BillingPortalTargetTier } from '@/stores/authStore'
import { usdToMicros } from '@/utils/formatUtil'

/**
 * Service for Firebase Auth actions.
 * All actions are wrapped with error handling.
 * @returns {Object} - Object containing all Firebase Auth actions
 */
export const useAuthActions = () => {
  const authStore = useAuthStore()
  const toastStore = useToastStore()
  const { wrapWithErrorHandlingAsync, toastErrorHandler } = useErrorHandling()

  const accessError = ref(false)

  const reportAuthFlowError =
    (authAction: AuthFlowAction) => (error: unknown) => {
      useTelemetry()?.trackAuthFailed({
        error_code: isFirebaseAuthErrorLike(error) ? error.code : 'unknown',
        auth_action: authAction
      })
      reportError(error)
    }

  const reportError = (error: unknown) => {
    const classification = classifyAuthError(error)
    // Ref: https://firebase.google.com/docs/auth/admin/errors
    if (classification.kind === 'unauthorized-domain') {
      accessError.value = true
      toastStore.add({
        severity: 'error',
        summary: t('g.error'),
        detail: t('toastMessages.unauthorizedDomain', {
          domain: window.location.hostname,
          email: 'support@comfy.org'
        })
      })
    } else if (classification.kind === 'signup-blocked') {
      toastStore.add({
        severity: 'error',
        summary: t('g.error'),
        detail: t('auth.errors.signupBlocked')
      })
    } else if (classification.kind === 'popup-dismissed') {
      toastStore.add({
        severity: 'warn',
        summary: t('g.warning'),
        detail: st(
          `auth.errors.${classification.code}`,
          t('auth.errors.generic')
        )
      })
    } else if (classification.kind === 'auth') {
      toastStore.add({
        severity: 'error',
        summary: t('g.error'),
        detail: st(
          `auth.errors.${classification.code}`,
          t('auth.errors.generic')
        )
      })
    } else {
      toastErrorHandler(error)
    }
  }

  const logout = wrapWithErrorHandlingAsync(async () => {
    if (isCloud) {
      const workflowStore = useWorkflowStore()
      const modifiedWorkflows = workflowStore.modifiedWorkflows
      if (modifiedWorkflows.length > 0) {
        const dialogService = useDialogService()
        const confirmed = await dialogService.confirm({
          title: t('auth.signOut.unsavedChangesTitle'),
          message: t('auth.signOut.unsavedChangesMessage'),
          type: 'dirtyClose',
          denyLabel: t('auth.signOut.signOutAnyway')
        })
        if (confirmed === null) return

        if (confirmed) {
          const workflowService = useWorkflowService()
          for (const workflow of modifiedWorkflows) {
            try {
              const saved = await workflowService.saveWorkflow(workflow)
              if (!saved) return
            } catch {
              throw new Error(
                t('auth.signOut.saveFailed', { workflow: workflow.path })
              )
            }
          }
        }
      }
    }

    await authStore.logout()
    if (isCloud) {
      prepareWorkflowLogoutTransition()
      clearAllWorkflowStorage()
    }

    toastStore.add({
      severity: 'success',
      summary: t('auth.signOut.success'),
      detail: t('auth.signOut.successDetail'),
      life: 5000
    })

    if (isCloud) {
      try {
        window.location.href = '/cloud/login'
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
    reportAuthFlowError('password_reset')
  )

  /**
   * Raw (unwrapped) credit purchase. Exposed separately from `purchaseCredits`
   * so callers that need to observe a rejection directly (e.g. to fire failure
   * telemetry) aren't routed through `wrapWithErrorHandlingAsync`, which
   * resolves instead of re-throwing on failure.
   */
  const purchaseCreditsDirect = async (amount: number): Promise<void> => {
    const { canAccessSubscriptionFeatures } = useBillingContext()
    if (!canAccessSubscriptionFeatures.value) return

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

    // Mark the pending top-up directly, not via telemetry, so the balance
    // refresh on return still fires when telemetry consent is off.
    usePendingTopup().startPendingTopup()
    window.open(response.checkout_url, '_blank')
    watchForTopupBalanceUpdate()
  }

  const purchaseCredits = wrapWithErrorHandlingAsync(
    purchaseCreditsDirect,
    reportError
  )

  const accessBillingPortal = wrapWithErrorHandlingAsync<
    [targetTier?: BillingPortalTargetTier, openInNewTab?: boolean],
    boolean
  >(async (targetTier, openInNewTab = true) => {
    const response = await authStore.accessBillingPortal(targetTier)
    if (!response.billing_portal_url) {
      throw new Error(
        t('toastMessages.failedToAccessBillingPortal', {
          error: 'No billing portal URL returned'
        })
      )
    }
    if (openInNewTab) {
      return window.open(response.billing_portal_url, '_blank') !== null
    }

    globalThis.location.href = response.billing_portal_url
    return true
  }, reportError)

  const fetchBalance = wrapWithErrorHandlingAsync(async () => {
    const result = await authStore.fetchBalance()
    // Top-up completion tracking happens in UsageLogsTable when events are fetched
    return result
  }, reportError)

  const signInWithGoogle = async (options?: { isNewUser?: boolean }) =>
    await wrapWithErrorHandlingAsync(
      async () => await authStore.loginWithGoogle(options),
      reportAuthFlowError(
        options?.isNewUser ? 'google_sign_up' : 'google_sign_in'
      )
    )()

  const signInWithGithub = async (options?: { isNewUser?: boolean }) =>
    await wrapWithErrorHandlingAsync(
      async () => await authStore.loginWithGithub(options),
      reportAuthFlowError(
        options?.isNewUser ? 'github_sign_up' : 'github_sign_in'
      )
    )()

  const signInWithEmail = wrapWithErrorHandlingAsync(
    async (email: string, password: string) => {
      return await authStore.login(email, password)
    },
    reportAuthFlowError('email_sign_in')
  )

  const signUpWithEmail = wrapWithErrorHandlingAsync(
    async (email: string, password: string, turnstileToken?: string) => {
      return await authStore.register(email, password, turnstileToken)
    },
    reportAuthFlowError('email_sign_up')
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

  return {
    logout,
    sendPasswordReset,
    purchaseCredits,
    purchaseCreditsDirect,
    accessBillingPortal,
    fetchBalance,
    signInWithGoogle,
    signInWithGithub,
    signInWithEmail,
    signUpWithEmail,
    updatePassword,
    accessError,
    reportError
  }
}
