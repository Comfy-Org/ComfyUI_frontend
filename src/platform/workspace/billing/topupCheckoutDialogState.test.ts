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
const opened: TopupCheckoutDialogState = { kind: 'checkoutOpened', checkoutUrl }
const blocked: TopupCheckoutDialogState = {
  kind: 'checkoutBlocked',
  checkoutUrl
}

const created = (tabOpened: boolean): TopupCheckoutDialogEvent => ({
  type: 'checkoutCreated',
  checkoutUrl,
  tabOpened
})
const reopened = (tabOpened: boolean): TopupCheckoutDialogEvent => ({
  type: 'checkoutReopened',
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
      name: 'keeps the checkout to reopen when the browser blocked the tab',
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
      name: 'stays handed off when the checkout is reopened',
      from: opened,
      event: reopened(true),
      to: opened
    },
    {
      name: 'reports a blocked reopen',
      from: opened,
      event: reopened(false),
      to: blocked
    },
    {
      name: 'hands off once a blocked checkout opens',
      from: blocked,
      event: reopened(true),
      to: opened
    },
    {
      name: 'has no checkout to reopen from the amount step',
      from: amount,
      event: reopened(true),
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
