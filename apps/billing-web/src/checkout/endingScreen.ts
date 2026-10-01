import type {
  BillingOperationReceipt,
  CapabilityDenialReason
} from '@comfyorg/account-core/billing'
import { isGrantLanding } from '@comfyorg/account-core/billing'

import type {
  CheckoutPage,
  LoadFailure,
  PlanUnavailableReason,
  ScheduledChange
} from '@/checkout/checkoutPage'
import { waitingOn } from '@/checkout/checkoutPage'

/** The code a link's 404 shows support: the catalog's verdict on a retired slug, or a link that could not be read. */
const PLAN_UNAVAILABLE_CODE: Readonly<Record<PlanUnavailableReason, string>> = {
  retired: 'PLAN_NOT_FOUND',
  team_stop_missing: 'CHECKOUT_LINK_INVALID',
  amount_invalid: 'CHECKOUT_LINK_INVALID',
  unreadable: 'CHECKOUT_LINK_INVALID'
}

/**
 * Which explanation Checkout not available gives. A reason with no copy of
 * its own reads as `unknown`. A change already scheduled names its plan and
 * date only when the server's status and catalog both do (`change_scheduled`).
 */
type RefusalCopy =
  | 'owner'
  | 'sales_managed'
  | 'unfinished'
  | 'change_unnamed'
  | 'unknown'

const REFUSAL_COPY: Readonly<Record<CapabilityDenialReason, RefusalCopy>> = {
  not_workspace_owner: 'owner',
  tier_not_self_serve: 'sales_managed',
  subscription_not_started: 'unfinished',
  subscription_status_unrecognized: 'unknown',
  subscription_change_in_progress: 'change_unnamed',
  not_a_member: 'unknown',
  unspecified: 'unknown'
}

/**
 * The full-page screen a checkout ends on, and the code support can act on.
 * `success` names the plan its quote priced: this page's own Pay sent it.
 * `completed` is money this page watched settle without sending it;
 * `already_completed` was through before the page could offer a form. Those
 * two name a plan only from the `receipt` the server reported for the
 * operation. `received` with a receipt is a charge the server confirmed
 * whose credits are still landing.
 */
export type EndingScreen =
  | {
      readonly kind: 'success'
      /** A top-up bought credits, so its Success names no plan. */
      readonly purchase?: 'credits'
      readonly receipt?: BillingOperationReceipt
    }
  | {
      readonly kind: 'completed'
      readonly code?: string
      readonly receipt?: BillingOperationReceipt
    }
  | {
      readonly kind: 'already_completed'
      readonly code?: string
      readonly receipt?: BillingOperationReceipt
    }
  | { readonly kind: 'in_progress'; readonly code: string }
  | {
      readonly kind: 'received'
      readonly code: string
      readonly receipt?: BillingOperationReceipt
    }
  | { readonly kind: 'unconfirmed'; readonly code: string }
  | {
      readonly kind: 'refused'
      readonly code: string
      readonly copy: RefusalCopy
    }
  | {
      readonly kind: 'refused'
      readonly code: string
      readonly copy: 'change_scheduled'
      readonly scheduled: ScheduledChange
    }
  | { readonly kind: 'plan_unavailable'; readonly code: string }
  /** A top-up link with no amount to quote: there is no plan to offer instead. */
  | { readonly kind: 'link_invalid'; readonly code: string }
  | {
      readonly kind: 'load_failed'
      readonly cause: LoadFailure
      readonly code: string
    }

export type EndingKind = EndingScreen['kind']

/** The page's screen when it has ended, or no screen while capture or verifying owns it. */
export function endingOf(page: CheckoutPage): EndingScreen | undefined {
  switch (page.kind) {
    case 'refused':
      return refusedEnding(page)
    case 'unavailable':
      return { kind: 'load_failed', cause: page.cause, code: page.code }
    case 'plan_unavailable':
      return {
        kind:
          page.reason === 'amount_invalid'
            ? 'link_invalid'
            : 'plan_unavailable',
        code: PLAN_UNAVAILABLE_CODE[page.reason]
      }
    case 'unconfirmed':
      return { kind: 'unconfirmed', code: page.operationId }
    case 'waiting':
      return waitingEnding(page)
    case 'terminal':
      return terminalEnding(page)
    default:
      return undefined
  }
}

