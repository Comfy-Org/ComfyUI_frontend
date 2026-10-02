import userEvent from '@testing-library/user-event'
import { render, screen } from '@testing-library/vue'

import type {
  BillingOperationReceipt,
  SucceededBillingOperation,
  TopupQuoteResult
} from '@comfyorg/account-core/billing'
import type { AccountCredential } from '@comfyorg/account-core/session'
import { BILLING_CLIENT_KEY } from '@comfyorg/account-ui/billing'
import { parseBillingEntry } from '@comfyorg/billing-contract'

import { recordBillingEntry } from '@/entry/billingEntry'
import { createBillingI18n } from '@/i18n'
import type { FakeBillingClientOptions } from '@/test/fakeBillingClient'
import {
  createFakeBillingClient,
  failedOperation,
  succeededOperation
} from '@/test/fakeBillingClient'
import FullPageTopupView from '@/views/FullPageTopupView.vue'

vi.mock<unknown>(import('@/config/env'), () => ({
  BILLING_WEB_ENV: 'test',
  CLOUD_BASE_URL: 'https://testcloud.comfy.org'
}))

vi.mock(import('@/config/stripeKey'), () => ({
  awaitBillingWebStripeKey: () => Promise.resolve('pk_test_example')
}))

vi.mock(import('@/session/stripeChallengePort'), () => ({
  createDeferredStripeChallengePort: () => ({
    handleNextAction: async () => ({}),
    leavesPage: async () => false
  })
}))

vi.mock(import('@/entry/workspaceBinding'), () => ({
  boundWorkspaceId: () => undefined,
  bindEntryWorkspace: () => false
}))

const SESSION: AccountCredential = {
  token: 'jwt-1',
  permissions: [],
  expiresAt: Date.now() + 3_600_000,
  uid: 'uid-1',
  workspace: { id: 'ws-team', name: 'Acme Team', type: 'team' },
  role: 'owner'
}

vi.mock(import('@/session/billingWebSession'), async () => {
  const { computed } = await import('vue')
  return {
    useBillingWebSession: () => ({
      phase: computed(() => 'authenticated' as const),
      user: computed(() => null),
      session: computed(() => SESSION),
      failure: computed(() => undefined)
    })
  }
})

const TOPUP_PATH =
  '/v1/top-up?product=comfyui&return_to=comfyui_workspace&amount_cents=2500'

const QUOTED: TopupQuoteResult = {
  status: 'ok',
  value: {
    amountCents: 2500,
    credits: 5275,
    expiresAt: '2027-09-30T12:00:00.000Z'
  }
}

function renderTopup(
  options: FakeBillingClientOptions = {},
  path = TOPUP_PATH
) {
  recordBillingEntry(parseBillingEntry(path))
  const fake = createFakeBillingClient({
    capabilities: { can_top_up: true },
    topupQuote: QUOTED,
    ...options
  })
  render(FullPageTopupView, {
    global: {
      plugins: [createBillingI18n()],
      provide: { [BILLING_CLIENT_KEY]: fake.client }
    }
  })
  return fake
}

function settledTopup(
  receipt: BillingOperationReceipt
): SucceededBillingOperation {
  return {
    ...succeededOperation('op_topup'),
    phase: 'succeeded',
    kind: 'topup',
    receipt
  }
}

const payButton = () => screen.getByRole('button', { name: 'Pay' })

afterEach(() => {
  sessionStorage.clear()
})

