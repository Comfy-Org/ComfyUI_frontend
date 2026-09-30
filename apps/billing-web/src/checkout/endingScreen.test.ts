import type { BillingOperationReceipt } from '@comfyorg/account-core/billing'

import type { CheckoutPage } from '@/checkout/checkoutPage'
import { RESOLVING } from '@/checkout/checkoutPage'
import type { EndingScreen } from '@/checkout/endingScreen'
import { endingOf } from '@/checkout/endingScreen'
import { pendingOperation, succeededOperation } from '@/test/fakeBillingClient'

const capture: CheckoutPage = {
  kind: 'capture',
  rail: { method: 'on_file' },
  reactivation: 'not_required',
  attempt: { kind: 'idle' }
}

describe('endingOf', () => {
  it.for<{
    name: string
    page: CheckoutPage
    screen: EndingScreen | undefined
  }>([
    { name: 'resolving', page: RESOLVING, screen: undefined },
    { name: 'capture', page: capture, screen: undefined },
    {
      name: 'money the page is still verifying',
      page: { kind: 'waiting', operation: pendingOperation('op_v') },
      screen: undefined
    },
    {
      name: 'a capture the bank is still settling',
      page: {
        kind: 'waiting',
        operation: {
          ...pendingOperation('op_s'),
          authenticationState: 'processing',
          serverPhase: 'in_progress'
        }
      },
      screen: { kind: 'in_progress', code: 'op_s' }
    },
    {
      name: 'a charge through with the plan still landing',
      page: {
        kind: 'waiting',
        operation: {
          ...pendingOperation('op_r'),
          authenticationState: 'succeeded'
        }
      },
      screen: { kind: 'received', code: 'op_r' }
    },
    {
      name: 'an outcome the page could not confirm',
      page: { kind: 'unconfirmed', operationId: 'op_u' },
      screen: { kind: 'unconfirmed', code: 'op_u' }
    },
    {
      name: "this page's own Pay, which names the plan",
      page: {
        kind: 'terminal',
        operation: succeededOperation('op_mine'),
        attribution: 'started'
      },
      screen: { kind: 'success' }
    },
    {
      name: "this page's own Pay, found settled after a reload or a provider's page",
      page: {
        kind: 'terminal',
        operation: succeededOperation('op_mine'),
        attribution: 'returned'
      },
      screen: { kind: 'success' }
    },
    {
      name: "this page's own Pay settled on the spot",
      page: { kind: 'terminal', attribution: 'started' },
      screen: { kind: 'success' }
    },
    {
      name: 'money the page watched settle, card-less with its reference',
      page: {
        kind: 'terminal',
        operation: succeededOperation('op_seen'),
        attribution: 'followed'
      },
      screen: { kind: 'completed', code: 'op_seen' }
    },
    {
      name: 'a payment already through on arrival',
      page: {
        kind: 'terminal',
        operation: succeededOperation('op_old'),
        attribution: 'settled'
      },
      screen: { kind: 'already_completed', code: 'op_old' }
    },
    {
      name: 'a settled payment with no operation to quote',
      page: { kind: 'terminal', attribution: 'settled' },
      screen: { kind: 'already_completed' }
    },
    {
      name: 'a checkout that could not load',
      page: { kind: 'unavailable', cause: 'quote', code: 'REQUEST_FAILED' },
      screen: { kind: 'load_failed', cause: 'quote', code: 'REQUEST_FAILED' }
    },
    {
      name: "a re-read of the workspace's payments that failed",
      page: { kind: 'unavailable', cause: 'recheck', code: 'REQUEST_FAILED' },
      screen: { kind: 'load_failed', cause: 'recheck', code: 'REQUEST_FAILED' }
    },
    {
      name: 'a plan the catalog lacks',
      page: { kind: 'plan_unavailable', reason: 'retired' },
      screen: { kind: 'plan_unavailable', code: 'PLAN_NOT_FOUND' }
    },
    {
      name: 'a team link without its commit stop',
      page: { kind: 'plan_unavailable', reason: 'team_stop_missing' },
      screen: { kind: 'plan_unavailable', code: 'CHECKOUT_LINK_INVALID' }
    },
    {
      name: 'a link the contract cannot read',
      page: { kind: 'plan_unavailable', reason: 'unreadable' },
      screen: { kind: 'plan_unavailable', code: 'CHECKOUT_LINK_INVALID' }
    }
  ])('$name', ({ page, screen }) => {
    expect(endingOf(page)).toEqual(screen)
  })
})

describe('endingOf with the receipt the server reported', () => {
  const PLAN = { slug: 'pro_monthly', duration: 'MONTHLY' } as const
  const settledWith = (receipt: BillingOperationReceipt) => ({
    ...succeededOperation('op_paid'),
    receipt
  })

  it.for<{
    name: string
    page: CheckoutPage
    screen: EndingScreen
  }>([
    {
      name: "this page's own Pay, with the credits it added",
      page: {
        kind: 'terminal',
        operation: settledWith({
          amountChargedCents: 3250,
          creditsAdded: 6858,
          plan: PLAN
        }),
        attribution: 'started'
      },
      screen: {
        kind: 'success',
        receipt: { amountChargedCents: 3250, creditsAdded: 6858, plan: PLAN }
      }
    },
    {
      name: "this page's own top-up, which bought credits and no plan",
      page: {
        kind: 'terminal',
        operation: {
          ...settledWith({ amountChargedCents: 1500, creditsAdded: 3165 }),
          kind: 'topup'
        },
        attribution: 'started'
      },
      screen: {
        kind: 'success',
        purchase: 'credits',
        receipt: { amountChargedCents: 1500, creditsAdded: 3165 }
      }
    },
    {
      name: 'a payment already through, with its plan and credits',
      page: {
        kind: 'terminal',
        operation: settledWith({ creditsAdded: 6858, plan: PLAN }),
        attribution: 'settled'
      },
      screen: {
        kind: 'already_completed',
        code: 'op_paid',
        receipt: { creditsAdded: 6858, plan: PLAN }
      }
    },
    {
      name: 'a payment the page watched settle, with its plan',
      page: {
        kind: 'terminal',
        operation: settledWith({ plan: PLAN }),
        attribution: 'followed'
      },
      screen: { kind: 'completed', code: 'op_paid', receipt: { plan: PLAN } }
    },
    {
      name: "this page's own charge whose credits are still landing",
      page: {
        kind: 'terminal',
        operation: settledWith({ amountChargedCents: 3250, plan: PLAN }),
        attribution: 'started'
      },
      screen: {
        kind: 'received',
        code: 'op_paid',
        receipt: { amountChargedCents: 3250, plan: PLAN }
      }
    },
    {
      name: 'a charge already through whose credits are still landing',
      page: {
        kind: 'terminal',
        operation: settledWith({ amountChargedCents: 1500 }),
        attribution: 'settled'
      },
      screen: {
        kind: 'received',
        code: 'op_paid',
        receipt: { amountChargedCents: 1500 }
      }
    }
  ])('$name', ({ page, screen }) => {
    expect(endingOf(page)).toEqual(screen)
  })
})
