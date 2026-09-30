import { tryOnScopeDispose, useIntervalFn } from '@vueuse/core'
import { computed, shallowReadonly, shallowRef, watch } from 'vue'

import {
  useBillingClient,
  useCheckout,
  usePaymentMethods,
  usePreviewSubscribe
} from '@comfyorg/account-ui/billing'
import type { StripePaymentPhase } from '@comfyorg/account-ui/billing/stripe'
import type {
  BillingOperationState,
  BillingResult,
  CapabilitiesSnapshot,
  SubscribeInput,
  SubscriptionPreview
} from '@comfyorg/account-core/billing'
import {
  OPERATION_POLL_TIMING,
  matchesServerCode
} from '@comfyorg/account-core/billing'
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
  UNREADABLE_LINK,
  challengeToReopen,
  isParked,
  needsConsent,
  railAcceptsPay,
  reduceCheckoutPage
} from '@/checkout/checkoutPage'
import { planCreditsSettingsUrl, pricingTableUrl } from '@/checkout/cloudLinks'
import { createOperationChannel } from '@/checkout/operationChannel'
import { promoEntryLive, promoRejectionOf } from '@/checkout/promoEntry'
import type { PayVerdict } from '@/checkout/payVerdict'
import { operationOutcomeOf, payVerdictOf } from '@/checkout/payVerdict'
import {
  buildSubscribeRequest,
  checkoutReturnUrl
} from '@/checkout/subscribeRequest'
import { acceptsPromoCode } from '@/checkout/summaryLedger'
import { useBilledWorkspace } from '@/composables/useBilledWorkspace'
import { useCheckoutPromo } from '@/composables/useCheckoutPromo'
import { BILLING_WEB_ENV } from '@/config/env'
import { awaitBillingWebStripeKey } from '@/config/stripeKey'
import { useBillingEntry } from '@/entry/billingEntry'
import { useBillingWebSession } from '@/session/billingWebSession'
import { createDeferredStripeChallengePort } from '@/session/stripeChallengePort'

/**
 * What Pay charges: a new method's token, a saved method, or the method on
 * file. `methodType` is the provider's type (`card`, `alipay`, …); any
 * non-card type finishes paying on its own site.
 */
export type PayChoice =
  | { readonly confirmationToken: string; readonly methodType: string }
  | { readonly savedMethodId: string; readonly methodType: string }
  | undefined

const CARD_METHOD_TYPE = 'card'

/** The method's type when it authenticates away from this page, else nothing. */
function redirectMethodOf(choice: PayChoice): string | undefined {
  if (choice === undefined || choice.methodType === CARD_METHOD_TYPE)
    return undefined
  return choice.methodType
}

type PlannedEntry = BillingEntry & { plan: string }

/** What the quote answers for a plan slug the catalog does not have. */
const UNKNOWN_PLAN_SERVER_CODE = 'INVALID_PLAN'

/** A capability read that ends the page before any quote: unreadable, or refused. */
function capabilityStop(
  allowed: BillingResult<CapabilitiesSnapshot>
): CheckoutPageEvent | undefined {
  if (allowed.status === 'error')
    return { type: 'capabilitiesFailed', code: allowed.code }
  if (allowed.value.capabilities.can_subscribe_self_serve) return undefined
  return {
    type: 'refused',
    reason: allowed.value.denials.can_subscribe_self_serve ?? 'unspecified'
  }
}

/**
 * A quote the page cannot capture: one the server refuses, or a team plan
 * named without its stop.
 */
function quotedStop(
  quoted: SubscriptionPreview,
  arrival: PlannedEntry
): CheckoutPageEvent | undefined {
  if (!quoted.allowed) return { type: 'notAllowed' }
  if (quoted.new_plan.tier === 'TEAM' && arrival.teamCreditStopId === undefined)
    return { type: 'planUnavailable', reason: 'team_stop_missing' }
  return undefined
}

/**
 * How a quote collects the money: a new subscription on a card form, which
 * arrives failed with no Stripe key to mount on, or a plan change on the
 * method on file, which needs no key.
 */
function railOf(
  quoted: SubscriptionPreview,
  saved: SavedArrival,
  stripeKey: string | undefined
) {
  if (quoted.transition_type !== 'new_subscription')
    return { method: 'on_file' } as const
  return {
    method: 'collect',
    saved,
    ...(stripeKey === undefined ? { element: 'failed' as const } : {})
  } as const
}

