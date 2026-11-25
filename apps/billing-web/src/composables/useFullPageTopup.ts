import { useIntervalFn } from '@vueuse/core'
import {
  computed,
  onScopeDispose,
  shallowReadonly,
  shallowRef,
  watch
} from 'vue'

import { useBillingClient, useTopUp } from '@comfyorg/account-ui/billing'
import type { StripePaymentPhase } from '@comfyorg/account-ui/billing/stripe'
import type {
  BillingOperationState,
  BillingRecoverOptions,
  BillingResult,
  CapabilitiesSnapshot,
  InteractiveTopupPayment,
  SavedPaymentMethod,
  TopupQuote,
  TopupQuoteResult,
  TopupResult
} from '@comfyorg/account-core/billing'
import { OPERATION_POLL_TIMING } from '@comfyorg/account-core/billing'
import type { EntryAutoTopUp } from '@comfyorg/billing-contract'

import type {
  CheckoutPage,
  CheckoutPageEvent,
  PaymentTab,
  SavedArrival
} from '@/checkout/checkoutPage'
import {
  INVALID_AMOUNT_LINK,
  RESOLVING,
  UNREADABLE_LINK,
  awaitingServer,
  challengeToReopen,
  railAcceptsPay,
  reduceCheckoutPage
} from '@/checkout/checkoutPage'
import type { PayVerdict } from '@/checkout/payVerdict'
import {
  outcomeFor,
  reconciledEvent,
  refusalVerdict,
  topupVerdictOf
} from '@/checkout/payVerdict'
import { platformBillingUrl } from '@/checkout/platformLinks'
import type { PurchaseRecovery } from '@/checkout/topupPurchase'
import { purchaseRecovery } from '@/checkout/topupPurchase'
import {
  TOPUP_RETURN_PATH,
  autoTopUpConsentOf,
  interactivePaymentOf,
  interactiveVerdictOf,
  isSamePayment,
  settlesAttempt,
  topupAutoTopUpOf,
  topupReturnUrl
} from '@/checkout/topupRequest'
import { useBilledWorkspace } from '@/composables/useBilledWorkspace'
import { useCheckoutExit } from '@/composables/useCheckoutExit'
import type { PayChoice } from '@/composables/useFullPageCheckout'
import { awaitInPageTopup, awaitTopupHostedMethods } from '@/config/checkoutUi'
import { awaitBillingWebStripeKey } from '@/config/stripeKey'
import { useBillingEntry } from '@/entry/billingEntry'
import { useAutoTopUpSettings } from '@/session/autoTopUpSettings'
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

const CARD_METHOD_TYPE = 'card'
const CARD_REQUIRED = 'CARD_REQUIRED'
const PURCHASE_NOT_PAYABLE_HERE = 'PURCHASE_NOT_PAYABLE_HERE'

/** A purchase is paid only by its own pay-once attempts, so a page bound to one never falls back to an unbound checkout. */
function refusesUnboundPay(
  purchaseBound: boolean,
  paysOnce: boolean,
  goesHosted: boolean
): boolean {
  return purchaseBound && (!paysOnce || goesHosted)
}

type RecoveredOperation = BillingResult<BillingOperationState | undefined>

function eligibleCards(
  methods: readonly SavedPaymentMethod[]
): readonly SavedPaymentMethod[] {
  return methods.filter((method) => method.type === CARD_METHOD_TYPE)
}

interface HeldAttempt {
  readonly payment: InteractiveTopupPayment
  readonly idempotencyKey: string
}

function failedAttempt(recovered: RecoveredOperation): boolean {
  return recovered.status === 'ok' && recovered.value?.phase === 'failed'
}

function awaitedOperationOf(
  current: CheckoutPage
): Pick<BillingRecoverOptions, 'operation'> {
  return current.kind === 'terminal' && current.operation !== undefined
    ? {
        operation: { id: current.operation.id, kind: current.operation.kind }
      }
    : {}
}

/**
 * A top-up link is always for sale, so a top-up this tab already saw
 * succeed ends the revisit on Already completed instead of a second form.
 */
function revisited(page: CheckoutPage): boolean {
  return page.kind === 'resolving' && page.settled?.kind === 'topup'
}

/**
 * The full-page credit top-up. Where `awaitInPageTopup` allows and the quote has a payment
 * configuration it pays once with a saved or new card, carrying any auto top-up; otherwise the method on file.
 */
