import type { CheckoutPage } from '@/checkout/checkoutPage'
import { waitingOn } from '@/checkout/checkoutPage'

/** The code a stale plan link shows; the catalog's verdict, not a capability denial. */
const PLAN_NOT_FOUND = 'PLAN_NOT_FOUND'

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
  | { readonly kind: 'refused'; readonly code: string }
  | { readonly kind: 'plan_unavailable'; readonly code: string }
  | { readonly kind: 'load_failed'; readonly code: string }

export type EndingKind = EndingScreen['kind']

/** The page's screen when it has ended, or no screen while capture or verifying owns it. */
export function endingOf(page: CheckoutPage): EndingScreen | undefined {
  switch (page.kind) {
    case 'refused':
      return { kind: 'refused', code: page.reason.toUpperCase() }
    case 'unavailable':
      return { kind: 'load_failed', code: page.code }
    case 'plan_unavailable':
      return { kind: 'plan_unavailable', code: PLAN_NOT_FOUND }
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