/**
 * The full-page checkout's effects around one `CheckoutPage` state: the
 * reconciliation with whatever operation the workspace is already waiting
 * on, the capabilities read, the quote, the saved methods and the Stripe key
 * on arrival, the payment element's readiness, the operation the lifecycle
 * follows, and the subscribe on Pay. Every change goes through
 * `reduceCheckoutPage`; the quote itself stays with `usePreviewSubscribe`.
 * The key is awaited because the payment form reads it only when it mounts.
 *
 * Reconciliation converges: every run reads the server afresh, and a run
 * that a later one overtook drops its answer, so a reload, a return from a
 * provider page, a restore from the back-forward cache and a sibling tab's
 * nudge all land on the same page for the same server state.
 *
 * Sibling tabs on this checkout hear when this page's own Pay starts an
 * operation and when it settles, and re-read the server for themselves. The
 * notice carries no state, and only an operation this page sent is announced,
 * so no tab ever re-broadcasts what it merely heard.
 */
export function useFullPageCheckout() {
  const { entry, error: unreadableLink } = useBillingEntry()
  const { session } = useBillingWebSession()
  const billedWorkspace = useBilledWorkspace()
  const { capabilities, lifecycle, plans, status } = useBillingClient<
    'capabilities' | 'lifecycle' | 'plans' | 'status'
  >(undefined)
  const { preview, quote } = usePreviewSubscribe()
  const saved = usePaymentMethods({ immediate: false })

  /** A link that names no plan has nothing to quote, so it is as unreadable as a malformed one. */
  const page = shallowRef<CheckoutPage>(
    unreadableLink.value === undefined && entry.value?.plan !== undefined
      ? RESOLVING
      : UNREADABLE_LINK
  )

  /** Busy from the Pay click until the attempt resolves, whatever the lifecycle's promise does. */
  const submitting = computed(
    () => page.value.kind === 'capture' && page.value.attempt.kind === 'sent'
  )

  const challengePort = createDeferredStripeChallengePort(
    awaitBillingWebStripeKey
  )
  /**
   * Only this page's own Pay continues on its own; money it is waiting on
   * reopens only a challenge that stays on this page (below), and anything
   * else waits for Complete verification.
   */
  const checkout = useCheckout({
    openUrl: (url) => window.location.assign(url),
    navigationMode: 'redirect',
    challengePort,
    autoContinue: () => submitting.value
  })

  /** A page sent back to resolving by the lifecycle reads its capture again. */
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

  /** Re-reads what the workspace is waiting on; the newest run's answer wins. */
  function reconcile(): Promise<void> {
    latest = reconcileOnce()
    return latest
  }

  /** Resolves once no reconciliation started before now is still unanswered. */
  async function reconciliationSettled(): Promise<void> {
    let awaited: Promise<void> | undefined
    while (awaited !== latest) {
      awaited = latest
      await awaited
    }
  }

  function quoteArrival(arrival: PlannedEntry, promotionCode?: string) {
    return quote({
      planSlug: arrival.plan,
      ...(arrival.teamCreditStopId === undefined
        ? {}
        : { teamCreditStopId: arrival.teamCreditStopId }),
      ...(promotionCode === undefined ? {} : { promotionCode })
    })
  }

  /** When the plan is set to end, for the notice's title; read only once a quote asks for consent. */
  const cancelAt = shallowRef<string>()

  async function readCancelAt() {
    const read = await status.read()
    cancelAt.value =
      read.status === 'ok' ? read.value.status.cancel_at : undefined
  }

  /** An operation parked on a card is what a Pay resubmits, so it is not money in flight. */
  const moneyInFlight = computed(() => {
    const operation = checkout.operation.value
    return operation?.phase === 'pending' && !isParked(operation)
  })

  const promoLive = computed(() =>
    promoEntryLive(page.value, checkout.submitting.value || moneyInFlight.value)
  )

  const promo = useCheckoutPromo({
    prefill: entry.value,
    live: () => promoLive.value,
    requote: async (promotionCode) => {
      const arrival = entry.value
      if (arrival?.plan === undefined)
        return { status: 'error', code: 'REQUEST_FAILED' }
      const quoted = await quoteArrival(
        { ...arrival, plan: arrival.plan },
        promotionCode
      )
      if (quoted.status === 'ok')
        dispatch({
          type: 'requoted',
          reactivation: consentAsked(asksReactivation(quoted.value)),
          priceUpdated: false
        })
      return quoted
    }
  })

  const asksReactivation = (quoted: SubscriptionPreview) =>
    quoted.requires_reactivation_confirmation === true

  function consentAsked(asked: boolean): boolean {
    if (asked) void readCancelAt()
    return asked
  }

  /**
   * A refusal for a change already scheduled names that change as the
   * server has it: the date from its status, the plan from its catalog.
   */
  async function withScheduledChange(
    stopped: CheckoutPageEvent
  ): Promise<CheckoutPageEvent> {
    if (
      stopped.type !== 'refused' ||
      stopped.reason !== 'subscription_change_in_progress'
    )
      return stopped
    const [read, catalog] = await Promise.all([status.read(), plans.read()])
    const change =
      read.status === 'ok' ? read.value.status.scheduled_change : undefined
    const listed =
      change && catalog.status === 'ok'
        ? catalog.value.data.plans.find(
            (plan) => plan.slug === change.plan_slug
          )
        : undefined
    if (!change || !listed) return stopped
    const { tier, duration } = listed
    return {
      ...stopped,
      scheduled: { plan: { tier, duration }, effectiveAt: change.effective_at }
    }
  }

  /** A capture read again after the page went back to resolving keeps the applied code, or says it lapsed. */
  async function captureEvent(
    arrival: PlannedEntry
  ): Promise<CheckoutPageEvent> {
    const [allowed, { requoted: quoted, expiredPromo }, methods, stripeKey] =
      await Promise.all([
        capabilities.read(),
        requoteWithPromo(arrival),
        saved.refresh(),
        awaitBillingWebStripeKey()
      ])
    if (expiredPromo !== undefined) promo.expire()
    const stopped = capabilityStop(allowed)
    if (stopped !== undefined) return withScheduledChange(stopped)
    if (quoted.status === 'error')
      return 'serverCode' in quoted &&
        matchesServerCode(quoted, UNKNOWN_PLAN_SERVER_CODE)
        ? { type: 'planUnavailable', reason: 'retired' }
        : { type: 'unavailable', code: quoted.code }
    const unquotable = quotedStop(quoted.value, arrival)
    if (unquotable !== undefined) return unquotable
    const facts = {
      reactivation: consentAsked(asksReactivation(quoted.value)),
      ...(expiredPromo === undefined ? {} : { expiredPromo })
    }
    return {
      type: 'quoted',
      ...railOf(quoted.value, arrivalOf(methods), stripeKey),
      ...facts
    }
  }

  /** Capture never renders before reconciliation has answered (rule 3). */
  async function readCapture() {
    const arrival = entry.value
    if (arrival?.plan === undefined) return
    const event = await captureEvent({ ...arrival, plan: arrival.plan })
    if (preview.value && !acceptsPromoCode(preview.value)) promo.withdraw()
    await reconciliationSettled()
    dispatch(event)
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

  if (page.value.kind === 'resolving') {
    void reconcile()
    void readCapture()
  }

  /** Set while Stripe says where a challenge this page means to re-open runs. */
  const reopening = shallowRef(false)

  /**
   * Money this page is waiting on reopens the bank's challenge on its own,
   * once per challenge, as long as Stripe runs it inside this page: a reload
   * mid-challenge picks it back up, and a customer back from a provider's
   * site is never sent straight back to it. A challenge replaced while Stripe
   * answers opens nothing: the page no longer shows it.
   */
  watch(
    () => challengeToReopen(page.value),
    async (clientSecret) => {
      reopening.value = clientSecret !== undefined
      if (clientSecret === undefined) return
      const leavesPage = await challengePort
        .leavesPage(clientSecret)
        .catch(() => true)
      if (challengeToReopen(page.value) !== clientSecret) return
      if (!leavesPage) checkout.continueVerification()
      reopening.value = false
    }
  )

  const scope = session.value
  const channel =
    scope === undefined
      ? undefined
      : createOperationChannel(scope.uid, scope.workspace.id)
  const unsubscribe = channel?.subscribe(() => void reconcile())
  tryOnScopeDispose(() => {
    unsubscribe?.()
    channel?.close()
  })

  const announced = new Set<string>()

  /** Tells sibling tabs about this page's own operation, once per step. */
  function announce(operation: BillingOperationState) {
    if (scope === undefined || channel === undefined) return
    const settled = page.value.kind === 'terminal'
    const notice = `${operation.id}:${settled ? 'settled' : 'started'}`
    if (announced.has(notice)) return
    announced.add(notice)
    channel.publish({
      workspaceId: scope.workspace.id,
      operationId: operation.id,
      kind: settled ? 'settled' : 'started'
    })
  }

  watch(checkout.operation, (operation) => {
    if (operation === undefined) return
    const own =
      page.value.kind === 'capture' && page.value.attempt.kind === 'sent'
    dispatch({
      type: 'operationChanged',
      operation,
      ...outcomeFor(operation)
    })
    if (own) announce(operation)
    if (operation.phase === 'timed_out' && watchingMoney()) void reconcile()
  })

  /**
   * A watch whose poll budget ran out re-reads the server, which follows the
   * operation afresh: these screens promise to update on their own, and a
   * bank debit can take hours to settle.
   */
  function watchingMoney() {
    const kind = page.value.kind
    return kind === 'waiting' || kind === 'unconfirmed'
  }

  /**
   * "We couldn't confirm your payment" promises to update on its own, but the
   * lifecycle stops polling an operation the server parked for a human. The
   * page re-reads it on the parked cadence until it settles either way.
   */
  const recheckUnconfirmed = useIntervalFn(
    () => void reconcile(),
    OPERATION_POLL_TIMING.parkedMs,
    { immediate: false }
  )
  watch(
    () => page.value.kind === 'unconfirmed',
    (unconfirmed) =>
      unconfirmed ? recheckUnconfirmed.resume() : recheckUnconfirmed.pause()
  )

  /** A returned payment names the plan the server now lists, never the fresh quote. */
  async function readSettledPlan() {
    const [read, catalog] = await Promise.all([status.read(), plans.read()])
    const slug = read.status === 'ok' ? read.value.status.plan_slug : undefined
    const listed =
      slug !== undefined && catalog.status === 'ok'
        ? catalog.value.data.plans.find((plan) => plan.slug === slug)
        : undefined
    if (!listed) return
    const { tier, duration, price_cents } = listed
    dispatch({
      type: 'settledPlanRead',
      plan: { tier, duration, price_cents }
    })
  }

  watch(
    () =>
      page.value.kind === 'terminal' && page.value.attribution === 'returned',
    (returned) => {
      if (returned) void readSettledPlan()
    }
  )

  function onPaymentPhase(phase: StripePaymentPhase) {
    if (phase.phase === 'payment_element_ready' && phase.element === 'payment')
      dispatch({ type: 'elementReady' })
    else if (phase.phase === 'payment_element_failed')
      dispatch({ type: 'elementFailed' })
  }

  /**
   * Money in flight keeps Pay locked, so a second click cannot charge twice.
   * A re-quote for a promo code holds Pay until the price settles.
   */
  const canPay = computed(
    () =>
      railAcceptsPay(page.value) &&
      preview.value?.allowed === true &&
      !moneyInFlight.value &&
      !promo.busy.value
  )

  /**
   * Back to the product, with a settled payment's outcome and reference, or
   * to the workspace's Plan & Credits settings when this family has no
   * destination for the link's target.
   */
  const returnLink = computed(() => {
    const workspace = billedWorkspace()
    const arrival = entry.value
    const current = page.value
    const host =
      arrival &&
      buildReturnUrl({
        target: arrival.returnTo,
        environment: BILLING_WEB_ENV,
        workspace,
        ...(current.kind === 'terminal'
          ? { result: 'success', reference: current.operation?.id }
          : {})
      })?.href
    return host ?? planCreditsSettingsUrl(workspace)
  })

  /** Only a tab a script opened can close itself; any other goes back to `returnLink`. */
  const openedByScript = Boolean(window.opener)

  function close() {
    if (openedByScript) window.close()
    else window.location.assign(returnLink.value)
  }

  /**
   * The live catalog, on the Team tab when the link asked for a team plan:
   * one the quote named without its stop, or a link that carries a stop.
   */
  const viewPlansLink = computed(() => {
    const current = page.value
    const asksTeam =
      entry.value?.teamCreditStopId !== undefined ||
      (current.kind === 'plan_unavailable' &&
        current.reason === 'team_stop_missing')
    return pricingTableUrl(asksTeam ? 'team' : 'default', billedWorkspace())
  })

  /** Try again re-runs the whole resolve in place: the re-read and the capture read. */
  function retryLoad() {
    void reconcile()
    dispatch({ type: 'retried' })
  }

  function requestFor(
    arrival: PlannedEntry,
    quoted: SubscriptionPreview,
    choice: PayChoice
  ): SubscribeInput {
    const current = page.value
    return buildSubscribeRequest({
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
      confirmReactivation:
        current.kind === 'capture' && current.reactivation === 'confirmed',
      returnUrl: checkoutReturnUrl(
        arrival,
        billedWorkspace(),
        window.location.origin
      )
    })
  }

  /** A code the server now refuses has lapsed since Apply, so the plan is priced without it. */
  async function requoteWithPromo(arrival: PlannedEntry) {
    const code = promo.appliedCode.value
    const withCode = await quoteArrival(arrival, code)
    if (
      code === undefined ||
      withCode.status === 'ok' ||
      promoRejectionOf(withCode) !== 'invalid'
    )
      return { requoted: withCode }
    return { requoted: await quoteArrival(arrival), expiredPromo: code }
  }

  /** A Pay the server refused for an operation already under way re-reads it, never a decline (rule 18). */
  async function settle(verdict: PayVerdict, arrival: PlannedEntry) {
    if (verdict.kind === 'settled') {
      dispatch({ type: 'paySettled' })
    } else if (verdict.kind === 'outcome') {
      if (verdict.outcome.kind === 'reconciling') {
        dispatch({ type: 'payRejectedAsPending' })
        await reconcile()
        return
      }
      checkout.reset()
      dispatch({ type: 'payFailed', outcome: verdict.outcome })
    } else {
      await requote(verdict.because, arrival)
    }
  }

  /** A refused quote is never paid again, so a failed re-quote leaves capture. */
  async function requote(
    because: Extract<PayVerdict, { kind: 'requote' }>['because'],
    arrival: BillingEntry & { plan: string }
  ) {
    const { requoted, expiredPromo } = await requoteWithPromo(arrival)
    if (requoted.status !== 'ok') {
      dispatch({ type: 'requoteFailed', code: requoted.code })
      return
    }
    if (expiredPromo !== undefined) promo.expire()
    dispatch({
      type: 'requoted',
      reactivation: consentAsked(
        because === 'reactivation_required' || asksReactivation(requoted.value)
      ),
      priceUpdated: because === 'quote_expired',
      ...(expiredPromo === undefined ? {} : { expiredPromo })
    })
  }

  /** Pay stays live over an unticked consent; the click marks it invalid and sends nothing. */
  function payWithoutConsent() {
    dispatch({ type: 'consentMissing' })
  }

  let payGeneration = 0

  /**
   * A code still typed in the field is priced first, and this click ends
   * there: the customer sees the new total before a second Pay charges it.
   *
   * A challenge the bank refused leaves the operation pending, so the
   * subscribe never resolves for that attempt; the page has already moved on
   * from the operation's own verdict, and a later Pay owns the form. Only
   * the newest Pay's result may settle it.
   */
  async function pay(choice: PayChoice) {
    const arrival = entry.value
    const quoted = preview.value
    if (arrival?.plan === undefined || !quoted || !canPay.value) return
    if (promo.unapplied.value) return promo.apply()
    if (needsConsent(page.value)) return payWithoutConsent()
    const planned = { ...arrival, plan: arrival.plan }
    const mine = ++payGeneration
    const redirectMethod = redirectMethodOf(choice)
    dispatch({
      type: 'paySubmitted',
      ...(redirectMethod === undefined ? {} : { redirectMethod })
    })
    const result = await checkout.subscribe(requestFor(planned, quoted, choice))
    if (mine !== payGeneration) return
    await settle(payVerdictOf(result), planned)
  }

  return {
    page: shallowReadonly(page),
    preview,
    canPay,
    submitting,
    returnLink,
    viewPlansLink,
    openedByScript,
    close,
    retryLoad,
    onPaymentPhase,
    savedMethods: saved.methods,
    reconcile,
    retryElement: () => dispatch({ type: 'elementRetried' }),
    retrySaved: () => void retrySaved(),
    retryColumn,
    selectTab: (tab: PaymentTab) => dispatch({ type: 'tabSelected', tab }),
    confirmReactivation: (confirmed: boolean) =>
      dispatch({ type: 'reactivationConfirmed', confirmed }),
    payWithoutConsent,
    cancelAt: shallowReadonly(cancelAt),
    promo,
    promoLive,
    pay,
    reopening: shallowReadonly(reopening),
    continueVerification: checkout.continueVerification
  }
}

function outcomeFor(operation: BillingOperationState) {
  const outcome = operationOutcomeOf(operation)
  return outcome === undefined ? {} : { outcome }
}

/**
 * A recovery the lifecycle refused is an unknown, not "nothing pending": in
 * resolving it ends on a screen that claims nothing about money, and
 * anywhere else the page keeps what it has rather than opening a form over
 * money it cannot see.
 */
function reconciledEvent(
  recovered: BillingResult<BillingOperationState | undefined>
): CheckoutPageEvent {
  if (recovered.status === 'error')
    return { type: 'recheckFailed', code: recovered.code }
  const operation = recovered.value
  return {
    type: 'reconciled',
    operation,
    ...(operation === undefined ? {} : outcomeFor(operation))
  }
}
