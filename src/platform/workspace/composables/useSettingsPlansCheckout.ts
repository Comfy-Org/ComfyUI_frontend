import { useToast } from 'primevue/usetoast'
import { ref } from 'vue'
import { useI18n } from 'vue-i18n'

import { useBillingContext } from '@/composables/billing/useBillingContext'
import { getComfyPlatformBaseUrl } from '@/config/comfyApi'
import { getTeamPlanSlug } from '@/platform/cloud/subscription/constants/teamPlanCreditStops'
import type { CreditStop } from '@/platform/cloud/subscription/constants/teamPlanCreditStops'
import type { BillingCycle } from '@/platform/cloud/subscription/utils/subscriptionTierRank'
import type {
  SubscribeOptions,
  SubscribeResponse
} from '@/platform/workspace/api/workspaceApi'
import { findPlanSlug } from '@/platform/workspace/composables/useSubscriptionCheckout'
import type { CheckoutTierKey } from '@/platform/workspace/composables/useSubscriptionCheckout'
import { useBillingOperationStore } from '@/platform/workspace/stores/billingOperationStore'
import { useDialogService } from '@/services/dialogService'
import { useAuthStore } from '@/stores/authStore'

/**
 * Subscribe flow for the local (non-cloud) Settings plans section: resolve the
 * catalog slug, run the sign-in-first gate for API-key-only users, POST the
 * subscribe, and hand async outcomes to the billing-op poller, which owns
 * progress toasts, timeouts, and the success-side billing refresh.
 */
export function useSettingsPlansCheckout() {
  const { t } = useI18n()
  const toast = useToast()
  const authStore = useAuthStore()
  const dialogService = useDialogService()
  const billingOperationStore = useBillingOperationStore()
  const { plans, subscribe, reconcileSubscriptionSuccess } = useBillingContext()

  const isSubscribing = ref(false)

  async function subscribeToPersonal(
    tierKey: CheckoutTierKey,
    billingCycle: BillingCycle
  ) {
    await startCheckout(findPlanSlug(plans.value, tierKey, billingCycle), {
      billingCycle
    })
  }

  async function subscribeToTeam(stop: CreditStop, billingCycle: BillingCycle) {
    if (!stop.id) {
      toast.add({
        severity: 'error',
        summary: t('subscription.teamPlan.name'),
        detail: t('subscription.teamPlan.unavailable')
      })
      return
    }
    await startCheckout(getTeamPlanSlug(billingCycle), {
      billingCycle,
      teamCreditStopId: stop.id
    })
  }

  async function startCheckout(
    planSlug: string | null,
    options: Pick<SubscribeOptions, 'billingCycle' | 'teamCreditStopId'>
  ) {
    if (isSubscribing.value) return
    if (!planSlug) {
      showSubscribeError()
      return
    }
    // Q-SUB: API-key-only users go through the existing sign-in touchpoint
    // before checkout; a Firebase session skips straight through.
    if (!authStore.currentUser && !(await dialogService.showSignInDialog())) {
      return
    }

    isSubscribing.value = true
    let response: SubscribeResponse | void
    try {
      response = await subscribe(planSlug, {
        ...options,
        returnUrl: `${getComfyPlatformBaseUrl()}/payment/success`,
        cancelUrl: `${getComfyPlatformBaseUrl()}/payment/failed`
      })
    } catch (error) {
      showSubscribeError(error)
      return
    } finally {
      isSubscribing.value = false
    }

    if (!response) {
      showSubscribeError()
      return
    }

    if (response.status === 'subscribed') {
      // A refresh hiccup after a successful subscribe is not a failed subscribe.
      await reconcileSubscriptionSuccess().catch((error: unknown) =>
        console.error('Failed to refresh billing state after subscribe:', error)
      )
      return
    }

    if (
      response.status === 'needs_payment_method' &&
      response.payment_method_url
    ) {
      // The open runs after `await subscribe(...)`, so it's not a direct user
      // gesture and can be popup-blocked; warn instead of failing silently.
      const paymentWindow = window.open(response.payment_method_url, '_blank')
      if (!paymentWindow) {
        toast.add({
          severity: 'warn',
          summary: t('g.warning'),
          detail: t('subscription.preview.paymentPopupBlocked')
        })
      }
    }
    await billingOperationStore.startOperation(
      response.billing_op_id,
      'subscription'
    )
  }

  function showSubscribeError(error?: unknown) {
    toast.add({
      severity: 'error',
      summary: t('g.error'),
      detail:
        error instanceof Error
          ? error.message
          : t('subscription.subscribeFailed')
    })
  }

  return { isSubscribing, subscribeToPersonal, subscribeToTeam }
}
