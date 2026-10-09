import { watch } from 'vue'

import ConfirmationDialogContent from '@/components/dialog/content/ConfirmationDialogContent.vue'
import TopUpCreditsDialogContentLegacy from '@/components/dialog/content/TopUpCreditsDialogContentLegacy.vue'
import {
  SELF_STYLED_PANEL_CONTENT_CLASS,
  SELF_STYLED_PANEL_DIALOG_PROPS
} from '@/components/ui/dialog/dialog.variants'
import { useToast } from '@/components/ui/toast/toastStore'
import type {
  DowngradeToPersonalResult,
  SubscriptionDialogOptions,
  TopUpCreditsDialogOptions
} from '@/composables/billing/types'
import { useBillingContext } from '@/composables/billing/useBillingContext'
import { t } from '@/i18n'
import type { CancellationFlowDialogOptions } from '@/platform/cloud/subscription/launchCancellationFlow'
import { isCloud } from '@/platform/distribution/types'
import { useTelemetry } from '@/platform/telemetry'
import type { PaymentIntentSource } from '@/platform/telemetry/types'
import InsufficientCreditsMemberDialog from '@/platform/workspace/components/InsufficientCreditsMemberDialog.vue'
import TopUpCreditsDialogContentWorkspace from '@/platform/workspace/components/TopUpCreditsDialogContentWorkspace.vue'
import { useBillingCapabilities } from '@/platform/workspace/composables/useBillingCapabilities'
import { useTeamWorkspaceStore } from '@/platform/workspace/stores/teamWorkspaceStore'
import { useDialogStore } from '@/stores/dialogStore'
import { getErrorMessage } from '@/utils/errorUtil'

function topUpFallbackReason(
  options?: TopUpCreditsDialogOptions
): PaymentIntentSource {
  if (options?.isInsufficientCredits) return 'out_of_credits'
  return options?.source ?? 'top_up_blocked'
}

