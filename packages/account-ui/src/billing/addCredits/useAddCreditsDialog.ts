import { computed, onScopeDispose, shallowRef, toValue, watch } from 'vue'
import type { MaybeRefOrGetter } from 'vue'

import type {
  AddCreditsAmount,
  AddCreditsEvent,
  AddCreditsFacts,
  AddCreditsRefusal,
  AddCreditsState,
  AutoTopUpActivation,
  AutoTopUpActivationOutcome,
  TopupCommand
} from '@comfyorg/account-core/billing'
import {
  addCreditsRefusalFor,
  reduceAddCredits,
  startAddCredits,
  viewAddCreditsAmount
} from '@comfyorg/account-core/billing'

import type { AddCreditsAutoTopUpRequest } from './useAddCreditsAutoTopUp'

export type AddCreditsQuoteResult =
  | { readonly status: 'ok'; readonly credits: number }
  | { readonly status: 'error' }

export type AddCreditsCheckoutResult =
  | { readonly status: 'ok'; readonly url: string }
  | { readonly status: 'error'; readonly refusal: AddCreditsRefusal }

/** A tab opened inside the click, so a pop-up blocker lets it through. */
export interface AddCreditsCheckoutTab {
  readonly navigate: (url: string) => void
  readonly close: () => void
}

/** Everything the dialog reaches outside itself for; the host owns each one. */
export interface AddCreditsPorts {
  readonly quote: (
    amountCents: number,
    signal: AbortSignal
  ) => Promise<AddCreditsQuoteResult>
  /** `autoTopUp` turns auto top-up on once this purchase is paid. */
  readonly createCheckout: (
    amountCents: number,
    signal: AbortSignal,
    autoTopUp?: AutoTopUpActivation
  ) => Promise<AddCreditsCheckoutResult>
  readonly reserveTab: () => AddCreditsCheckoutTab | null
  /** Calls `landed` once the server reports the top-up went through, with the activation outcome when one was requested; returns its stop. */
  readonly watchPayment: (
    landed: (activation?: AutoTopUpActivationOutcome) => void
  ) => () => void
  /** After a top-up lands, Platform's Turn on auto top-up link when the served facts offer it, else null. */
  readonly autoTopUpSetupUrl?: () => Promise<string | null>
}

export type AddCreditsQuote =
  | { readonly status: 'loading' }
  | { readonly status: 'ok'; readonly credits: number }
  | { readonly status: 'unavailable' }

export interface AddCreditsDialogOptions {
  readonly ports: AddCreditsPorts
  readonly facts: MaybeRefOrGetter<AddCreditsFacts>
  readonly initialAmount: AddCreditsAmount
  readonly autoTopUp?: MaybeRefOrGetter<AddCreditsAutoTopUpRequest>
  readonly onLanded?: () => void
}

/** Quote and checkout session from a billing client; the host still supplies the tab and the payment watch. */
export function addCreditsClientPorts(
  client: {
    readonly topup: Pick<
      TopupCommand,
      'quoteTopup' | 'createHostedTopupCheckout'
    >
  },
  returnUrl: () => string
): Pick<AddCreditsPorts, 'quote' | 'createCheckout'> {
  return {
    async quote(amountCents, signal) {
      const quoted = await client.topup.quoteTopup({ amountCents, signal })
      return quoted.status === 'ok'
        ? { status: 'ok', credits: quoted.value.credits }
        : { status: 'error' }
    },
    async createCheckout(amountCents, signal) {
      const session = await client.topup.createHostedTopupCheckout({
        amountCents,
        returnUrl: returnUrl(),
        signal
      })
      return session.status === 'ok'
        ? { status: 'ok', url: session.url }
        : { status: 'error', refusal: addCreditsRefusalFor(session) }
    }
  }
}

/** `window.open` inside the click; null when the browser blocks it. */
export function reserveBrowserTab(): AddCreditsCheckoutTab | null {
  const opened = window.open('', '_blank')
  if (!opened) return null
  opened.opener = null
  return {
    navigate: (url) => opened.location.replace(url),
    close: () => opened.close()
  }
}

function landedEvent(
  setupUrl: string | null,
  activation: AutoTopUpActivationOutcome | undefined
): AddCreditsEvent {
  return {
    type: 'payment_landed',
    ...(setupUrl === null ? {} : { autoTopUpSetupUrl: setupUrl }),
    ...(activation === undefined ? {} : { activation })
  }
}

