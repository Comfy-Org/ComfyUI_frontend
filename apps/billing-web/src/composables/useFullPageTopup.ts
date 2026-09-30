import { useIntervalFn } from '@vueuse/core'
import { computed, shallowReadonly, shallowRef, watch } from 'vue'

import { useBillingClient, useTopUp } from '@comfyorg/account-ui/billing'
import type {
  BillingResult,
  CapabilitiesSnapshot,
  TopupQuote,
  TopupQuoteResult
} from '@comfyorg/account-core/billing'
import { OPERATION_POLL_TIMING } from '@comfyorg/account-core/billing'

import type { CheckoutPage, CheckoutPageEvent } from '@/checkout/checkoutPage'
import {
  RESOLVING,
  UNREADABLE_LINK,
  awaitingServer,
  challengeToReopen,
  railAcceptsPay,
  reduceCheckoutPage
} from '@/checkout/checkoutPage'
import {
  outcomeFor,
  reconciledEvent,
  topupVerdictOf
} from '@/checkout/payVerdict'
import { useCheckoutExit } from '@/composables/useCheckoutExit'
import { awaitBillingWebStripeKey } from '@/config/stripeKey'
import { useBillingEntry } from '@/entry/billingEntry'
import { createDeferredStripeChallengePort } from '@/session/stripeChallengePort'

/** The contract bounds the amount; the server's quote applies its own limits. */
const MAX_AMOUNT_CENTS = 999_999_999

function capabilityStop(
  allowed: BillingResult<CapabilitiesSnapshot>
): CheckoutPageEvent | undefined {
  if (allowed.status === 'error')
    return { type: 'capabilitiesFailed', code: allowed.code }
  if (allowed.value.capabilities.can_top_up) return undefined
  return {
    type: 'refused',
    reason: allowed.value.denials.can_top_up ?? 'unspecified'
  }
}

/** A top-up charges the method on file, so capture needs no card form. */
function quoteEvent(quoted: TopupQuoteResult): CheckoutPageEvent {
  return quoted.status === 'ok'
    ? { type: 'quoted', reactivation: false, method: 'on_file' }
    : { type: 'unavailable', code: quoted.code }
}

/**
 * A top-up link is always for sale, so a top-up this tab already saw
 * succeed ends the revisit on Already completed instead of a second form.
 */
function revisited(page: CheckoutPage): boolean {
  return page.kind === 'resolving' && page.settled?.kind === 'topup'
}

/**
 * The full-page credit top-up: the same `CheckoutPage` states as the
 * subscription checkout, driven by the top-up command. Arrival reconciles
 * with whatever the workspace is already waiting on, reads `can_top_up`, and
 * quotes the link's amount; Pay charges the method on file through the SDK
 * top-up command, and the lifecycle's operation moves the page to its
 * ending. Every number on the page is the quote's or the operation's.
 */
export function useFullPageTopup() {
  const { entry, error: unreadableLink } = useBillingEntry()
  const { capabilities, lifecycle, topup } = useBillingClient<
    'capabilities' | 'lifecycle' | 'topup'
  >(undefined)

  const amountCents = entry.value?.amountCents
  const page = shallowRef<CheckoutPage>(
    unreadableLink.value === undefined && amountCents !== undefined
      ? RESOLVING
      : UNREADABLE_LINK
  )
  const quote = shallowRef<TopupQuote>()

  const submitting = computed(
    () => page.value.kind === 'capture' && page.value.attempt.kind === 'sent'
  )

  const challengePort = createDeferredStripeChallengePort(
    awaitBillingWebStripeKey
  )
  const purchase = useTopUp({
    openUrl: (url) => window.location.assign(url),
    navigationMode: 'redirect',
    challengePort,
    autoContinue: () => submitting.value,
    minAmountCents: 1,
    maxAmountCents: MAX_AMOUNT_CENTS,
    ...(amountCents === undefined ? {} : { initialAmountCents: amountCents })
  })

  function dispatch(event: CheckoutPageEvent) {
    const before = page.value
    page.value = reduceCheckoutPage(before, event)
    if (before.kind !== 'resolving' && page.value.kind === 'resolving')
      void readCapture()
  }

  let generation = 0
  let latest: Promise<void> = Promise.resolve()

  async function reconcileOnce(): Promise<void> {
    const mine = ++generation
    const recovered = await lifecycle.recover({ includeSettled: true })
    if (mine !== generation) return
    dispatch(reconciledEvent(recovered))
  }

  function reconcile(): Promise<void> {
    latest = reconcileOnce()
    return latest
  }

  /** Capture never renders before reconciliation has answered. */
  async function readCapture() {
    if (amountCents === undefined) return
    const [allowed, quoted] = await Promise.all([
      capabilities.read(),
      topup.quoteTopup({ amountCents })
    ])
    if (quoted.status === 'ok') quote.value = quoted.value
    const event = capabilityStop(allowed) ?? quoteEvent(quoted)
    await latest
    dispatch(revisited(page.value) ? { type: 'notAllowed' } : event)
  }

  if (page.value.kind === 'resolving') {
    void reconcile()
    void readCapture()
  }

  watch(purchase.operation, (operation) => {
    if (operation === undefined) return
    dispatch({ type: 'operationChanged', operation, ...outcomeFor(operation) })
    const watching =
      page.value.kind === 'waiting' || page.value.kind === 'unconfirmed'
    if (operation.phase === 'timed_out' && watching) void reconcile()
  })

  const recheck = useIntervalFn(
    () => void reconcile(),
    OPERATION_POLL_TIMING.parkedMs,
    { immediate: false }
  )
  watch(
    () => awaitingServer(page.value),
    (awaiting) => (awaiting ? recheck.resume() : recheck.pause())
  )

  const reopening = shallowRef(false)
  watch(
    () => challengeToReopen(page.value),
    async (clientSecret) => {
      reopening.value = clientSecret !== undefined
      if (clientSecret === undefined) return
      const leavesPage = await challengePort
        .leavesPage(clientSecret)
        .catch(() => true)
      if (challengeToReopen(page.value) !== clientSecret) return
      if (!leavesPage) purchase.continueVerification()
      reopening.value = false
    }
  )

  const moneyInFlight = computed(() => {
    const operation = purchase.operation.value
    return operation?.phase === 'pending'
  })

  const canPay = computed(
    () =>
      railAcceptsPay(page.value) &&
      quote.value !== undefined &&
      !moneyInFlight.value
  )

  let payGeneration = 0

  async function pay() {
    if (!canPay.value) return
    const mine = ++payGeneration
    dispatch({ type: 'paySubmitted' })
    const verdict = topupVerdictOf(await purchase.submit())
    if (mine !== payGeneration) return
    if (verdict.kind === 'settled') dispatch({ type: 'paySettled' })
    else if (verdict.kind === 'outcome') {
      if (verdict.outcome.kind === 'reconciling') {
        dispatch({ type: 'payRejectedAsPending' })
        await reconcile()
        return
      }
      purchase.reset()
      dispatch({ type: 'payFailed', outcome: verdict.outcome })
    }
  }

  const { returnLink, openedByScript, close } = useCheckoutExit(page)

  function retryLoad() {
    void reconcile()
    dispatch({ type: 'retried' })
  }

  return {
    page: shallowReadonly(page),
    quote: shallowReadonly(quote),
    canPay,
    returnLink,
    openedByScript,
    close,
    retryLoad,
    reconcile,
    pay,
    reopening: shallowReadonly(reopening),
    continueVerification: purchase.continueVerification
  }
}