export function useBillingDialogs() {
  const dialogStore = useDialogStore()

  async function showTopUpCreditsDialog(options?: TopUpCreditsDialogOptions) {
    useTelemetry()?.trackBillingEvent({
      operation: 'entry',
      stage: 'add_credits_clicked',
      outcome: 'pending',
      payment_intent_source:
        options?.source ??
        (options?.isInsufficientCredits ? 'out_of_credits' : undefined)
    })
    const { type } = useBillingContext()
    const { canTopUp, canSubscribeSelfServe, isReady, initialize } =
      useBillingCapabilities()
    // A capability read still in flight has to be awaited here, or a top-up
    // triggered during that window is silently dropped with no recovery UI.
    if (!isReady.value) await initialize()
    if (!isReady.value) return
    if (!canTopUp.value && canSubscribeSelfServe.value) {
      await showSubscriptionRequiredDialog({
        reason: topUpFallbackReason(options),
        paymentIntentSource: options?.source
      })
      return
    }

    if (!canTopUp.value && type.value === 'workspace') {
      return dialogStore.showDialog({
        key: 'insufficient-credits-member',
        component: InsufficientCreditsMemberDialog,
        props: {
          onClose: () =>
            dialogStore.closeDialog({ key: 'insufficient-credits-member' })
        },
        dialogComponentProps: {
          headless: true,
          contentClass:
            'w-[min(360px,95vw)] max-w-[min(360px,95vw)] sm:max-w-[min(360px,95vw)] border-0 bg-transparent shadow-none'
        }
      })
    }
    if (!canTopUp.value) return

    // Unknown never selects the legacy content, which buys credits directly.
    const isWorkspaceRail = type.value !== 'legacy'

    return dialogStore.showDialog({
      key: 'top-up-credits',
      component: isWorkspaceRail
        ? TopUpCreditsDialogContentWorkspace
        : TopUpCreditsDialogContentLegacy,
      props: options,
      dialogComponentProps: {
        headless: true,
        contentClass: SELF_STYLED_PANEL_CONTENT_CLASS
      }
    })
  }

  async function showSubscriptionRequiredDialog(
    options?: SubscriptionDialogOptions
  ) {
    if (!isCloud) return

    // A caller (e.g. the agent panel's paywall card) can fire this before the
    // bootstrap /features fetch resolves, most likely right after a fresh
    // load. window.__CONFIG__ is then still empty and the flag check below
    // would silently swallow the click. Await one fresh fetch before
    // deciding, rather than trusting a config snapshot that was never taken.
    if (!window.__CONFIG__?.subscription_required) {
      const { remoteConfigState } =
        await import('@/platform/remoteConfig/remoteConfig')
      if (remoteConfigState.value === 'unloaded') {
        const { refreshRemoteConfig } =
          await import('@/platform/remoteConfig/refreshRemoteConfig')
        await refreshRemoteConfig()
      }
    }

    if (!window.__CONFIG__?.subscription_required) {
      // This gate closing is never expected to be reachable from a cloud
      // surface with subscriptions enabled. Report it instead of returning
      // silently, so a caller's "Subscribe" button failing to do anything
      // shows up in telemetry rather than only in a user's bug report.
      const { reportError } = await import('@/platform/telemetry/reportError')
      reportError(
        new Error(
          'showSubscriptionRequiredDialog: subscription_required gate closed'
        ),
        {
          surface: 'billing',
          errorType: 'error_opening_subscription_dialog_gate_closed'
        }
      )
      return
    }

    const { useSubscriptionDialog } =
      await import('@/platform/cloud/subscription/composables/useSubscriptionDialog')
    const { show } = useSubscriptionDialog()
    show(options)
  }

  function showBillingComingSoonDialog() {
    return dialogStore.showDialog({
      key: 'billing-coming-soon',
      title: t('subscription.billingComingSoon.title'),
      component: ConfirmationDialogContent,
      props: {
        message: t('subscription.billingComingSoon.message'),
        type: 'info',
        onConfirm: () => {}
      },
      dialogComponentProps: {
        size: 'sm',
        contentClass: 'max-w-[360px]'
      }
    })
  }

  async function showCancelSubscriptionDialog(
    cancelAt?: string,
    flowAlreadyOpened?: boolean,
    isScopeCurrent?: () => boolean,
    flowAlreadyConfirmed?: boolean
  ) {
    const { default: component } =
      await import('@/components/dialog/content/subscription/CancelSubscriptionDialogContent.vue')
    if (isScopeCurrent && !isScopeCurrent()) return false
    const guardedProps = {
      ...(flowAlreadyOpened !== undefined ? { flowAlreadyOpened } : {}),
      ...(flowAlreadyConfirmed !== undefined ? { flowAlreadyConfirmed } : {}),
      ...(cancelAt !== undefined ? { cancelAt } : {}),
      ...(isScopeCurrent ? { isScopeCurrent } : {})
    }
    dialogStore.updateDialog({
      key: 'cancel-subscription',
      contentProps: guardedProps
    })
    return dialogStore.showDialog({
      key: 'cancel-subscription',
      component,
      props: guardedProps,
      dialogComponentProps: {
        ...SELF_STYLED_PANEL_DIALOG_PROPS
      }
    })
  }

  async function showCancellationFlowDialog(
    options: CancellationFlowDialogOptions
  ) {
    const { default: component } =
      await import('@/platform/cloud/subscription/components/CancellationFlowDialogContent.vue')
    if (!options.isScopeCurrent()) return false
    return dialogStore.showDialog({
      key: 'cancel-subscription',
      component,
      props: { ...options },
      dialogComponentProps: {
        ...SELF_STYLED_PANEL_DIALOG_PROPS,
        closable: false,
        dismissOnPointerDownOutside: false
      }
    })
  }

  async function showCancelSubscriptionFlow(cancelAt?: string) {
    const launchWorkspaceId = useTeamWorkspaceStore().activeWorkspaceId
    const cancellationFlow =
      await import('@/platform/cloud/subscription/launchCancellationFlow')
    return cancellationFlow.launchCancellationFlow({
      cancelAt,
      launchWorkspaceId,
      showFlow: showCancellationFlowDialog
    })
  }

  /**
   * Downgrade a team plan to a personal plan. Skips the type-"I understand"
   * confirm dialog only when there's nothing to confirm: no other members to
   * remove and no reactivation charge to disclose. Failures on that fast
   * path surface as an error toast.
   */
  async function showDowngradeToPersonalDialog(options: {
    planName: string
    planSlug: string
    paymentIntentSource?: PaymentIntentSource
  }): Promise<DowngradeToPersonalResult | null> {
    const {
      useDowngradeToPersonal,
      ReactivationConfirmationRequiredError,
      ReactivationAmountChangedError
    } = await import('@/platform/workspace/composables/useDowngradeToPersonal')
    const {
      hasOtherMembers,
      refreshMembers,
      previewDowngrade,
      downgradeToPersonal
    } = useDowngradeToPersonal({
      paymentIntentSource: options.paymentIntentSource
    })

    let requiresReactivation = false
    let chargeCents = 0
    try {
      await refreshMembers()
      const preview = await previewDowngrade(options.planSlug)
      requiresReactivation = preview.requiresReactivationConfirmation
      chargeCents = preview.preview.cost_today_cents
      if (!hasOtherMembers.value && !requiresReactivation) {
        return await downgradeToPersonal(options.planSlug)
      }
    } catch (error) {
      useToast().error(t('subscription.downgrade.failed'), {
        description: getErrorMessage(error) ?? t('g.unknownError')
      })
      return null
    }

    const { default: component } =
      await import('@/platform/workspace/components/dialogs/DowngradeRemoveMembersDialogContent.vue')
    const dialogKey = 'downgrade-remove-members'
    dialogStore.closeDialog({ key: dialogKey })
    return new Promise((resolve) => {
      const stopWatching = watch(
        () => dialogStore.isDialogOpen(dialogKey),
        (isOpen) => {
          if (!isOpen) resolveResult(null)
        },
        { flush: 'sync' }
      )
      function resolveResult(result: DowngradeToPersonalResult | null) {
        stopWatching()
        resolve(result)
      }

      dialogStore.showDialog({
        key: dialogKey,
        component,
        props: {
          planName: options.planName,
          planSlug: options.planSlug,
          requiresRemoval: hasOtherMembers.value,
          requiresReactivation,
          chargeCents,
          onConfirm: async (planSlug: string, confirmReactivation: boolean) => {
            try {
              const result = await downgradeToPersonal(
                planSlug,
                confirmReactivation,
                chargeCents
              )
              resolveResult(result)
            } catch (error) {
              // A fresh preview inside downgradeToPersonal() found the
              // dialog's captured state (open-time cancellation/charge) is
              // stale and refused to bill it. Push the corrected values into
              // the still-open dialog so a retry sends what these errors'
              // own preview says is actually true, instead of repeating the
              // same rejected request forever.
              if (
                error instanceof ReactivationConfirmationRequiredError ||
                error instanceof ReactivationAmountChangedError
              ) {
                requiresReactivation = true
                chargeCents = error.preview.cost_today_cents
                dialogStore.updateDialog({
                  key: dialogKey,
                  contentProps: { requiresReactivation, chargeCents }
                })
              }
              throw error
            }
          }
        },
        dialogComponentProps: {
          ...SELF_STYLED_PANEL_DIALOG_PROPS,
          closable: false,
          dismissOnPointerDownOutside: false,
          onClose: () => resolveResult(null)
        }
      })
    })
  }

  return {
    showTopUpCreditsDialog,
    showSubscriptionRequiredDialog,
    showBillingComingSoonDialog,
    showCancelSubscriptionDialog,
    showCancelSubscriptionFlow,
    showDowngradeToPersonalDialog
  }
}
