import type { CapabilityDenialReason } from '@comfyorg/account-core/billing'

import type {
  CheckoutPage,
  PlanUnavailableReason
} from '@/checkout/checkoutPage'
import { waitingOn } from '@/checkout/checkoutPage'

/** The code Plan not available shows support: the catalog's verdict on a retired slug, or a link that could not be read. */
const PLAN_UNAVAILABLE_CODE: Readonly<Record<PlanUnavailableReason, string>> = {
  retired: 'PLAN_NOT_FOUND',
  team_stop_missing: 'CHECKOUT_LINK_INVALID',
  unreadable: 'CHECKOUT_LINK_INVALID'
}

/**
 * Which explanation Checkout not available gives. A reason with no copy of
 * its own, a change already scheduled included, reads as `unknown`.
 */
type RefusalCopy = 'owner' | 'sales_managed' | 'unfinished' | 'unknown'

const REFUSAL_COPY: Readonly<Record<CapabilityDenialReason, RefusalCopy>> = {
  not_workspace_owner: 'owner',
  tier_not_self_serve: 'sales_managed',
  subscription_not_started: 'unfinished',
  subscription_status_unrecognized: 'unknown',
  subscription_change_in_progress: 'unknown',
  not_a_member: 'unknown',
  unspecified: 'unknown'
}

/**
 * The full-page screen a checkout ends on, and the code support can act on.
 * `success` is the only one that may name a plan: this page's own Pay sent
 * it. `completed` is money this page watched settle without sending it;
 * `already_completed` was through before the page could offer a form.
 */
export type EndingScreen =
  | { readonly kind: 'success' }
  | { readonly kind: 'completed'; readonly code?: string }
  | { readonly kind: 'already_completed'; readonly code?: string }
  | { readonly kind: 'in_progress'; readonly code: string }
  | { readonly kind: 'received'; readonly code: string }
  | { readonly kind: 'unconfirmed'; readonly code: string }
  | {
      readonly kind: 'refused'
      readonly code: string
      readonly copy: RefusalCopy
    }
  | { readonly kind: 'plan_unavailable'; readonly code: string }
  | { readonly kind: 'load_failed'; readonly code: string }
  | { readonly kind: 'recheck_failed'; readonly code: string }

export type EndingKind = EndingScreen['kind']

/** The page's screen when it has ended, or no screen while capture or verifying owns it. */
export function endingOf(page: CheckoutPage): EndingScreen | undefined {
  switch (page.kind) {
    case 'refused':
      return {
        kind: 'refused',
        code: page.reason.toUpperCase(),
        copy: REFUSAL_COPY[page.reason]
      }
    case 'unavailable':
      return { kind: 'load_failed', code: page.code }
    case 'recheck_failed':
      return { kind: 'recheck_failed', code: page.code }
    case 'plan_unavailable':
      return {
        kind: 'plan_unavailable',
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

function terminalEnding(
  page: Extract<CheckoutPage, { kind: 'terminal' }>
): EndingScreen {
  if (page.attribution === 'started') return { kind: 'success' }
  const kind = TERMINAL_KIND[page.attribution]
  return page.operation === undefined
    ? { kind }
    : { kind, code: page.operation.id }
}