function refusedEnding(
  page: Extract<CheckoutPage, { kind: 'refused' }>
): EndingScreen {
  const code = page.reason.toUpperCase()
  return page.scheduled === undefined
    ? { kind: 'refused', code, copy: REFUSAL_COPY[page.reason] }
    : {
        kind: 'refused',
        code,
        copy: 'change_scheduled',
        scheduled: page.scheduled
      }
}

function waitingEnding(
  page: Extract<CheckoutPage, { kind: 'waiting' }>
): EndingScreen | undefined {
  const code = page.operation.id
  switch (waitingOn(page.operation)) {
    case 'settling':
      return { kind: 'in_progress', code }
    case 'received':
      return { kind: 'received', code }
    case 'verifying':
      return undefined
  }
}

const TERMINAL_KIND = {
  followed: 'completed',
  settled: 'already_completed'
} as const

type SettledOperation = NonNullable<
  Extract<CheckoutPage, { kind: 'terminal' }>['operation']
>

function receiptOf(operation: SettledOperation | undefined) {
  return operation?.phase === 'succeeded' && operation.receipt !== undefined
    ? { receipt: operation.receipt }
    : {}
}

function successEnding(operation: SettledOperation | undefined): EndingScreen {
  return {
    kind: 'success',
    ...(operation?.kind === 'topup' ? { purchase: 'credits' } : {}),
    ...receiptOf(operation)
  }
}

function terminalEnding(
  page: Extract<CheckoutPage, { kind: 'terminal' }>
): EndingScreen {
  const { operation } = page
  if (operation !== undefined && isGrantLanding(operation))
    return { kind: 'received', code: operation.id, ...receiptOf(operation) }
  if (page.attribution === 'started' || page.attribution === 'returned')
    return successEnding(operation)
  const kind = TERMINAL_KIND[page.attribution]
  return operation === undefined
    ? { kind }
    : { kind, code: operation.id, ...receiptOf(operation) }
}

/**
 * A line of a receipt, in the grammar where tense is status: `adding` is the
 * grant the server has not recorded yet; every other row is confirmed.
 */
export type ReceiptRow =
  | { readonly kind: 'payment' | 'amount_paid'; readonly cents: number }
  | { readonly kind: 'adding' | 'plan' }
  | { readonly kind: 'added'; readonly credits: number }

/**
 * What an ending shows of the server's receipt. A done ending whose receipt
 * names a plan shows the plan card; one that names none (a top-up) lists only
 * what was added and paid, never a balance that may be stale by now, in place
 * of the reference code. Payment received lists a confirmed charge with its
 * credits still adding, above the code.
 */
export interface EndingReceipt {
  readonly namesPlan: boolean
  readonly rows: readonly ReceiptRow[]
  /** The rows say what the payment did, so the reference code gives way. */
  readonly rowsReplaceCode: boolean
}

function settledRows(receipt: BillingOperationReceipt): ReceiptRow[] {
  return [
    ...(receipt.creditsAdded === undefined
      ? []
      : [{ kind: 'added', credits: receipt.creditsAdded } as const]),
    ...(receipt.amountChargedCents === undefined
      ? []
      : [{ kind: 'amount_paid', cents: receipt.amountChargedCents } as const])
  ]
}

function landingRows(receipt: BillingOperationReceipt): ReceiptRow[] {
  if (receipt.amountChargedCents === undefined) return []
  return [
    { kind: 'payment', cents: receipt.amountChargedCents },
    { kind: 'adding' },
    ...(receipt.plan === undefined ? [] : [{ kind: 'plan' } as const])
  ]
}

export function endingReceipt(screen: EndingScreen): EndingReceipt {
  switch (screen.kind) {
    case 'success':
      return screen.purchase === 'credits'
        ? {
            namesPlan: false,
            rows:
              screen.receipt === undefined ? [] : settledRows(screen.receipt),
            rowsReplaceCode: false
          }
        : { namesPlan: true, rows: [], rowsReplaceCode: false }
    case 'completed':
    case 'already_completed': {
      const receipt = screen.receipt
      if (receipt?.plan !== undefined)
        return { namesPlan: true, rows: [], rowsReplaceCode: false }
      const rows = receipt === undefined ? [] : settledRows(receipt)
      return { namesPlan: false, rows, rowsReplaceCode: rows.length > 0 }
    }
    case 'received':
      return {
        namesPlan: false,
        rows: screen.receipt === undefined ? [] : landingRows(screen.receipt),
        rowsReplaceCode: false
      }
    default:
      return { namesPlan: false, rows: [], rowsReplaceCode: false }
  }
}