export function useFullPageTopup() {
  const { entry, error: unreadableLink } = useBillingEntry()
  const arrival = entry.value
  const { capabilities, lifecycle, paymentMethods, topup } = useBillingClient<
    'capabilities' | 'lifecycle' | 'paymentMethods' | 'topup'
  >(undefined)

  /** This page's latest successful read only: empty while reading, and after a failure. */
  const savedMethods = shallowRef<readonly SavedPaymentMethod[]>([])
  const savedMethodsRead = shallowRef(false)
  let savedGeneration = 0

  const amountCents = entry.value?.amountCents
  const autoTopUp = entry.value?.autoTopUp
  const purchaseId = entry.value?.purchaseId
  const page = shallowRef<CheckoutPage>(arrivalPage())

  const autoTopUpCeilingCents = shallowRef<number>()
  if (autoTopUp !== undefined && autoTopUp.monthlyBudgetCents === undefined)
    void useAutoTopUpSettings()
      .read()
      .then((read) => {
        if (read.status === 'ok')
          autoTopUpCeilingCents.value =
            read.value.settings.max_monthly_budget_cents
      })
  const autoTopUpConsent = computed(() =>
    autoTopUp === undefined
      ? undefined
      : autoTopUpConsentOf(
          autoTopUp,
          autoTopUpCeilingCents.value,
          savedMethodsRead.value ? savedMethods.value : undefined
        )
  )

  function arrivalPage(): CheckoutPage {
    if (unreadableLink.value === 'INVALID_AMOUNT') return INVALID_AMOUNT_LINK
    if (unreadableLink.value !== undefined) return UNREADABLE_LINK
    return amountCents === undefined ? INVALID_AMOUNT_LINK : RESOLVING
  }
  const quote = shallowRef<TopupQuote>()
  const inPageTopup = awaitInPageTopup()
  const interactiveAllowed = shallowRef(false)
  const hostedMethodsAllowed = shallowRef(false)
  void awaitTopupHostedMethods().then((allowed) => {
    hostedMethodsAllowed.value = allowed
  })
  const paysOnce = computed(
    () =>
      interactiveAllowed.value &&
      quote.value?.paymentMethodConfigurationId !== undefined
  )
  const autoTopUpPaysHosted = computed(
    () => autoTopUp !== undefined && !paysOnce.value
  )
  const autoTopUpPayGoesHosted = computed(
    () => autoTopUpPaysHosted.value || !savedMethodsRead.value
  )
  const offeredMethods = computed(() =>
    paysOnce.value ? eligibleCards(savedMethods.value) : savedMethods.value
  )

  const submitting = computed(
    () => page.value.kind === 'capture' && page.value.attempt.kind === 'sent'
  )

  /**
   * The lifecycle runs the bank's check in this page only when it already
   * holds this origin's Stripe key; a Pay started before then goes to the
   * hosted invoice, which never returns here.
   */
  const stripeKeyRead = awaitBillingWebStripeKey()
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

  let held: HeldAttempt | undefined

  function dispatch(event: CheckoutPageEvent) {
    const before = page.value
    page.value = reduceCheckoutPage(before, event)
    if (before.kind !== 'resolving' && page.value.kind === 'resolving')
      void readCapture()
  }

  let generation = 0
  let latest: Promise<void> = Promise.resolve()

  async function recoveryOf(): Promise<PurchaseRecovery> {
    if (purchaseId === undefined)
      return { kind: 'follow', options: awaitedOperationOf(page.value) }
    return purchaseRecovery(await topup.readTopupPurchase(purchaseId))
  }

  function endPurchase(code: string) {
    if (page.value.kind === 'resolving')
      return dispatch({ type: 'notAllowed', server: { code } })
    dispatch({ type: 'reconciled', operation: undefined, follows: 'topup' })
    dispatch({ type: 'payFailed', outcome: { kind: 'processing_error', code } })
  }

  async function reconcileOnce(): Promise<RecoveredOperation | undefined> {
    const mine = ++generation
    const recovery = await recoveryOf()
    if (mine !== generation) return undefined
    if (recovery.kind === 'ended') {
      endPurchase(recovery.code)
      return undefined
    }
    if (recovery.kind === 'unreadable') {
      dispatch(recovery.event)
      return undefined
    }
    const recovered = await lifecycle.recover({
      includeSettled: true,
      ...recovery.options
    })
    if (mine !== generation) return undefined
    if (purchaseId !== undefined && failedAttempt(recovered)) held = undefined
    dispatch(reconciledEvent(recovered, 'topup'))
    return recovered
  }

  function reconcile(): Promise<RecoveredOperation | undefined> {
    const run = reconcileOnce()
    latest = run.then(() => undefined)
    return run
  }

  async function readSaved(): Promise<SavedArrival> {
    const mine = ++savedGeneration
    savedMethods.value = []
    savedMethodsRead.value = false
    const read = await paymentMethods.read()
    if (read.status !== 'ok') return 'failed'
    if (mine === savedGeneration) {
      savedMethods.value = read.value.methods
      savedMethodsRead.value = true
    }
    return eligibleCards(read.value.methods).length
  }

  async function quoteEvent(
    quoted: TopupQuoteResult,
    saved: Promise<SavedArrival>
  ): Promise<CheckoutPageEvent> {
    if (quoted.status !== 'ok')
      return { type: 'unavailable', code: quoted.code }
    if (!paysOnce.value && purchaseId !== undefined)
      return { type: 'notAllowed', server: { code: PURCHASE_NOT_PAYABLE_HERE } }
    if (!paysOnce.value)
      return { type: 'quoted', reactivation: false, method: 'on_file' }
    const [cards, stripeKey] = await Promise.all([saved, stripeKeyRead])
    return {
      type: 'quoted',
      reactivation: false,
      method: 'collect',
      saved: cards,
      ...(stripeKey === undefined ? { element: 'failed' as const } : {})
    }
  }

  async function readCapture() {
    if (amountCents === undefined) return
    const saved = readSaved()
    const [allowed, quoted, inPage] = await Promise.all([
      capabilities.read(),
      topup.quoteTopup({ amountCents }),
      inPageTopup
    ])
    interactiveAllowed.value = inPage
    if (quoted.status === 'ok') quote.value = quoted.value
    const event = capabilityStop(allowed) ?? (await quoteEvent(quoted, saved))
    await latest
    dispatch(revisited(page.value) ? { type: 'notAllowed' } : event)
  }

  async function retrySaved() {
    dispatch({ type: 'savedRetried' })
    const cards = await readSaved()
    dispatch(
      cards === 'failed'
        ? { type: 'savedFailed' }
        : { type: 'savedLoaded', count: cards }
    )
  }

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

  function onPaymentPhase(phase: StripePaymentPhase) {
    if (phase.phase === 'payment_element_ready' && phase.element === 'payment')
      dispatch({ type: 'elementReady' })
    else if (phase.phase === 'payment_element_failed')
      dispatch({ type: 'elementFailed' })
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
  onScopeDispose(() => payGeneration++)
  const billedWorkspace = useBilledWorkspace()

  function attemptFor(choice: NonNullable<PayChoice>): HeldAttempt | undefined {
    const returnUrl =
      arrival &&
      topupReturnUrl(arrival, billedWorkspace(), window.location.origin)
    const payment = interactivePaymentOf(choice, returnUrl)
    if (held !== undefined && isSamePayment(held.payment, payment)) return held
    if (payment === undefined) return undefined
    held = { payment, idempotencyKey: crypto.randomUUID() }
    return held
  }

  async function send(
    attempt: HeldAttempt,
    amount: number
  ): Promise<TopupResult> {
    const result = await topup.createInteractiveTopup({
      amountCents: amount,
      payment: attempt.payment,
      idempotencyKey: attempt.idempotencyKey,
      ...(purchaseId === undefined ? {} : { purchaseId }),
      ...(autoTopUp === undefined
        ? {}
        : { autoTopUp: topupAutoTopUpOf(autoTopUp) })
    })
    if (held === attempt && settlesAttempt(result)) held = undefined
    return result
  }

  function sendFor(
    choice: PayChoice,
    amount: number
  ): (() => Promise<TopupResult>) | typeof CARD_REQUIRED | undefined {
    if (!paysOnce.value) return () => purchase.submit()
    if (choice === undefined) return undefined
    const attempt = attemptFor(choice)
    if (attempt === undefined) return CARD_REQUIRED
    return () => send(attempt, amount)
  }

  async function follow(verdict: PayVerdict) {
    if (verdict.kind === 'settled') return dispatch({ type: 'paySettled' })
    if (verdict.kind !== 'outcome') return
    const { outcome } = verdict
    if (outcome.kind === 'reconciling') {
      dispatch({
        type: 'payRejectedAsPending',
        ...(outcome.because === undefined ? {} : { because: outcome.because })
      })
      return reconcile()
    }
    if (!paysOnce.value) purchase.reset()
    dispatch({ type: 'payFailed', outcome })
  }

  async function requestHostedCheckout(
    mine: number,
    amount: number,
    choice?: EntryAutoTopUp
  ) {
    const result = await topup.createHostedTopupCheckout({
      amountCents: amount,
      returnUrl: new URL(TOPUP_RETURN_PATH, window.location.origin).href,
      ...(choice === undefined ? {} : { autoTopUp: topupAutoTopUpOf(choice) })
    })
    if (mine !== payGeneration) return
    if (result.status === 'ok') return window.location.assign(result.url)
    await follow(refusalVerdict(result))
  }

  function payOnHostedCheckout(amount: number, choice: EntryAutoTopUp) {
    const mine = ++payGeneration
    dispatch({ type: 'paySubmitted' })
    return requestHostedCheckout(mine, amount, choice)
  }

  function refusePay(code: string) {
    dispatch({ type: 'payFailed', outcome: { kind: 'processing_error', code } })
  }

  async function payDirect(choice: PayChoice, amount: number) {
    const run = sendFor(choice, amount)
    if (run === undefined) return
    if (run === CARD_REQUIRED) return refusePay(CARD_REQUIRED)
    const mine = ++payGeneration
    dispatch({ type: 'paySubmitted' })
    await stripeKeyRead
    const result = await run()
    const verdict = paysOnce.value
      ? interactiveVerdictOf(result)
      : topupVerdictOf(result)
    if (mine === payGeneration) await follow(verdict)
  }

  async function pay(choice: PayChoice) {
    if (!canPay.value || amountCents === undefined) return
    const hosted = autoTopUpPayGoesHosted.value ? autoTopUp : undefined
    if (
      refusesUnboundPay(
        purchaseId !== undefined,
        paysOnce.value,
        hosted !== undefined
      )
    )
      return refusePay(PURCHASE_NOT_PAYABLE_HERE)
    if (hosted !== undefined) return payOnHostedCheckout(amountCents, hosted)
    return payDirect(choice, amountCents)
  }

  const offersHostedMethods = computed(
    () =>
      hostedMethodsAllowed.value && paysOnce.value && autoTopUp === undefined
  )

  const canPayHosted = computed(() => {
    const current = page.value
    return (
      current.kind === 'capture' &&
      current.attempt.kind !== 'sent' &&
      current.outcome?.kind !== 'reconciling' &&
      quote.value !== undefined &&
      !moneyInFlight.value
    )
  })

  async function purchaseStillOpen(): Promise<boolean> {
    if (purchaseId === undefined) return true
    const read = await topup.readTopupPurchase(purchaseId)
    return read.status === 'ok' && read.value.status === 'open'
  }

  async function payWithHostedMethods() {
    if (!canPayHosted.value || !offersHostedMethods.value) return
    if (amountCents === undefined) return
    const mine = ++payGeneration
    dispatch({ type: 'paySubmitted' })
    const open = await purchaseStillOpen()
    if (mine !== payGeneration) return
    if (open) return requestHostedCheckout(mine, amountCents)
    dispatch({ type: 'payRejectedAsPending' })
    return reconcile()
  }

  const { returnLink, openedByScript, close } = useCheckoutExit(page)
  const settingsLink = computed(() => platformBillingUrl(billedWorkspace()))

  function retryLoad() {
    void reconcile()
    dispatch({ type: 'retried' })
  }

  return {
    page: shallowReadonly(page),
    quote: shallowReadonly(quote),
    savedMethods: offeredMethods,
    paysOnce,
    autoTopUpConsent,
    autoTopUpPaysHosted,
    onPaymentPhase,
    retryElement: () => dispatch({ type: 'elementRetried' }),
    retrySaved: () => void retrySaved(),
    retryColumn,
    selectTab: (tab: PaymentTab) => dispatch({ type: 'tabSelected', tab }),
    canPay,
    returnLink,
    settingsLink,
    openedByScript,
    close,
    retryLoad,
    reconcile,
    pay,
    offersHostedMethods,
    canPayHosted,
    payWithHostedMethods,
    reopening: shallowReadonly(reopening),
    continueVerification: purchase.continueVerification
  }
}