describe('FullPageTopupView', () => {
  it('265-4362: quotes the link amount and leads with the credits the server quotes, with no promo entry', async () => {
    const fake = renderTopup()

    expect(
      await screen.findByText('Add credits · Acme Team')
    ).toBeInTheDocument()
    const summary = screen.getByRole('region', { name: 'Order summary' })
    expect(summary).toHaveTextContent('5,275 credits')
    expect(summary).toHaveTextContent('Credits$25.00')
    expect(summary).toHaveTextContent('Expire September 30, 2027')
    expect(summary).toHaveTextContent('Total due today$25.00')
    expect(
      screen.queryByRole('button', { name: 'Add promo code' })
    ).not.toBeInTheDocument()
    expect(fake.quoteTopup).toHaveBeenCalledWith({ amountCents: 2500 })
    expect(payButton()).toBeEnabled()
  })

  it('77-3783: a Pay that goes through counts the credits the server added', async () => {
    const settled = settledTopup({
      amountChargedCents: 2500,
      creditsAdded: 5275
    })
    const fake = renderTopup({
      topup: { status: 'ok', operation: settled, creditsReconciled: true }
    })
    await screen.findByText('Add credits · Acme Team')

    await userEvent.click(payButton())

    expect(
      await screen.findByRole('heading', { name: '5,275 credits added' })
    ).toBeInTheDocument()
    expect(screen.getByTestId('checkout-ending-receipt')).toHaveTextContent(
      'Added+5,275Amount paid$25.00'
    )
    expect(fake.createTopupCheckout).toHaveBeenCalledOnce()
  })

  it('keeps the form with the decline card when the bank refuses the charge', async () => {
    renderTopup({
      topup: {
        status: 'declined',
        operation: {
          ...failedOperation('insufficient_funds', 'op_topup'),
          phase: 'failed',
          declineReason: 'insufficient_funds',
          retryable: true
        }
      }
    })
    await screen.findByText('Add credits · Acme Team')

    await userEvent.click(payButton())

    expect(await screen.findByText('Payment declined')).toBeInTheDocument()
    expect(payButton()).toBeInTheDocument()
  })

  it('is Checkout not available when the server refuses a top-up for this workspace', async () => {
    renderTopup({
      capabilities: { can_top_up: false },
      denials: { can_top_up: 'not_workspace_owner' }
    })

    expect(
      await screen.findByRole('heading', { name: 'Checkout not available' })
    ).toBeInTheDocument()
    expect(screen.getByTestId('checkout-ending-code')).toHaveTextContent(
      'NOT_WORKSPACE_OWNER'
    )
  })

  it('cannot load a quote the server will not give, and says so without a form', async () => {
    renderTopup({ topupQuote: { status: 'error', code: 'NOT_AVAILABLE' } })

    expect(
      await screen.findByRole('heading', {
        name: "Couldn't load your checkout"
      })
    ).toBeInTheDocument()
    expect(screen.getByTestId('checkout-ending-code')).toHaveTextContent(
      'NOT_AVAILABLE'
    )
  })

  it.for([
    { name: 'no amount', query: '' },
    { name: 'an unreadable amount', query: '&amount_cents=12.50' }
  ])(
    '769-15773: a top-up link with $name is not valid and sends the customer to add credits in settings',
    async ({ query }) => {
      const assign = vi
        .spyOn(window.location, 'assign')
        .mockImplementation(() => {})
      const fake = renderTopup(
        {},
        `/v1/top-up?product=comfyui&return_to=comfyui_workspace${query}`
      )

      expect(
        await screen.findByRole('heading', { name: "This link isn't valid" })
      ).toBeInTheDocument()
      expect(
        screen.getByText(
          "The amount in your link isn't valid. Nothing has been charged. Choose an amount in your billing settings."
        )
      ).toBeInTheDocument()
      expect(screen.getByTestId('checkout-ending-code')).toHaveTextContent(
        'CHECKOUT_LINK_INVALID'
      )
      expect(
        screen.getByRole('link', { name: 'Contact support' })
      ).toBeInTheDocument()
      expect(fake.quoteTopup).not.toHaveBeenCalled()

      await userEvent.click(screen.getByRole('button', { name: 'Add credits' }))

      expect(assign).toHaveBeenCalledWith(
        'https://testcloud.comfy.org/?settings=plan-credits&workspace=ws-team'
      )
    }
  )

  it('410-5225: a revisit after the top-up went through is Already completed, never a second form', async () => {
    renderTopup({
      recover: {
        status: 'ok',
        value: settledTopup({ amountChargedCents: 2500, creditsAdded: 5275 })
      }
    })

    expect(
      await screen.findByRole('heading', { name: 'Already completed' })
    ).toBeInTheDocument()
    expect(screen.getByTestId('checkout-ending-receipt')).toHaveTextContent(
      'Added+5,275Amount paid$25.00'
    )
    expect(
      screen.queryByRole('button', { name: 'Pay' })
    ).not.toBeInTheDocument()
  })
})
