import { describe, expect, it } from 'vitest'

import type {
  TopupCheckoutDialogEvent,
  TopupCheckoutDialogState
} from '@/platform/workspace/billing/topupCheckoutDialogState'
import {
  INITIAL_TOPUP_CHECKOUT_DIALOG_STATE,
  transitionTopupCheckoutDialog
} from '@/platform/workspace/billing/topupCheckoutDialogState'

const checkoutUrl = 'https://checkout.stripe.com/c/pay/cs_test'

const amount = INITIAL_TOPUP_CHECKOUT_DIALOG_STATE
const amountAfterFailure: TopupCheckoutDialogState = {
  kind: 'amount',
  checkoutOpenFailed: true
}
const creating: TopupCheckoutDialogState = { kind: 'creatingCheckout' }
const opened: TopupCheckoutDialogState = {
  kind: 'checkoutOpened',
  reopenFailed: false
}
const openedAfterFailedReopen: TopupCheckoutDialogState = {
  kind: 'checkoutOpened',
  reopenFailed: true
}
const reopening: TopupCheckoutDialogState = { kind: 'reopeningCheckout' }
const blocked: TopupCheckoutDialogState = {
  kind: 'checkoutBlocked',
  checkoutUrl
}

const created = (tabOpened: boolean): TopupCheckoutDialogEvent => ({
  type: 'checkoutCreated',
  checkoutUrl,
  tabOpened
})

describe('transitionTopupCheckoutDialog', () => {
  it.for<{
    name: string
    from: TopupCheckoutDialogState
    event: TopupCheckoutDialogEvent
    to: TopupCheckoutDialogState
  }>([
    {
      name: 'starts creating the checkout from the amount step',
      from: amount,
      event: { type: 'continueRequested' },
      to: creating
    },
    {
      name: 'retries after a checkout that failed to open',
      from: amountAfterFailure,
      event: { type: 'continueRequested' },
      to: creating
    },
    {
      name: 'ignores a second continue while the checkout is being created',
      from: creating,
      event: { type: 'continueRequested' },
      to: creating
    },
    {
      name: 'hands off once the checkout opened in a new tab',
      from: creating,
      event: created(true),
      to: opened
    },
    {
      name: 'keeps the new session to link to when the browser blocked the tab',
      from: creating,
      event: created(false),
      to: blocked
    },
    {
      name: 'returns to the amount step and says so when no checkout was created',
      from: creating,
      event: { type: 'checkoutFailed' },
      to: amountAfterFailure
    },
    {
      name: 'ignores a checkout created after the dialog left the creating step',
      from: amount,
      event: created(true),
      to: amount
    },
    {
      name: 'creates a fresh session when the customer reopens checkout',
      from: opened,
      event: { type: 'reopenRequested' },
      to: reopening
    },
    {
      name: 'retries a reopen that failed',
      from: openedAfterFailedReopen,
      event: { type: 'reopenRequested' },
      to: reopening
    },
    {
      name: 'ignores a second reopen while the fresh session is being created',
      from: reopening,
      event: { type: 'reopenRequested' },
      to: reopening
    },
    {
      name: 'stays handed off once the fresh session opens',
      from: reopening,
      event: created(true),
      to: opened
    },
    {
      name: 'links to the fresh session when its tab was blocked',
      from: reopening,
      event: created(false),
      to: blocked
    },
    {
      name: 'stays handed off and says so when the fresh session failed',
      from: reopening,
      event: { type: 'checkoutFailed' },
      to: openedAfterFailedReopen
    },
    {
      name: 'hands off once the customer follows the blocked checkout link',
      from: blocked,
      event: { type: 'blockedCheckoutLinkOpened' },
      to: opened
    },
    {
      name: 'has no blocked link to follow from the amount step',
      from: amount,
      event: { type: 'blockedCheckoutLinkOpened' },
      to: amount
    },
    {
      name: 'has no session to reopen from the amount step',
      from: amount,
      event: { type: 'reopenRequested' },
      to: amount
    },
    {
      name: 'ignores a late failure once handed off',
      from: opened,
      event: { type: 'checkoutFailed' },
      to: opened
    }
  ])('$name', ({ from, event, to }) => {
    expect(transitionTopupCheckoutDialog(from, event)).toEqual(to)
  })
})
