import { computed, shallowReadonly, shallowRef } from 'vue'

import {
  useBillingClient,
  useCheckout,
  usePaymentMethods,
  usePreviewSubscribe
} from '@comfyorg/account-ui/billing'
import type { StripePaymentPhase } from '@comfyorg/account-ui/billing/stripe'
import type { BillingEntry } from '@comfyorg/billing-contract'
import { buildReturnUrl } from '@comfyorg/billing-contract'

import type {
  CheckoutPage,
  CheckoutPageEvent,
  PaymentTab,
  SavedArrival
} from '@/checkout/checkoutPage'
import {
  RESOLVING,
  railAcceptsPay,
  reduceCheckoutPage
} from '@/checkout/checkoutPage'
import { planCreditsSettingsUrl } from '@/checkout/cloudLinks'
import {
  buildSubscribeRequest,
  checkoutResultUrl
} from '@/checkout/subscribeRequest'
import { useBilledWorkspace } from '@/composables/useBilledWorkspace'
import { BILLING_WEB_ENV } from '@/config/env'
import { awaitBillingWebStripeKey } from '@/config/stripeKey'
import { useBillingEntry } from '@/entry/billingEntry'
import { createDeferredStripeChallengePort } from '@/session/stripeChallengePort'

/** What Pay charges: a new card's token, a saved method, or the method on file. */
export type PayChoice =
  | { readonly confirmationToken: string }
  | { readonly savedMethodId: string }
  | undefined

/**
 * The full-page checkout's effects around one `CheckoutPage` state: the
 * capabilities read, the quote, the saved methods and the Stripe key on
 * arrival, the payment element's readiness, and the subscribe on Pay. Every change goes through
 * `reduceCheckoutPage`; the quote itself stays with `usePreviewSubscribe`.
 * The key is awaited because the payment form reads it only when it mounts.
 */
export function useFullPageCheckout() {
  const { entry } = useBillingEntry()
  const billedWorkspace = useBilledWorkspace()
  const { capabilities } = useBillingClient<'capabilities'>(undefined)
  const { preview, quote } = usePreviewSubscribe()
  const saved = usePaymentMethods({ immediate: false })
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
    const [allowed, quoted, methods] = await Promise.all([
      capabilities.read(),
      quote({
        planSlug: arrival.plan,
        ...(arrival.teamCreditStopId === undefined
          ? {}
          : { teamCreditStopId: arrival.teamCreditStopId })
      }),
      saved.refresh(),
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
    } else if (quoted.value.transition_type === 'new_subscription') {
      dispatch({ type: 'quoted', method: 'collect', saved: arrivalOf(methods) })
    } else {
      dispatch({ type: 'quoted', method: 'on_file' })
    }
  }

  function arrivalOf(
    read: Awaited<ReturnType<typeof saved.refresh>>
  ): SavedArrival {
    return read.status === 'ok' ? read.value.methods.length : 'failed'
  }

  async function retrySaved() {
    dispatch({ type: 'savedRetried' })
    const read = await saved.refresh()
    const arrival = arrivalOf(read)
    dispatch(
      arrival === 'failed'
        ? { type: 'savedFailed' }
        : { type: 'savedLoaded', count: arrival }
    )
  }

  /** The whole-column error retries every rail that is down. */
  function retryColumn() {
    dispatch({ type: 'elementRetried' })
    const current = page.value
    if (
      current.kind === 'capture' &&
      current.rail.method === 'collect' &&
      current.rail.saved === 'failed'
    )
      void retrySaved()
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

  /** Back to the product, or to the workspace's Plan & Credits settings when this family has no destination for the link's target. */
  const returnLink = computed(() => {
    const workspace = billedWorkspace()
    const arrival = entry.value
    const host =
      arrival &&
      buildReturnUrl({
        target: arrival.returnTo,
        environment: BILLING_WEB_ENV,
        workspace
      })?.href
    return host ?? planCreditsSettingsUrl(workspace)
  })

  async function pay(choice: PayChoice) {
    const arrival = entry.value
    const quoted = preview.value
    if (arrival?.plan === undefined || !quoted || !canPay.value) return
    await checkout.subscribe(
      buildSubscribeRequest({
        arrival,
        plan: arrival.plan,
        quoted,
        confirmationToken:
          choice && 'confirmationToken' in choice
            ? choice.confirmationToken
            : undefined,
        ...(choice && 'savedMethodId' in choice
          ? { savedPaymentMethodId: choice.savedMethodId }
          : {}),
        confirmReactivation: false,
        returnUrl: checkoutResultUrl(
          arrival,
          billedWorkspace(),
          window.location.origin
        )
      })
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
    savedMethods: saved.methods,
    defaultSavedMethod: saved.defaultMethod,
    retryElement: () => dispatch({ type: 'elementRetried' }),
    retrySaved: () => void retrySaved(),
    retryColumn,
    selectTab: (tab: PaymentTab) => dispatch({ type: 'tabSelected', tab }),
    pay
  }
}
