export type TopupCheckoutDialogState =
  | { readonly kind: 'amount'; readonly checkoutOpenFailed: boolean }
  | { readonly kind: 'creatingCheckout' }
  | { readonly kind: 'checkoutOpened'; readonly reopenFailed: boolean }
  | { readonly kind: 'reopeningCheckout' }
  | { readonly kind: 'checkoutBlocked'; readonly checkoutUrl: string }

export type TopupCheckoutDialogEvent =
  | { readonly type: 'continueRequested' }
  | { readonly type: 'reopenRequested' }
  | {
      readonly type: 'checkoutCreated'
      readonly checkoutUrl: string
      readonly tabOpened: boolean
    }
  | { readonly type: 'checkoutFailed' }
  | { readonly type: 'blockedCheckoutLinkOpened' }

export const INITIAL_TOPUP_CHECKOUT_DIALOG_STATE: TopupCheckoutDialogState = {
  kind: 'amount',
  checkoutOpenFailed: false
}

const HANDED_OFF: TopupCheckoutDialogState = {
  kind: 'checkoutOpened',
  reopenFailed: false
}

function isCreating(state: TopupCheckoutDialogState): boolean {
  return state.kind === 'creatingCheckout' || state.kind === 'reopeningCheckout'
}

/** The Add credits dialog's next state; an event the state does not accept leaves it unchanged. */
export function transitionTopupCheckoutDialog(
  state: TopupCheckoutDialogState,
  event: TopupCheckoutDialogEvent
): TopupCheckoutDialogState {
  switch (event.type) {
    case 'continueRequested':
      return state.kind === 'amount' ? { kind: 'creatingCheckout' } : state
    case 'reopenRequested':
      return state.kind === 'checkoutOpened'
        ? { kind: 'reopeningCheckout' }
        : state
    case 'checkoutCreated':
      if (!isCreating(state)) return state
      return event.tabOpened
        ? HANDED_OFF
        : { kind: 'checkoutBlocked', checkoutUrl: event.checkoutUrl }
    case 'checkoutFailed':
      if (state.kind === 'creatingCheckout') {
        return { kind: 'amount', checkoutOpenFailed: true }
      }
      return state.kind === 'reopeningCheckout'
        ? { kind: 'checkoutOpened', reopenFailed: true }
        : state
    case 'blockedCheckoutLinkOpened':
      return state.kind === 'checkoutBlocked' ? HANDED_OFF : state
  }
}
