import { useDialogService } from '@/services/dialogService'
import { openTeamWorkspaceDialog } from '@/platform/billing/ports/teamWorkspaceDialog'
import { useDialogStore } from '@/stores/dialogStore'
import { useBillingContext } from '@/platform/billing/composables/useBillingContext'
import { useBillingRouting } from '@/platform/billing/composables/useBillingRouting'
import { useFeatureFlags } from '@/composables/useFeatureFlags'
import {
  getStopDiscountedMonthlyUsd,
  mapApiTeamCreditStops
} from '@comfyorg/account-ui/billing/catalog'
import { isCloud } from '@/platform/distribution/types'
import { useTelemetry } from '@comfyorg/telemetry'
import { reportError } from '@comfyorg/telemetry/reportError'
import type { PaymentIntentSource } from '@comfyorg/telemetry/types'
import type {
  SubscriptionCheckoutSelection,
  SubscriptionDialogOptions
} from '@/platform/billing/composables/types'
import { useBillingUI } from '@/platform/billing/composables/useBillingUI'
import { provideSubscriptionDialog } from '@/platform/billing/subscription/composables/subscriptionDialogAccess'
import { toCurrentTier } from '@/platform/billing/subscription/utils/billingPlanTelemetry'
import { useBillingSdkStore } from '@/platform/billing/sdk/billingSdkStore'
import { useBillingOperationStore } from '@/platform/billing/stores/billingOperationStore'
import { useWorkspaceIdentity } from '@/platform/workspace/ports/workspaceIdentity'
import { getWorkspaceTelemetryContext } from '@/platform/billing/telemetry/workspaceTelemetryContext'
import { useAuthStore } from '@/stores/authStore'
import {
  clearPendingSubscriptionCheckout,
  clearPendingSubscriptionCheckoutIfTerminal,
  getPendingSubscriptionCheckout
} from '@/platform/billing/utils/pendingSubscriptionCheckout'
import type { PendingSubscriptionCheckout } from '@/platform/billing/utils/pendingSubscriptionCheckout'

const DIALOG_KEY = 'subscription-required'
const RESUME_PRICING_KEY = 'comfy:resume-team-pricing'

function paymentIntentSourceOf(
  options?: SubscriptionDialogOptions
): PaymentIntentSource | undefined {
  return options?.paymentIntentSource ?? options?.reason
}

function getInitialPlanMode(
  explicitMode: SubscriptionDialogOptions['planMode'],
  isTeamPlan: boolean,
  hasCurrentPlan: boolean,
  isPersonalWorkspace: boolean
): NonNullable<SubscriptionDialogOptions['planMode']> {
  if (explicitMode) return explicitMode
  if (isTeamPlan) return 'team'
  if (hasCurrentPlan) return 'personal'
  return isPersonalWorkspace ? 'personal' : 'team'
}

