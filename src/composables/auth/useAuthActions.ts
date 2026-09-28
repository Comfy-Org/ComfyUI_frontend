import { FirebaseError } from 'firebase/app'
import { ref } from 'vue'

import {
  authErrorMessage,
  classifyAuthError,
  severityForAuthError
} from '@comfyorg/account-core/firebaseAuthError'
import type { AuthErrorCopy } from '@comfyorg/account-core/firebaseAuthError'

import { useBillingContext } from '@/composables/billing/useBillingContext'
import { watchForTopupBalanceUpdate } from '@/composables/billing/topupBalanceRefresh'
import { useErrorHandling } from '@/composables/useErrorHandling'
import { st, t } from '@/i18n'
import enMessages from '@/locales/en/main.json' with { type: 'json' }
import { presentSsoRequired } from '@/platform/auth/sso/ssoRequired'
import { isCloud } from '@/platform/distribution/types'
import { useTelemetry } from '@/platform/telemetry'
import type { AuthFlowAction } from '@/platform/telemetry/types'
import { PaymentPopupBlockedError } from '@/platform/telemetry/utils/billingFailureCategory'
import { useToast } from '@/components/ui/toast/toastStore'
import {
  clearAllWorkspaceStorage,
  prepareWorkflowLogoutTransition
} from '@/platform/workflow/persistence/base/storageIO'
import { useWorkflowService } from '@/platform/workflow/core/services/workflowService'
import { useWorkflowStore } from '@/platform/workflow/management/stores/workflowStore'
import { usePendingTopup } from '@/composables/billing/usePendingTopup'
import { useDialogService } from '@/services/dialogService'
import { SsoRequiredAuthError, useAuthStore } from '@/stores/authStore'
import type {
  BillingPortalTargetTier,
  SocialSignInOptions
} from '@/stores/authStore'
import { usdToMicros } from '@/utils/formatUtil'

/**
 * The app's own auth.errors table, read through vue-i18n at resolution time.
 * The key set is the app's, so a code added to main.json renders without the
 * package having to know it.
 */
export const localizedAuthErrorCopy = (): AuthErrorCopy => ({
  ...Object.fromEntries(
    Object.keys(enMessages.auth.errors).map((key) => [
      key,
      st(`auth.errors.${key}`, t('auth.errors.generic'))
    ])
  ),
  generic: t('auth.errors.generic'),
  signupBlocked: st('auth.errors.signupBlocked', t('auth.errors.generic'))
})

/**
 * Service for Firebase Auth actions.
 * All actions are wrapped with error handling.
 * @returns {Object} - Object containing all Firebase Auth actions
 */
