import type { PreviewSubscribeResult } from '@comfyorg/account-core/billing'
import { matchesServerCode } from '@comfyorg/account-core/billing'

import type { CheckoutPage } from '@/checkout/checkoutPage'
import { isLocked } from '@/checkout/checkoutPage'

/**
 * Why Apply left the field open. `invalid` is the server refusing the code;
 * `unchecked` is a quote that failed for any other reason, so the code itself
 * was never judged.
 */
export type PromoRejection = 'invalid' | 'unchecked'

/**
 * The customer's one promo code, from the collapsed "Add promo code" control
 * to the chip. `applying` and `removing` are re-quotes in flight; `applied`
 * holds the code the current quote was priced with.
 */
export type PromoEntry =
  | { readonly kind: 'idle' }
  | { readonly kind: 'editing'; readonly draft: string }
  | { readonly kind: 'applying'; readonly draft: string }
  | {
      readonly kind: 'rejected'
      readonly draft: string
      readonly reason: PromoRejection
    }
  | { readonly kind: 'applied'; readonly code: string }
  | { readonly kind: 'removing'; readonly code: string }

export type PromoEntryEvent =
  | { readonly type: 'opened' }
  | { readonly type: 'edited'; readonly draft: string }
  | { readonly type: 'dismissed' }
  | { readonly type: 'applyRequested' }
  | { readonly type: 'applyAccepted'; readonly code: string }
  | { readonly type: 'applyRejected'; readonly reason: PromoRejection }
  | { readonly type: 'removeRequested' }
  | { readonly type: 'removeSettled' }
  | { readonly type: 'removeFailed' }
  /** Pay found the applied code lapsed; the page re-quoted without it. */
  | { readonly type: 'expired' }

const IDLE: PromoEntry = { kind: 'idle' }

/** A code carried in on the entry URL opens the field with it typed, never applied. */
export function initialPromoEntry(prefill: string | undefined): PromoEntry {
  return prefill === undefined ? IDLE : { kind: 'editing', draft: prefill }
}

type Kind = PromoEntry['kind']
type EntryOf<K extends Kind> = Extract<PromoEntry, { kind: K }>

/** The field is open and holds what the customer typed. */
const TYPING = ['editing', 'rejected'] as const

function isIn<K extends Kind>(
  entry: PromoEntry,
  kinds: readonly K[]
): entry is EntryOf<K> {
  return kinds.some((kind) => kind === entry.kind)
}

/** Moves only from the named states; `next` may decline by returning undefined. */
function from<K extends Kind>(
  entry: PromoEntry,
  kinds: readonly K[],
  next: (current: EntryOf<K>) => PromoEntry | undefined
): PromoEntry {
  return isIn(entry, kinds) ? (next(entry) ?? entry) : entry
}

/** An event that means nothing in the current state returns it untouched. */
export function reducePromoEntry(
  entry: PromoEntry,
  event: PromoEntryEvent
): PromoEntry {
  switch (event.type) {
    case 'opened':
      return from(entry, ['idle'], () => ({ kind: 'editing', draft: '' }))
    case 'edited':
      return from(entry, TYPING, () => ({
        kind: 'editing',
        draft: event.draft
      }))
    case 'dismissed':
      return from(entry, TYPING, () => IDLE)
    case 'applyRequested':
      return from(entry, TYPING, ({ draft }) =>
        draft.trim() === ''
          ? undefined
          : { kind: 'applying', draft: draft.trim() }
      )
    case 'applyAccepted':
      return from(entry, ['applying'], () => ({
        kind: 'applied',
        code: event.code
      }))
    case 'applyRejected':
      return from(entry, ['applying'], ({ draft }) => ({
        kind: 'rejected',
        draft,
        reason: event.reason
      }))
    case 'removeRequested':
      return from(entry, ['applied'], ({ code }) => ({
        kind: 'removing',
        code
      }))
    case 'removeSettled':
      return from(entry, ['removing'], () => IDLE)
    case 'removeFailed':
      return from(entry, ['removing'], ({ code }) => ({
        kind: 'applied',
        code
      }))
    case 'expired':
      return from(entry, ['applied'], () => IDLE)
  }
}

/** The server's refusals of the code itself; any other failure leaves it unjudged. */
const REFUSED_CODE_SERVER_CODES = [
  'PROMOTION_CODE_INVALID',
  'PROMOTION_CODE_INAPPLICABLE'
] as const

export function promoRejectionOf(
  result: Extract<PreviewSubscribeResult, { status: 'error' }>
): PromoRejection {
  return 'serverCode' in result &&
    REFUSED_CODE_SERVER_CODES.some((code) => matchesServerCode(result, code))
    ? 'invalid'
    : 'unchecked'
}

/**
 * The quote-binding rule: the code may change only while the customer is
 * choosing. From the Pay click through every in-flight state, and while the
 * page re-reads a collided operation, the total they consented to holds.
 */
export function promoEntryLive(
  page: CheckoutPage,
  payInFlight: boolean
): boolean {
  return (
    page.kind === 'capture' &&
    !isLocked(page) &&
    page.outcome?.kind !== 'reconciling' &&
    !payInFlight
  )
}
