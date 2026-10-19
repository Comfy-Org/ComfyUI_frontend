export type TopupCheckoutDialogState =
  | { readonly kind: 'amount'; readonly checkoutOpenFailed: boolean }
  | { readonly kind: 'creatingCheckout' }
  | { readonly kind: 'checkoutOpened'; readonly checkoutUrl: string }
  | { readonly kind: 'checkoutBlocked'; readonly checkoutUrl: string }

export type TopupCheckoutDialogEvent =
  | { readonly type: 'continueRequested' }
  | {
      readonly type: 'checkoutCreated'
      readonly checkoutUrl: string
      readonly tabOpened: boolean
    }
  | { readonly type: 'checkoutFailed' }
  | { readonly type: 'checkoutReopened'; readonly tabOpened: boolean }

export const INITIAL_TOPUP_CHECKOUT_DIALOG_STATE: TopupCheckoutDialogState = {
  kind: 'amount',
  checkoutOpenFailed: false
}

function handedOff(
  checkoutUrl: string,
  tabOpened: boolean
): TopupCheckoutDialogState {
  return {
    kind: tabOpened ? 'checkoutOpened' : 'checkoutBlocked',
    checkoutUrl
  }
}

/** The Add credits dialog's next state; an event the state does not accept leaves it unchanged. */
export function transitionTopupCheckoutDialog(
  state: TopupCheckoutDialogState,
  event: TopupCheckoutDialogEvent
): TopupCheckoutDialogState {
  switch (event.type) {
    case 'continueRequested':
      return state.kind === 'amount' ? { kind: 'creatingCheckout' } : state
    case 'checkoutCreated':
      return state.kind === 'creatingCheckout'
        ? handedOff(event.checkoutUrl, event.tabOpened)
        : state
    case 'checkoutFailed':
      return state.kind === 'creatingCheckout'
        ? { kind: 'amount', checkoutOpenFailed: true }
        : state
    case 'checkoutReopened':
      return state.kind === 'checkoutOpened' || state.kind === 'checkoutBlocked'
        ? handedOff(state.checkoutUrl, event.tabOpened)
        : state
  }
}