export const useAuthActions = () => {
  const authStore = useAuthStore()
  const toast = useToast()
  const { wrapWithErrorHandlingAsync, toastErrorHandler } = useErrorHandling()

  const accessError = ref(false)

  const reportAuthFlowError =
    (authAction: AuthFlowAction) => (error: unknown) => {
      useTelemetry()?.trackAuthFailed({
        error_code: error instanceof FirebaseError ? error.code : 'unknown',
        auth_action: authAction
      })
      reportError(error)
    }

  /** Sends an account its SSO organization refused to SSO instead of a failure toast. */
  const presentSsoRefusal = (error: SsoRequiredAuthError): boolean => {
    const presented = presentSsoRequired({
      email: authStore.userEmail ?? undefined,
      organizationId: error.organizationId
    })
    if (presented) void authStore.logout().catch(toastErrorHandler)
    return presented
  }

  const reportError = (error: unknown) => {
    if (error instanceof SsoRequiredAuthError && presentSsoRefusal(error)) {
      return
    }
    const classification = classifyAuthError(error)
    // Ref: https://firebase.google.com/docs/auth/admin/errors
    const kind = severityForAuthError(classification)
    const notify = (description: string) =>
      toast[kind](t(`g.${kind}`), { description })
    if (classification.kind === 'unauthorized-domain') {
      accessError.value = true
      notify(
        t('toastMessages.unauthorizedDomain', {
          domain: window.location.hostname,
          email: 'support@comfy.org'
        })
      )
    } else if (classification.kind !== 'unknown') {
      notify(authErrorMessage(classification, localizedAuthErrorCopy()))
    } else if (error instanceof FirebaseError) {
      // classifyAuthError only knows auth/ codes; an app/ or installations/
      // FirebaseError still gets the localized copy, never the raw SDK text.
      toast.error(t('g.error'), {
        description: st(`auth.errors.${error.code}`, t('auth.errors.generic'))
      })
    } else {
      toastErrorHandler(error)
    }
  }

  /** `beforeSignOut` runs once unsaved work is settled; false keeps the user signed in. */
  const logout = wrapWithErrorHandlingAsync(
    async ({
      beforeSignOut
    }: { beforeSignOut?: () => Promise<boolean> } = {}) => {
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

      if (beforeSignOut && !(await beforeSignOut())) return

      await authStore.logout()
      if (isCloud) {
        prepareWorkflowLogoutTransition()
        clearAllWorkspaceStorage()
      }

      toast.success(t('auth.signOut.success'), {
        description: t('auth.signOut.successDetail'),
        duration: 5000
      })

      if (isCloud) {
        try {
          window.location.href = '/cloud/login'
        } catch {
          // needed for local development until we bring in cloud login pages.
          window.location.reload()
        }
      }
    },
    reportError
  )

  const sendPasswordReset = wrapWithErrorHandlingAsync(
    async (email: string) => {
      await authStore.sendPasswordReset(email)
      toast.success(t('auth.login.passwordResetSent'), {
        description: t('auth.login.passwordResetSentDetail'),
        duration: 5000
      })
      return true
    },
    reportAuthFlowError('password_reset')
  )

  /** Whether `purchaseCreditsDirect` goes on to open a checkout. */
  const canPurchaseCredits = (): boolean =>
    useBillingContext().canAccessSubscriptionFeatures.value

  /**
   * Raw (unwrapped) credit purchase. Exposed separately from `purchaseCredits`
   * so callers that need to observe a rejection directly (e.g. to fire failure
   * telemetry) aren't routed through `wrapWithErrorHandlingAsync`, which
   * resolves instead of re-throwing on failure.
   */
  const purchaseCreditsDirect = async (amount: number): Promise<void> => {
    if (!canPurchaseCredits()) return

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
    const pendingTopup = usePendingTopup()
    pendingTopup.startPendingTopup()
    if (!window.open(response.checkout_url, '_blank')) {
      pendingTopup.clearPendingTopup()
      throw new PaymentPopupBlockedError(
        t('subscription.preview.paymentPopupBlocked')
      )
    }
    watchForTopupBalanceUpdate()
  }

  const purchaseCredits = wrapWithErrorHandlingAsync(
    purchaseCreditsDirect,
    reportError
  )

  /** Unwrapped `accessBillingPortal`: rejects on failure, false when the tab is blocked. */
  const accessBillingPortalDirect = async (
    targetTier?: BillingPortalTargetTier,
    options?: { cancelSubscription?: boolean }
  ): Promise<boolean> => {
    const response = await authStore.accessBillingPortal(targetTier, options)
    if (!response.billing_portal_url) {
      throw new Error(
        t('toastMessages.failedToAccessBillingPortal', {
          error: 'No billing portal URL returned'
        })
      )
    }
    return window.open(response.billing_portal_url, '_blank') !== null
  }

  const accessBillingPortal = wrapWithErrorHandlingAsync(
    accessBillingPortalDirect,
    reportError
  )

  const fetchBalance = wrapWithErrorHandlingAsync(async () => {
    const result = await authStore.fetchBalance()
    // Top-up completion tracking happens in UsageLogsTable when events are fetched
    return result
  }, reportError)

  const signInWithGoogle = async (options?: SocialSignInOptions) =>
    await wrapWithErrorHandlingAsync(
      async () => await authStore.loginWithGoogle(options),
      reportAuthFlowError(
        options?.isNewUser ? 'google_sign_up' : 'google_sign_in'
      )
    )()

  const signInWithGithub = async (options?: SocialSignInOptions) =>
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

  return {
    logout,
    sendPasswordReset,
    purchaseCredits,
    purchaseCreditsDirect,
    canPurchaseCredits,
    accessBillingPortal,
    accessBillingPortalDirect,
    fetchBalance,
    signInWithGoogle,
    signInWithGithub,
    signInWithEmail,
    signUpWithEmail,
    accessError,
    reportError
  }
}
