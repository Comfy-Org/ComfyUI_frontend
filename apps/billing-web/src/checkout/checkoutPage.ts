import type { CapabilityDenialReason } from '@comfyorg/account-core/billing'

type ElementStatus = 'loading' | 'ready' | 'failed'

/**
 * How capture collects the money. `on_file` is a plan change, which the
 * server charges to the method already on file, so no card form mounts.
 */
type PaymentRail =
  | { readonly method: 'new_card'; readonly element: ElementStatus }
  | { readonly method: 'on_file' }

/** The full-page checkout, one state at a time. `resolving` renders the capture skeleton. */
export type CheckoutPage =
  | { readonly kind: 'resolving' }
  | { readonly kind: 'refused'; readonly reason: CapabilityDenialReason }
  | { readonly kind: 'unavailable'; readonly code: string }
  | { readonly kind: 'capture'; readonly rail: PaymentRail }

export type CheckoutPageEvent =
  | { readonly type: 'refused'; readonly reason: CapabilityDenialReason }
  | { readonly type: 'unavailable'; readonly code: string }
  | { readonly type: 'quoted'; readonly method: PaymentRail['method'] }
  | { readonly type: 'elementReady' }
  | { readonly type: 'elementFailed' }
  | { readonly type: 'elementRetried' }

export const RESOLVING: CheckoutPage = { kind: 'resolving' }

function withElement(
  page: CheckoutPage,
  from: readonly ElementStatus[],
  to: ElementStatus
): CheckoutPage {
  if (page.kind !== 'capture' || page.rail.method !== 'new_card') return page
  if (!from.includes(page.rail.element)) return page
  return { kind: 'capture', rail: { method: 'new_card', element: to } }
}

/** An event that means nothing in the current state returns it untouched. */
export function reduceCheckoutPage(
  page: CheckoutPage,
  event: CheckoutPageEvent
): CheckoutPage {
  switch (event.type) {
    case 'refused':
      return page.kind === 'resolving'
        ? { kind: 'refused', reason: event.reason }
        : page
    case 'unavailable':
      return page.kind === 'resolving'
        ? { kind: 'unavailable', code: event.code }
        : page
    case 'quoted':
      if (page.kind !== 'resolving') return page
      return {
        kind: 'capture',
        rail:
          event.method === 'new_card'
            ? { method: 'new_card', element: 'loading' }
            : { method: 'on_file' }
      }
    case 'elementReady':
      return withElement(page, ['loading'], 'ready')
    case 'elementFailed':
      return withElement(page, ['loading', 'ready'], 'failed')
    case 'elementRetried':
      return withElement(page, ['failed'], 'loading')
  }
}

/** Pay waits for the quote and, when a card is collected, for the element to be ready. */
export function railAcceptsPay(page: CheckoutPage): boolean {
  if (page.kind !== 'capture') return false
  return page.rail.method === 'on_file' || page.rail.element === 'ready'
}
