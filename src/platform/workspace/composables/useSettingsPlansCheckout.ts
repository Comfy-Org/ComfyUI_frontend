import { useToast } from 'primevue/usetoast'
import { computed, defineAsyncComponent, ref, watch } from 'vue'
import { useI18n } from 'vue-i18n'

import { useBillingContext } from '@/composables/billing/useBillingContext'
import type { CreditStop } from '@/platform/cloud/subscription/constants/teamPlanCreditStops'
import { getStopDiscountedMonthlyUsd } from '@/platform/cloud/subscription/constants/teamPlanCreditStops'
import type { BillingCycle } from '@/platform/cloud/subscription/utils/subscriptionTierRank'
import type {
  CheckoutTierKey,
  SubscriptionCheckoutSelection
} from '@/platform/workspace/composables/useSubscriptionCheckout'
import { useWorkspaceUI } from '@/platform/workspace/composables/useWorkspaceUI'
import { useBillingOperationStore } from '@/platform/workspace/stores/billingOperationStore'
import { useTeamWorkspaceStore } from '@/platform/workspace/stores/teamWorkspaceStore'
import { useDialogService } from '@/services/dialogService'
import { useAuthStore } from '@/stores/authStore'
import { useDialogStore } from '@/stores/dialogStore'

const CHECKOUT_DIALOG_KEY = 'settings-plan-checkout'

export interface PersonalPlanChoice {
  slug: string
  tierKey: CheckoutTierKey
  billingCycle: BillingCycle
}

export interface TeamPlanChoice {
  slug: string
  stop: CreditStop
  billingCycle: BillingCycle
}

/**
 * Checkout launcher for the local (non-cloud) Settings plans section. The
 * caller passes the exact API `Plan.slug` it rendered, and the shared checkout
 * flow (preview, consent, subscribe, op polling) runs inside
 * SettingsPlanCheckoutDialogContent, so what checkout sells is always what the
 * card advertised and a plan change is always previewed before it is charged.
 */
export function useSettingsPlansCheckout() {
  const { t } = useI18n()
  const toast = useToast()
  const authStore = useAuthStore()
  const dialogService = useDialogService()
  const dialogStore = useDialogStore()
  const workspaceStore = useTeamWorkspaceStore()
  const billingOperationStore = useBillingOperationStore()
  const { permissions } = useWorkspaceUI()
  const { currentTeamCreditStop, isActiveSubscription, isFreeTier } =
    useBillingContext()

  // Any paid subscription — personal or team — moving to a team stop is a plan
  // change to the backend, so it must be previewed and consented to.
  const hasPaidSubscription = computed(
    () => isActiveSubscription.value && !isFreeTier.value
  )

  const isStarting = ref(false)
  // Locked from the click through sign-in, hydration and the open dialog, and
  // while a subscription op is still pending after the dialog closed, so a
  // second click can never issue a second checkout.
  const isSubscribing = computed(
    () =>
      isStarting.value ||
      dialogStore.isDialogOpen(CHECKOUT_DIALOG_KEY) ||
      billingOperationStore.isSettingUp
  )

  async function subscribeToPersonal({
    slug,
    tierKey,
    billingCycle
  }: PersonalPlanChoice) {
    await startCheckout({
      planMode: 'personal',
      planSlug: slug,
      tierKey,
      billingCycle
    })
  }

  async function subscribeToTeam({ slug, stop, billingCycle }: TeamPlanChoice) {
    if (!stop.id) {
      toast.add({
        severity: 'error',
        summary: t('subscription.teamPlan.name'),
        detail: t('subscription.teamPlan.unavailable')
      })
      return
    }
    await startCheckout({
      planMode: 'team',
      planSlug: slug,
      billingCycle,
      stop: {
        id: stop.id,
        usd: stop.usd,
        credits: stop.credits,
        discountedUsd: getStopDiscountedMonthlyUsd(stop, billingCycle)
      },
      isChange:
        currentTeamCreditStop.value !== null || hasPaidSubscription.value
    })
  }

  async function startCheckout(selection: SubscriptionCheckoutSelection) {
    if (isSubscribing.value) return
    isStarting.value = true
    try {
      // A paid obligation is attributed to a full account, so an API-key
      // session signs in first even though it now carries a workspace.
      if (!authStore.currentUser && !(await dialogService.showSignInDialog())) {
        return
      }
      // Off-cloud the wallet hydrates in the background only once a session
      // exists, so a user who just signed in waits for it here.
      await workspaceStore.initialize().catch(() => undefined)
      if (!workspaceStore.activeWorkspace) {
        showError(
          workspaceStore.error?.message ?? t('subscription.subscribeFailed')
        )
        return
      }
      if (!permissions.value.canManageSubscription) {
        showError(t('settingsPlans.ownerOnly'))
        return
      }
      await openCheckoutDialog(selection)
    } finally {
      isStarting.value = false
    }
  }

  function openCheckoutDialog(
    initialCheckout: SubscriptionCheckoutSelection
  ): Promise<void> {
    return new Promise((resolve) => {
      const stopWatching = watch(
        () => dialogStore.isDialogOpen(CHECKOUT_DIALOG_KEY),
        (isOpen) => {
          if (isOpen) return
          stopWatching()
          resolve()
        },
        { flush: 'sync' }
      )
      dialogService.showLayoutDialog({
        key: CHECKOUT_DIALOG_KEY,
        component: defineAsyncComponent({
          loader: () =>
            import('@/platform/workspace/components/dialogs/settings/SettingsPlanCheckoutDialogContent.vue'),
          onError: failCheckoutDialogLoad
        }),
        props: {
          initialCheckout,
          onClose: () => dialogStore.closeDialog({ key: CHECKOUT_DIALOG_KEY })
        },
        dialogComponentProps: {
          renderer: 'reka',
          dismissableMask: false,
          contentClass:
            'w-[min(480px,95vw)] max-w-[min(480px,95vw)] sm:max-w-[min(480px,95vw)] max-h-[90vh] rounded-2xl border border-border-default bg-secondary-background'
        }
      })
    })
  }

  // The dialog is already on the stack when the chunk resolves, so a load
  // failure would otherwise leave an empty modal holding the checkout lock.
  function failCheckoutDialogLoad(
    _error: Error,
    _retry: () => void,
    fail: () => void
  ) {
    fail()
    showError(t('settingsPlans.checkoutUnavailable'))
    dialogStore.closeDialog({ key: CHECKOUT_DIALOG_KEY })
  }

  function showError(detail: string) {
    toast.add({ severity: 'error', summary: t('g.error'), detail })
  }

  return { isSubscribing, subscribeToPersonal, subscribeToTeam }
}
