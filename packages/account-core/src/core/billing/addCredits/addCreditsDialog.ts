import type {
  AddCreditsAmount,
  AddCreditsAmountCheck,
  AddCreditsBounds
} from './addCreditsAmount'
import { checkAddCreditsAmount } from './addCreditsAmount'
import type { AddCreditsRefusal } from './addCreditsRefusal'

/**
 * The dialog's own workflow. `opening` remembers whether a tab was reserved
 * in the click, because without one the session is still created and offered
 * as a plain link.
 */
export type AddCreditsState =
  | {
      readonly step: 'amount'
      readonly amount: AddCreditsAmount
      readonly refusal?: AddCreditsRefusal
    }
  | {
      readonly step: 'opening'
      readonly amount: AddCreditsAmount
      readonly amountCents: number
      readonly origin: 'amount' | 'checkout_opened'
      readonly tabReserved: boolean
    }
  | {
      readonly step: 'checkout_opened'
      readonly amount: AddCreditsAmount
      readonly amountCents: number
      readonly refusal?: AddCreditsRefusal
    }
  | {
      readonly step: 'checkout_blocked'
      readonly amount: AddCreditsAmount
      readonly amountCents: number
      readonly checkoutUrl: string
    }
  | { readonly step: 'landed' }

export type AddCreditsEvent =
  | { readonly type: 'preset_picked'; readonly cents: number }
  | { readonly type: 'amount_typed'; readonly input: string }
  | {
      readonly type: 'checkout_requested'
      readonly amountCents: number
      readonly tabReserved: boolean
    }
  | { readonly type: 'checkout_created'; readonly checkoutUrl: string }
  | { readonly type: 'checkout_refused'; readonly refusal: AddCreditsRefusal }
  | { readonly type: 'checkout_abandoned' }
  | { readonly type: 'blocked_link_followed' }
  | { readonly type: 'payment_landed' }

export function startAddCredits(amount: AddCreditsAmount): AddCreditsState {
  return { step: 'amount', amount }
}

type EventOf<T extends AddCreditsEvent['type']> = Extract<
  AddCreditsEvent,
  { readonly type: T }
>

type Transition<T extends AddCreditsEvent['type']> = (
  state: AddCreditsState,
  event: EventOf<T>
) => AddCreditsState

type Opening = Extract<AddCreditsState, { readonly step: 'opening' }>

function backToOrigin(
  state: Opening,
  refusal: AddCreditsRefusal | undefined
): AddCreditsState {
  const withRefusal = refusal === undefined ? {} : { refusal }
  return state.origin === 'checkout_opened'
    ? {
        step: 'checkout_opened',
        amount: state.amount,
        amountCents: state.amountCents,
        ...withRefusal
      }
    : { step: 'amount', amount: state.amount, ...withRefusal }
}

const TRANSITIONS: { readonly [T in AddCreditsEvent['type']]: Transition<T> } =
  {
    preset_picked: (state, event) =>
      state.step === 'amount'
        ? { step: 'amount', amount: { kind: 'preset', cents: event.cents } }
        : state,
    amount_typed: (state, event) =>
      state.step === 'amount'
        ? { step: 'amount', amount: { kind: 'custom', input: event.input } }
        : state,
    checkout_requested: (state, event) =>
      state.step === 'amount' || state.step === 'checkout_opened'
        ? {
            step: 'opening',
            amount: state.amount,
            amountCents: event.amountCents,
            origin: state.step,
            tabReserved: event.tabReserved
          }
        : state,
    checkout_created: (state, event) => {
      if (state.step !== 'opening') return state
      const { amount, amountCents } = state
      return state.tabReserved
        ? { step: 'checkout_opened', amount, amountCents }
        : {
            step: 'checkout_blocked',
            amount,
            amountCents,
            checkoutUrl: event.checkoutUrl
          }
    },
    checkout_refused: (state, event) =>
      state.step === 'opening' ? backToOrigin(state, event.refusal) : state,
    checkout_abandoned: (state) =>
      state.step === 'opening' ? backToOrigin(state, undefined) : state,
    blocked_link_followed: (state) =>
      state.step === 'checkout_blocked'
        ? {
            step: 'checkout_opened',
            amount: state.amount,
            amountCents: state.amountCents
          }
        : state,
    payment_landed: (state) =>
      state.step === 'amount' || state.step === 'landed'
        ? state
        : { step: 'landed' }
  }