export function useAddCreditsDialog(options: AddCreditsDialogOptions) {
  const { ports } = options
  const state = shallowRef<AddCreditsState>(
    startAddCredits(options.initialAmount)
  )
  const dispatch = (event: AddCreditsEvent) => {
    state.value = reduceAddCredits(state.value, event)
  }

  const autoTopUpRequest = (): AddCreditsAutoTopUpRequest =>
    toValue(options.autoTopUp) ?? { kind: 'not_offered' }

  const pickedView = computed(() =>
    state.value.step === 'amount' || state.value.step === 'opening'
      ? viewAddCreditsAmount(state.value, toValue(options.facts))
      : undefined
  )

  const amountView = computed(() => {
    const view = pickedView.value
    return view && autoTopUpRequest().kind === 'invalid'
      ? { ...view, canContinue: false }
      : view
  })

  const quotedCents = computed(() =>
    amountView.value
      ? amountView.value.amountCents
      : 'amountCents' in state.value
        ? state.value.amountCents
        : undefined
  )

  const quoteRead = shallowRef<{
    readonly cents: number
    readonly quote: AddCreditsQuote
  }>()
  const quote = computed<AddCreditsQuote | undefined>(() => {
    const cents = quotedCents.value
    if (cents === undefined) return undefined
    return quoteRead.value?.cents === cents
      ? quoteRead.value.quote
      : { status: 'loading' }
  })

  let quoteScope: AbortController | undefined
  watch(
    quotedCents,
    async (cents) => {
      quoteScope?.abort()
      if (cents === undefined) return
      const scope = new AbortController()
      quoteScope = scope
      const result = await ports
        .quote(cents, scope.signal)
        .catch((): AddCreditsQuoteResult => ({ status: 'error' }))
      if (scope.signal.aborted) return
      quoteRead.value = {
        cents,
        quote:
          result.status === 'ok'
            ? { status: 'ok', credits: result.credits }
            : { status: 'unavailable' }
      }
    },
    { immediate: true }
  )

  let checkoutScope: AbortController | undefined
  let stopWatch: (() => void) | undefined
  let disposed = false
  let offeredWithPurchase = false

  function armPaymentWatch() {
    if (stopWatch) return
    stopWatch = ports.watchPayment((activation) => {
      stopWatch?.()
      void land(activation)
    })
  }

  async function setupUrl(): Promise<string | null> {
    return ports.autoTopUpSetupUrl
      ? ports.autoTopUpSetupUrl().catch(() => null)
      : null
  }

  function setupUrlAfterPaying(
    activation: AutoTopUpActivationOutcome | undefined
  ): Promise<string | null> {
    const asks = activation?.status === 'failed' || !offeredWithPurchase
    return asks ? setupUrl() : Promise.resolve(null)
  }

  async function land(activation?: AutoTopUpActivationOutcome) {
    const url =
      activation?.status === 'on' ? null : await setupUrlAfterPaying(activation)
    if (disposed) return
    dispatch(landedEvent(url, activation))
    if (state.value.step === 'landed') options.onLanded?.()
  }

  async function openCheckout(amountCents: number) {
    const request = autoTopUpRequest()
    offeredWithPurchase = request.kind !== 'not_offered'
    const tab = ports.reserveTab()
    dispatch({
      type: 'checkout_requested',
      amountCents,
      tabReserved: tab !== null
    })
    const scope = new AbortController()
    checkoutScope = scope
    const session = await ports
      .createCheckout(
        amountCents,
        scope.signal,
        request.kind === 'checked' ? request.activation : undefined
      )
      .catch((): AddCreditsCheckoutResult => ({
        status: 'error',
        refusal: { kind: 'checkout_failed' }
      }))
    if (scope.signal.aborted) {
      tab?.close()
      dispatch({ type: 'checkout_abandoned' })
      return
    }
    if (session.status === 'error') {
      tab?.close()
      dispatch({ type: 'checkout_refused', refusal: session.refusal })
      return
    }
    tab?.navigate(session.url)
    dispatch({ type: 'checkout_created', checkoutUrl: session.url })
    armPaymentWatch()
  }

  function continueToCheckout() {
    const view = amountView.value
    if (!view?.canContinue || view.amountCents === undefined) return
    return openCheckout(view.amountCents)
  }

  function reopenCheckout() {
    const current = state.value
    if (current.step !== 'checkout_opened' || !toValue(options.facts).canTopUp)
      return
    return openCheckout(current.amountCents)
  }

  onScopeDispose(() => {
    disposed = true
    quoteScope?.abort()
    checkoutScope?.abort()
    stopWatch?.()
  })

  return {
    state,
    amountView,
    pickedCents: computed(() => pickedView.value?.amountCents),
    quote,
    pickPreset: (cents: number) => dispatch({ type: 'preset_picked', cents }),
    typeAmount: (input: string) => dispatch({ type: 'amount_typed', input }),
    continueToCheckout,
    reopenCheckout,
    followBlockedLink: () => dispatch({ type: 'blocked_link_followed' })
  }
}
