import { useToast } from 'primevue/usetoast'
import { ref } from 'vue'
import { useI18n } from 'vue-i18n'

import { useBillingContext } from '@/composables/billing/useBillingContext'
import { getComfyPlatformBaseUrl } from '@/config/comfyApi'
import type { CreditStop } from '@/platform/cloud/subscription/constants/teamPlanCreditStops'
import type { BillingCycle } from '@/platform/cloud/subscription/utils/subscriptionTierRank'
import type {
  SubscribeOptions,
  SubscribeResponse
} from '@/platform/workspace/api/workspaceApi'
import { useBillingOperationStore } from '@/platform/workspace/stores/billingOperationStore'
import { useDialogService } from '@/services/dialogService'
import { useAuthStore } from '@/stores/authStore'

/**
 * Subscribe flow for the local (non-cloud) Settings plans section. The caller
 * passes the exact API `Plan.slug` it rendered — the slug is never synthesized
 * here, so what checkout sells always matches what the card advertised. Runs
 * the sign-in-first gate for API-key-only users, POSTs the subscribe, and hands
 * async outcomes to the billing-op poller, which owns progress toasts,
 * timeouts, and the success-side billing refresh.
 */
export function useSettingsPlansCheckout() {
  const { t } = useI18n()
  const toast = useToast()
  const authStore = useAuthStore()
  const dialogService = useDialogService()
  const billingOperationStore = useBillingOperationStore()
  const { subscribe, reconcileSubscriptionSuccess } = useBillingContext()

  const isSubscribing = ref(false)

  async function subscribeToPersonal(
    planSlug: string,
    billingCycle: BillingCycle
  ) {
    await startCheckout(planSlug, { billingCycle })
  }

  async function subscribeToTeam(
    planSlug: string,
    stop: CreditStop,
    billingCycle: BillingCycle
  ) {
    if (!stop.id) {
      toast.add({
        severity: 'error',
        summary: t('subscription.teamPlan.name'),
        detail: t('subscription.teamPlan.unavailable')
      })
      return
    }
    await startCheckout(planSlug, {
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
    // Without a Firebase session, require sign-in before checkout.
    if (!authStore.currentUser && !(await dialogService.showSignInDialog())) {
      return
    }

    // The lock spans the whole checkout lifecycle — the subscribe call, then
    // reconcile or op-polling to a terminal state (the poller's timeouts bound
    // it) — so a second click cannot issue a duplicate checkout request.
    isSubscribing.value = true
    try {
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
      }

      // A void response means the active billing rail drove its own checkout
      // (the legacy adapter launches Stripe itself and returns nothing); that is
      // not a failure, so return quietly rather than toasting a false error.
      if (!response) return

      if (response.status === 'subscribed') {
        // A refresh hiccup after a successful subscribe is not a failed subscribe.
        await reconcileSubscriptionSuccess().catch((error: unknown) =>
          console.error(
            'Failed to refresh billing state after subscribe:',
            error
          )
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
    } finally {
      isSubscribing.value = false
    }
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