export function reduceAddCredits(
  state: AddCreditsState,
  event: AddCreditsEvent
): AddCreditsState {
  switch (event.type) {
    case 'preset_picked':
      return TRANSITIONS.preset_picked(state, event)
    case 'amount_typed':
      return TRANSITIONS.amount_typed(state, event)
    case 'checkout_requested':
      return TRANSITIONS.checkout_requested(state, event)
    case 'checkout_created':
      return TRANSITIONS.checkout_created(state, event)
    case 'checkout_refused':
      return TRANSITIONS.checkout_refused(state, event)
    case 'checkout_abandoned':
      return TRANSITIONS.checkout_abandoned(state, event)
    case 'blocked_link_followed':
      return TRANSITIONS.blocked_link_followed(state, event)
    case 'payment_landed':
      return TRANSITIONS.payment_landed(state, event)
  }
}

/** A top-up the server reports as still open when the dialog renders. */
export type AddCreditsPendingTopup =
  | { readonly kind: 'processing'; readonly amountCents?: number }
  | {
      readonly kind: 'needs_verification'
      readonly amountCents?: number
      readonly verifyUrl: string
    }
  | { readonly kind: 'not_verified'; readonly amountCents?: number }

/** The served facts the dialog renders as received. */
export interface AddCreditsFacts {
  readonly bounds: AddCreditsBounds
  /** Served `can_top_up`; false while the dialog is open shows a refusal and stops Continue. */
  readonly canTopUp: boolean
  readonly canTopUpRefusal?: AddCreditsRefusal
  readonly pendingTopup?: AddCreditsPendingTopup
}

export type AddCreditsNotice =
  | { readonly kind: 'refusal'; readonly refusal: AddCreditsRefusal }
  | AddCreditsPendingTopup

export interface AddCreditsAmountView {
  readonly step: 'amount' | 'opening'
  readonly amount: AddCreditsAmount
  readonly check: AddCreditsAmountCheck
  /** The amount the footer and the quote describe; undefined while none is valid. */
  readonly amountCents: number | undefined
  readonly notice: AddCreditsNotice | undefined
  readonly locked: boolean
  readonly canContinue: boolean
  readonly opening: boolean
}

const BLOCKING_REFUSALS: ReadonlySet<AddCreditsRefusal['kind']> = new Set([
  'rate_limited',
  'purchases_paused',
  'not_allowed'
])

function blocks(refusal: AddCreditsRefusal | undefined): boolean {
  return refusal !== undefined && BLOCKING_REFUSALS.has(refusal.kind)
}

/** What the amount step renders, from the dialog state and the served facts. */
export function viewAddCreditsAmount(
  state: Extract<AddCreditsState, { readonly step: 'amount' | 'opening' }>,
  facts: AddCreditsFacts
): AddCreditsAmountView {
  const check = checkAddCreditsAmount(state.amount, facts.bounds)
  const pending = facts.pendingTopup
  const blockedByPending =
    pending !== undefined && pending.kind !== 'processing'
  const refusal = facts.canTopUp
    ? state.step === 'amount'
      ? state.refusal
      : undefined
    : (facts.canTopUpRefusal ?? { kind: 'not_allowed' })
  const notice: AddCreditsNotice | undefined = blockedByPending
    ? pending
    : refusal
      ? { kind: 'refusal', refusal }
      : pending
  const opening = state.step === 'opening'
  const locked = opening || blockedByPending
  return {
    step: state.step,
    amount: state.amount,
    check,
    amountCents: blockedByPending
      ? pending.amountCents
      : check.status === 'valid'
        ? check.cents
        : undefined,
    notice,
    locked,
    opening,
    canContinue: !locked && check.status === 'valid' && !blocks(refusal)
  }
}