export const useSubscriptionDialog = () => {
  const { shouldUseWorkspaceBilling, shouldUseUnifiedPricing } =
    useBillingRouting()
  const dialogService = useDialogService()
  const dialogStore = useDialogStore()
  const workspaceStore = useWorkspaceIdentity()
  const { flags } = useFeatureFlags()

  function hide() {
    dialogStore.closeDialog({ key: DIALOG_KEY })
  }

  function trackModalOpened(
    reason?: PaymentIntentSource,
    refusalType?: string
  ) {
    const { tier } = useBillingContext()
    useTelemetry()?.trackSubscription('modal_opened', {
      current_tier: tier.value?.toLowerCase(),
      reason,
      ...(refusalType && { refusal_type: refusalType }),
      ...getWorkspaceTelemetryContext()
    })
  }

  function trackPaywallShown(paymentIntentSource?: PaymentIntentSource) {
    const { tier } = useBillingContext()
    useTelemetry()?.trackBillingEvent({
      operation: 'entry',
      stage: 'paywall_shown',
      outcome: 'pending',
      payment_intent_source: paymentIntentSource,
      current_tier: toCurrentTier(tier.value)
    })
  }

  function trackPaywallEntry(
    reason?: PaymentIntentSource,
    paymentIntentSource?: PaymentIntentSource,
    refusalType?: string
  ) {
    trackModalOpened(reason, refusalType)
    trackPaywallShown(paymentIntentSource)
  }

  async function showInactiveMemberDialog(
    paymentIntentSource?: PaymentIntentSource
  ): Promise<boolean> {
    if (!shouldUseWorkspaceBilling.value) return false

    const { permissions } = useBillingUI()
    if (permissions.value.canManageSubscription) return false

    dialogService.showLayoutDialog({
      key: DIALOG_KEY,
      component: (
        await import('@/platform/billing/components/SubscriptionInactiveMemberDialog.vue')
      ).default,
      props: { onClose: hide }
    })
    trackPaywallShown(paymentIntentSource)
    return true
  }

  async function showPricingTable(
    options?: SubscriptionDialogOptions
  ): Promise<boolean> {
    if (!isCloud) return false
    try {
      const paymentIntentSource = paymentIntentSourceOf(options)
      if (await showInactiveMemberDialog(paymentIntentSource)) return true

      const { reason, creditsLocked, refusalType } = options ?? {}
      const dialogProps = {
        onClose: hide,
        reason,
        paymentIntentSource,
        creditsLocked
      }
      const trackEntry = () =>
        trackPaywallEntry(reason, paymentIntentSource, refusalType)

      const legacyPricingDialogProps = {
        dismissOnPointerDownOutside: false
      } as const

      if (shouldUseUnifiedPricing.value) {
        const { currentPlanSlug, isLegacyTeamPlan, isTeamPlan } =
          useBillingContext()
        if (isLegacyTeamPlan.value) {
          const personalInitialCheckout =
            options?.initialCheckout?.planMode === 'personal'
              ? options.initialCheckout
              : undefined
          dialogService.showLayoutDialog({
            key: DIALOG_KEY,
            component: (
              await import('@/platform/billing/components/SubscriptionRequiredDialogContentWorkspace.vue')
            ).default,
            props: {
              ...dialogProps,
              ...(personalInitialCheckout
                ? {
                    initialCheckout: personalInitialCheckout,
                    isPersonal: true
                  }
                : {})
            },
            dialogComponentProps: legacyPricingDialogProps
          })
          trackEntry()
          return true
        }

        dialogService.showLayoutDialog({
          key: DIALOG_KEY,
          component: (
            await import('@/platform/billing/components/SubscriptionRequiredDialogContentUnified.vue')
          ).default,
          props: {
            ...dialogProps,
            initialCheckout: options?.initialCheckout,
            initialPlanMode: getInitialPlanMode(
              options?.planMode,
              isTeamPlan.value,
              currentPlanSlug.value !== null,
              workspaceStore.isInPersonalWorkspace
            )
          },
          dialogComponentProps: {
            dismissOnPointerDownOutside: false
          }
        })
        trackEntry()
        return true
      }

      dialogService.showLayoutDialog({
        key: DIALOG_KEY,
        component: (
          await import('@/platform/billing/subscription/components/SubscriptionRequiredDialogContent.vue')
        ).default,
        props: {
          ...dialogProps,
          onChooseTeam: () => startTeamWorkspaceUpgradeFlow()
        },
        dialogComponentProps: legacyPricingDialogProps
      })
      trackEntry()
      return true
    } catch (error) {
      reportError(error, {
        surface: 'billing',
        errorType: 'error_opening_subscription_dialog'
      })
      return false
    }
  }

  function startTeamWorkspaceUpgradeFlow() {
    hide()
    openTeamWorkspaceDialog(() => {
      try {
        sessionStorage.setItem(RESUME_PRICING_KEY, '1')
      } catch {
        return
      }
    }).catch((error) => {
      console.error(
        '[useSubscriptionDialog] Failed to open team workspaces dialog:',
        error
      )
      void showPricingTable()
    })
  }

  async function restoreCheckoutSelection(
    pending: PendingSubscriptionCheckout
  ): Promise<SubscriptionCheckoutSelection | null> {
    const selection = pending.selection
    if (selection.planMode === 'personal') return selection

    const {
      fetchPlans,
      fetchStatus,
      teamCreditStops,
      currentTeamCreditStop,
      subscription,
      subscriptionStatus
    } = useBillingContext()
    await Promise.all([fetchPlans(), fetchStatus()])
    const stop = mapApiTeamCreditStops(teamCreditStops.value?.stops ?? []).find(
      ({ id }) => id === selection.teamCreditStopId
    )
    if (!stop?.id) return null

    return {
      planMode: 'team',
      stop: {
        id: stop.id,
        usd: stop.usd,
        credits: stop.credits,
        discountedUsd: getStopDiscountedMonthlyUsd(
          stop,
          selection.billingCycle
        ),
        periodChargeUsd: stop.periodChargeUsd
      },
      billingCycle: selection.billingCycle,
      isChange:
        currentTeamCreditStop.value !== null &&
        subscriptionStatus.value !== 'ended' &&
        (currentTeamCreditStop.value.id !== stop.id ||
          (subscription.value?.duration === 'MONTHLY'
            ? 'monthly'
            : 'yearly') !== selection.billingCycle)
    }
  }

  async function resumePendingCheckout(
    pending: PendingSubscriptionCheckout
  ): Promise<void> {
    if (
      pending.workspaceId !== workspaceStore.activeWorkspaceId ||
      pending.ownerUid !== useAuthStore().userId
    ) {
      clearPendingSubscriptionCheckout(pending.operationId)
      return
    }

    const operation = flags.billingSdkSubscriptionRailEnabled
      ? await useBillingSdkStore().recoverPendingOperation(pending.operationId)
      : await useBillingOperationStore().startOperation(
          pending.operationId,
          'subscription',
          {
            tier:
              pending.selection.planMode === 'personal'
                ? pending.selection.tierKey
                : 'team',
            cycle: pending.selection.billingCycle,
            attemptStartedAt: pending.attemptedAt
          }
        )
    if (!operation) {
      clearPendingSubscriptionCheckout(pending.operationId)
      return
    }
    clearPendingSubscriptionCheckoutIfTerminal(
      pending.operationId,
      operation.status
    )
    if (operation.status !== 'failed') return

    const initialCheckout = await restoreCheckoutSelection(pending)
    await showPricingTable({
      planMode: pending.selection.planMode,
      ...(initialCheckout && { initialCheckout })
    })
  }

  async function resumePendingPricingFlow(): Promise<void> {
    const pendingCheckout = getPendingSubscriptionCheckout()
    if (pendingCheckout) return resumePendingCheckout(pendingCheckout)

    try {
      const pending = sessionStorage.getItem(RESUME_PRICING_KEY)
      if (!pending) return
      sessionStorage.removeItem(RESUME_PRICING_KEY)

      if (!workspaceStore.isInPersonalWorkspace) {
        await showPricingTable({
          reason: 'team_upgrade_resume',
          planMode: 'team'
        })
      }
    } catch {
      return
    }
  }

  return {
    show: showPricingTable,
    showPricingTable,
    hide,
    startTeamWorkspaceUpgradeFlow,
    resumePendingPricingFlow
  }
}

provideSubscriptionDialog(useSubscriptionDialog)
