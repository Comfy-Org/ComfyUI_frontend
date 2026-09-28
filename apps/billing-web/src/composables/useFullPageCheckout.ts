import { computed, shallowReadonly, shallowRef } from 'vue'

import type {
  SubscribeInput,
  SubscriptionPreview
} from '@comfyorg/account-core/billing'
import {
  useBillingClient,
  useCheckout,
  usePreviewSubscribe
} from '@comfyorg/account-ui/billing'
import type { StripePaymentPhase } from '@comfyorg/account-ui/billing/stripe'
import type { BillingEntry } from '@comfyorg/billing-contract'
import {
  buildBillingEntryUrl,
  buildReturnUrl
} from '@comfyorg/billing-contract'

import type { CheckoutPage, CheckoutPageEvent } from '@/checkout/checkoutPage'
import {
  RESOLVING,
  railAcceptsPay,
  reduceCheckoutPage
} from '@/checkout/checkoutPage'
import { useBilledWorkspace } from '@/composables/useBilledWorkspace'
import { BILLING_WEB_ENV } from '@/config/env'
import { awaitBillingWebStripeKey } from '@/config/stripeKey'
import { useBillingEntry } from '@/entry/billingEntry'
import { createDeferredStripeChallengePort } from '@/session/stripeChallengePort'

/**
 * The full-page checkout's effects around one `CheckoutPage` state: the
 * capabilities read, the quote and the Stripe key on arrival, the payment
 * element's readiness, and the subscribe on Pay. Every change goes through
 * `reduceCheckoutPage`; the quote itself stays with `usePreviewSubscribe`.
 * The key is awaited because the payment form reads it only when it mounts.
 */
export function useFullPageCheckout() {
  const { entry } = useBillingEntry()
  const billedWorkspace = useBilledWorkspace()
  const { capabilities } = useBillingClient<'capabilities'>(undefined)
  const { preview, quote } = usePreviewSubscribe()
  const checkout = useCheckout({
    openUrl: (url) => window.location.assign(url),
    navigationMode: 'redirect',
    challengePort: createDeferredStripeChallengePort(awaitBillingWebStripeKey)
  })

  const page = shallowRef<CheckoutPage>(RESOLVING)

  function dispatch(event: CheckoutPageEvent) {
    page.value = reduceCheckoutPage(page.value, event)
  }

  async function resolve(arrival: BillingEntry) {
    if (arrival.plan === undefined) return
    const [allowed, quoted] = await Promise.all([
      capabilities.read(),
      quote({
        planSlug: arrival.plan,
        ...(arrival.teamCreditStopId === undefined
          ? {}
          : { teamCreditStopId: arrival.teamCreditStopId })
      }),
      awaitBillingWebStripeKey()
    ])
    if (allowed.status === 'error') {
      dispatch({ type: 'unavailable', code: allowed.code })
    } else if (!allowed.value.capabilities.can_subscribe_self_serve) {
      dispatch({
        type: 'refused',
        reason: allowed.value.denials.can_subscribe_self_serve ?? 'unspecified'
      })
    } else if (quoted.status === 'error') {
      dispatch({ type: 'unavailable', code: quoted.code })
    } else {
      dispatch({
        type: 'quoted',
        method:
          quoted.value.transition_type === 'new_subscription'
            ? 'new_card'
            : 'on_file'
      })
    }
  }

  if (entry.value !== undefined) void resolve(entry.value)

  function onPaymentPhase(phase: StripePaymentPhase) {
    if (phase.phase === 'payment_element_ready' && phase.element === 'payment')
      dispatch({ type: 'elementReady' })
    else if (phase.phase === 'payment_element_failed')
      dispatch({ type: 'elementFailed' })
  }

  /** A started operation keeps Pay locked, so a second click cannot charge twice. */
  const canPay = computed(
    () =>
      railAcceptsPay(page.value) &&
      preview.value?.allowed === true &&
      checkout.operation.value === undefined
  )

  const payFailure = computed(() =>
    checkout.result.value?.status === 'error'
      ? checkout.result.value.code
      : undefined
  )

  const returnLink = computed(() => {
    const arrival = entry.value
    if (!arrival) return undefined
    return buildReturnUrl({
      target: arrival.returnTo,
      environment: BILLING_WEB_ENV,
      workspace: billedWorkspace()
    })?.href
  })

  /** Where a hosted payment step sends the customer back: this origin, same request. */
  function resultUrl(arrival: BillingEntry): string | undefined {
    const workspaceId = billedWorkspace()
    const built = buildBillingEntryUrl({
      billingOrigin: window.location.origin,
      intent: 'result',
      product: arrival.product,
      returnTo: arrival.returnTo,
      ...(arrival.plan === undefined ? {} : { plan: arrival.plan }),
      ...(arrival.teamCreditStopId === undefined
        ? {}
        : { teamCreditStopId: arrival.teamCreditStopId }),
      ...(workspaceId === undefined ? {} : { workspaceId })
    })
    return built.status === 'ok' ? built.url.href : undefined
  }

  function subscribeRequest(
    arrival: BillingEntry,
    plan: string,
    quoted: SubscriptionPreview,
    confirmationToken: string | undefined
  ): SubscribeInput {
    const returnUrl = resultUrl(arrival)
    return {
      plan_slug: plan,
      ...(confirmationToken === undefined
        ? {}
        : { confirmation_token: confirmationToken }),
      ...(arrival.teamCreditStopId === undefined
        ? {}
        : { team_credit_stop_id: arrival.teamCreditStopId }),
      ...(quoted.quote_id === undefined ? {} : { quote_id: quoted.quote_id }),
      ...(quoted.quote_version === undefined
        ? {}
        : { quote_version: quoted.quote_version }),
      ...(quoted.is_immediate && quoted.proration_at !== undefined
        ? { proration_at: quoted.proration_at }
        : {}),
      ...(returnUrl === undefined ? {} : { return_url: returnUrl })
    }
  }

  async function pay(confirmationToken?: string) {
    const arrival = entry.value
    const quoted = preview.value
    if (arrival?.plan === undefined || !quoted || !canPay.value) return
    await checkout.subscribe(
      subscribeRequest(arrival, arrival.plan, quoted, confirmationToken)
    )
  }

  return {
    page: shallowReadonly(page),
    preview,
    canPay,
    submitting: checkout.submitting,
    payFailure,
    returnLink,
    onPaymentPhase,
    retryElement: () => dispatch({ type: 'elementRetried' }),
    pay
  }
}
