import { defineAsyncComponent } from 'vue'
import { useDialogService } from '@/services/dialogService'
import { useWorkspaceDialogs } from '@/platform/workspace/composables/useWorkspaceDialogs'
import { useDialogStore } from '@/stores/dialogStore'
import { useBillingContext } from '@/composables/billing/useBillingContext'
import { useBillingRouting } from '@/composables/billing/useBillingRouting'
import { useFeatureFlags } from '@/composables/useFeatureFlags'
import {
  getStopDiscountedMonthlyUsd,
  mapApiTeamCreditStops
} from '@comfyorg/account-ui/billing/catalog'
import { isCloud } from '@/platform/distribution/types'
import { useTelemetry } from '@/platform/telemetry'
import type { PaymentIntentSource } from '@/platform/telemetry/types'
import type {
  SubscriptionCheckoutSelection,
  SubscriptionDialogOptions
} from '@/composables/billing/types'
import { useWorkspaceUI } from '@/platform/workspace/composables/useWorkspaceUI'
import { toCurrentTier } from '@/platform/cloud/subscription/utils/billingPlanTelemetry'
import { useBillingSdkStore } from '@/platform/workspace/billing/sdk/billingSdkStore'
import { useBillingOperationStore } from '@/platform/workspace/stores/billingOperationStore'
import { useTeamWorkspaceStore } from '@/platform/workspace/stores/teamWorkspaceStore'
import { useAuthStore } from '@/stores/authStore'
import {
  clearPendingSubscriptionCheckout,
  clearPendingSubscriptionCheckoutIfTerminal,
  getPendingSubscriptionCheckout
} from '@/platform/workspace/utils/pendingSubscriptionCheckout'
import type { PendingSubscriptionCheckout } from '@/platform/workspace/utils/pendingSubscriptionCheckout'

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
  const workspaceStore = useTeamWorkspaceStore()
  const { flags } = useFeatureFlags()

  function hide() {
    dialogStore.closeDialog({ key: DIALOG_KEY })
  }

  // Fired here — the choke point every paywall/pricing dialog variant passes
  // through — so both the legacy and workspace billing paths emit it.
  function trackModalOpened(reason?: PaymentIntentSource) {
    // Resolved lazily to avoid the useBillingContext import cycle (see below).
    const { tier } = useBillingContext()
    useTelemetry()?.trackSubscription('modal_opened', {
      current_tier: tier.value?.toLowerCase(),
      reason
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

  function showInactiveMemberDialog(
    paymentIntentSource?: PaymentIntentSource
  ): boolean {
    if (!shouldUseWorkspaceBilling.value) return false

    const { permissions } = useWorkspaceUI()
    if (permissions.value.canManageSubscription) return false

    trackPaywallShown(paymentIntentSource)
    dialogService.showLayoutDialog({
      key: DIALOG_KEY,
      component: defineAsyncComponent(
        () =>
          import('@/platform/workspace/components/SubscriptionInactiveMemberDialog.vue')
      ),
      props: { onClose: hide },
      dialogComponentProps: {
        contentClass:
          'w-[min(360px,95vw)] max-w-[min(360px,95vw)] sm:max-w-[min(360px,95vw)] border-0 bg-transparent shadow-none'
      }
    })
    return true
  }

  function showPricingTable(options?: SubscriptionDialogOptions) {
    if (!isCloud) return
    const paymentIntentSource = paymentIntentSourceOf(options)
    if (showInactiveMemberDialog(paymentIntentSource)) return

    trackModalOpened(options?.reason)
    trackPaywallShown(paymentIntentSource)

    const legacyPricingDialogProps = {
      size: 'full',
      dismissOnPointerDownOutside: false,
      contentClass:
        'sm:max-w-7xl max-h-[90vh] rounded-2xl border border-border-default bg-secondary-background shadow-[0_25px_80px_rgba(5,6,12,0.45)]'
    } as const

    // Jun-5 model: a single unified pricing table (personal/team plan toggle on
    // one workspace). The billing rail still selects the checkout and top-up
    // backend, but does not select the pricing table.
    if (shouldUseUnifiedPricing.value) {
      // Existing per-member (legacy) team subscribers keep the old tier-based
      // team table; the unified credit-slider table is for everyone else.
      // Resolved lazily (not at composable setup): these three composables form
      // an import cycle (useBillingContext -> useWorkspaceBilling ->
      // useSubscriptionDialog), so a setup-time read would deref the shared
      // context before its state is constructed.
      const { currentPlanSlug, isLegacyTeamPlan, isTeamPlan } =
        useBillingContext()
      if (isLegacyTeamPlan.value) {
        const personalInitialCheckout =
          options?.initialCheckout?.planMode === 'personal'
            ? options.initialCheckout
            : undefined
        dialogService.showLayoutDialog({
          key: DIALOG_KEY,
          component: defineAsyncComponent(
            () =>
              import('@/platform/workspace/components/SubscriptionRequiredDialogContentWorkspace.vue')
          ),
          props: {
            onClose: hide,
            reason: options?.reason,
            paymentIntentSource,
            ...(personalInitialCheckout
              ? {
                  initialCheckout: personalInitialCheckout,
                  isPersonal: true
                }
              : {})
          },
          dialogComponentProps: legacyPricingDialogProps
        })
        return
      }

      dialogService.showLayoutDialog({
        key: DIALOG_KEY,
        component: defineAsyncComponent(
          () =>
            import('@/platform/workspace/components/SubscriptionRequiredDialogContentUnified.vue')
        ),
        props: {
          onClose: hide,
          reason: options?.reason,
          paymentIntentSource,
          embeddedCheckoutEnabled: flags.embeddedCheckoutEnabled,
          initialCheckout: options?.initialCheckout,
          initialPlanMode: getInitialPlanMode(
            options?.planMode,
            isTeamPlan.value,
            currentPlanSlug.value !== null,
            workspaceStore.isInPersonalWorkspace
          )
        },
        dialogComponentProps: {
          // Reka (the default renderer) sizes via size/contentClass; a PrimeVue
          // `style` width is ignored here and collapses the table to the default
          // `md` frame. `w-fit` lets each step hug its content -- the pricing
          // table fills its 1280px content while the compact confirm/success
          // steps shrink (the content root sets its own width per checkoutStep).
          size: 'full',
          // A scrim click mid-checkout would silently discard typed card
          // details and any pending 3DS state; the X is the only close.
          dismissOnPointerDownOutside: false,
          contentClass:
            'w-fit max-w-[min(1280px,95vw)] sm:max-w-[min(1280px,95vw)] max-h-[90vh] rounded-2xl border border-border-default bg-secondary-background shadow-[0_25px_80px_rgba(5,6,12,0.45)]'
        }
      })
      return
    }

    dialogService.showLayoutDialog({
      key: DIALOG_KEY,
      component: defineAsyncComponent(
        () =>
          import('@/platform/cloud/subscription/components/SubscriptionRequiredDialogContent.vue')
      ),
      props: {
        onClose: hide,
        reason: options?.reason,
        paymentIntentSource,
        onChooseTeam: () => startTeamWorkspaceUpgradeFlow()
      },
      dialogComponentProps: legacyPricingDialogProps
    })
  }

  function show(options?: SubscriptionDialogOptions) {
    if (isCloud && showInactiveMemberDialog(paymentIntentSourceOf(options))) {
      return
    }

    showPricingTable(options)
  }

  /**
   * Start the two-stage team workspace upgrade flow:
   * 1. Close the current pricing dialog
   * 2. Open the create workspace dialog
   * 3. On successful creation, persist a resume intent so the team pricing
   *    dialog reopens automatically after the page reload
   *
   * Uses sessionStorage (not a store) because the intent must survive
   * a full page reload triggered by workspace switching.
   */
  function startTeamWorkspaceUpgradeFlow() {
    hide()
    useWorkspaceDialogs()
      .showTeamWorkspacesDialog(() => {
        try {
          sessionStorage.setItem(RESUME_PRICING_KEY, '1')
        } catch {
          // sessionStorage may be unavailable
        }
      })
      .catch((error) => {
        console.error(
          '[useSubscriptionDialog] Failed to open team workspaces dialog:',
          error
        )
        showPricingTable()
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
        discountedUsd: getStopDiscountedMonthlyUsd(stop, selection.billingCycle)
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

    // The host pointer stays as it is: it carries the tier/cycle selection the
    // pricing dialog restores below, which the SDK's scope-keyed pointer
    // deliberately does not. Only who drives the operation moves.
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
    // Nothing to adopt: the server names no pending operation for this scope,
    // so the parked pointer is stale and the customer is not mid-checkout.
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
    showPricingTable({
      planMode: pending.selection.planMode,
      ...(initialCheckout && { initialCheckout })
    })
  }

  function resumePendingPricingFlow(): Promise<void> | void {
    const pendingCheckout = getPendingSubscriptionCheckout()
    if (pendingCheckout) return resumePendingCheckout(pendingCheckout)

    try {
      const pending = sessionStorage.getItem(RESUME_PRICING_KEY)
      if (!pending) return
      sessionStorage.removeItem(RESUME_PRICING_KEY)

      if (!workspaceStore.isInPersonalWorkspace) {
        showPricingTable({
          reason: 'team_upgrade_resume',
          planMode: 'team'
        })
      }
    } catch {
      // sessionStorage may be unavailable
    }
  }

  return {
    show,
    showPricingTable,
    hide,
    startTeamWorkspaceUpgradeFlow,
    resumePendingPricingFlow
  }
}
