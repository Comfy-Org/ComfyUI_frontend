import userEvent from '@testing-library/user-event'
import { render, screen, waitFor } from '@testing-library/vue'
import { assert } from 'vitest'
import type { VNode } from 'vue'

import type {
  BillingOperationReceipt,
  BillingOperationState,
  BillingResult,
  PendingBillingOperation,
  SavedPaymentMethod,
  SucceededBillingOperation,
  TopupQuoteResult,
  TopupResult
} from '@comfyorg/account-core/billing'
import type { AccountCredential } from '@comfyorg/account-core/session'
import { BILLING_CLIENT_KEY } from '@comfyorg/account-ui/billing'
import { parseBillingEntry } from '@comfyorg/billing-contract'

import { provideWebSessionCloudRead } from '@/config/checkoutUi'
import { recordBillingEntry } from '@/entry/billingEntry'
import { createBillingI18n } from '@/i18n'
import type {
  FakeBillingClient,
  FakeBillingClientOptions
} from '@/test/fakeBillingClient'
import {
  createFakeBillingClient,
  failedOperation,
  pendingOperation,
  succeededOperation,
  unresolvedOperation
} from '@/test/fakeBillingClient'
import { trackedBillingEvents } from '@/test/trackedBillingEvents'
import FullPageTopupView from '@/views/FullPageTopupView.vue'

vi.mock<unknown>(import('@/config/env'), () => ({
  BILLING_WEB_ENV: 'test',
  CLOUD_BASE_URL: 'https://testcloud.comfy.org'
}))

const stripeKey = vi.hoisted(() => ({
  read: (): Promise<string | undefined> => Promise.resolve('pk_test_example')
}))

vi.mock(import('@/config/stripeKey'), async () => {
  const { ref } = await import('vue')
  return {
    awaitBillingWebStripeKey: () => stripeKey.read(),
    useBillingWebStripeKey: () => ref('pk_test_example')
  }
})

const form = vi.hoisted(() => ({
  mounts: 0,
  payOnce: undefined as boolean | undefined,
  configuration: undefined as string | undefined,
  emit: (() => {}) as (event: string, ...payload: unknown[]) => void
}))

vi.mock<unknown>(import('@comfyorg/account-ui/billing/stripe'), async () => {
  const { h } = await import('vue')
  return {
    StripePaymentForm: {
      name: 'StripePaymentForm',
      props: {
        canSubmit: { type: Boolean, default: true },
        isLoading: { type: Boolean, default: false },
        payOnce: { type: Boolean, default: false },
        paymentMethodConfigurationId: { type: String, default: '' }
      },
      emits: ['confirm', 'phase'],
      setup(
        props: {
          canSubmit: boolean
          isLoading: boolean
          payOnce: boolean
          paymentMethodConfigurationId: string
        },
        {
          emit,
          slots
        }: {
          emit: (event: string, ...payload: unknown[]) => void
          slots: { submit?: (slotProps: Record<string, unknown>) => VNode[] }
        }
      ) {
        form.mounts += 1
        form.emit = emit
        form.payOnce = props.payOnce
        form.configuration = props.paymentMethodConfigurationId
        return () =>
          h(
            'div',
            slots.submit?.({
              disabled: !props.canSubmit,
              loading: props.isLoading
            })
          )
      }
    }
  }
})

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
  path = TOPUP_PATH,
  arrange: (fake: FakeBillingClient) => void = () => {}
) {
  recordBillingEntry(parseBillingEntry(path))
  const fake = createFakeBillingClient({
    capabilities: { can_top_up: true },
    topupQuote: QUOTED,
    ...options
  })
  arrange(fake)
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

let featureReader = 0

function serveFeatures(read: () => Promise<Response | undefined>) {
  const uid = `uid-features-${++featureReader}`
  provideWebSessionCloudRead(() => ({ uid, read }))
}

const unifiedBillingSettings = (on: boolean) => async () =>
  new Response(JSON.stringify({ unified_billing_settings: on }))

beforeEach(() => {
  serveFeatures(unifiedBillingSettings(true))
})

afterEach(() => {
  sessionStorage.clear()
  stripeKey.read = () => Promise.resolve('pk_test_example')
})

describe('FullPageTopupView', () => {
  it('reports the back arrow and goes back to the product', async () => {
    const assign = vi
      .spyOn(window.location, 'assign')
      .mockImplementation(() => {})
    const sent = trackedBillingEvents()
    renderTopup()
    await screen.findByText('Add credits · Acme Team')

    await userEvent.click(screen.getByRole('button', { name: 'Back' }))

    expect(assign).toHaveBeenCalledExactlyOnceWith(
      'https://testcloud.comfy.org/?workspace=ws-team'
    )
    expect(sent()).toStrictEqual([
      {
        operation: 'web_return',
        stage: 'clicked',
        outcome: 'pending',
        control: 'back'
      }
    ])
  })

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

  it('names the default card the top-up charges, with no card form or picker', async () => {
    const fake = renderTopup({
      paymentMethods: {
        status: 'ok',
        value: [
          {
            id: 'pm_visa',
            type: 'card',
            brand: 'visa',
            last4: '3184',
            is_default: true
          },
          {
            id: 'pm_mc',
            type: 'card',
            brand: 'mastercard',
            last4: '4402',
            is_default: false
          }
        ]
      }
    })
    await screen.findByText('Add credits · Acme Team')

    expect(
      screen.getByRole('heading', { name: 'Payment method' })
    ).toBeInTheDocument()
    expect(screen.getByText('visa')).toBeInTheDocument()
    expect(screen.getByText('·· 3184')).toBeInTheDocument()
    expect(screen.queryByText('·· 4402')).not.toBeInTheDocument()
    expect(screen.queryByRole('combobox')).not.toBeInTheDocument()

    await userEvent.click(payButton())

    expect(fake.createTopupCheckout).toHaveBeenCalledOnce()
  })

  it('opens a payable top-up while the saved-methods read is still out, and names no card yet', async () => {
    const fake = renderTopup({}, TOPUP_PATH, (fake) =>
      fake.readPaymentMethods.mockImplementation(() => new Promise(() => {}))
    )
    await screen.findByText('Add credits · Acme Team')

    expect(payButton()).toBeEnabled()
    expect(
      screen.queryByRole('heading', { name: 'Payment method' })
    ).not.toBeInTheDocument()

    await userEvent.click(payButton())

    expect(fake.createTopupCheckout).toHaveBeenCalledOnce()
  })

  it('names no card after a failed read, even one an earlier read cached', async () => {
    renderTopup({
      paymentMethods: { status: 'error', code: 'REQUEST_FAILED' },
      cachedPaymentMethods: [
        {
          id: 'pm_visa',
          type: 'card',
          brand: 'visa',
          last4: '3184',
          is_default: true
        }
      ]
    })
    await screen.findByText('Add credits · Acme Team')

    expect(payButton()).toBeEnabled()
    expect(screen.queryByText('·· 3184')).not.toBeInTheDocument()
    expect(
      screen.queryByRole('heading', { name: 'Payment method' })
    ).not.toBeInTheDocument()
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

  it('charges only once the Stripe key is known, so the bank check can run on this page', async () => {
    let releaseKey: (key: string) => void = () => {}
    stripeKey.read = () =>
      new Promise((resolve) => {
        releaseKey = resolve
      })
    const fake = renderTopup({
      topup: {
        status: 'ok',
        operation: settledTopup({ amountChargedCents: 2500 }),
        creditsReconciled: true
      }
    })
    await screen.findByText('Add credits · Acme Team')

    await userEvent.click(payButton())

    expect(fake.createTopupCheckout).not.toHaveBeenCalled()
    releaseKey('pk_test_example')
    await vi.waitFor(() =>
      expect(fake.createTopupCheckout).toHaveBeenCalledOnce()
    )
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

const PAYS_ONCE: TopupQuoteResult = {
  status: 'ok',
  value: {
    amountCents: 2500,
    credits: 5275,
    expiresAt: '2027-09-30T12:00:00.000Z',
    paymentMethodConfigurationId: 'pmc_topup'
  }
}

const VISA: SavedPaymentMethod = {
  id: 'pm_visa',
  type: 'card',
  brand: 'visa',
  last4: '3184',
  is_default: false
}

const MASTERCARD: SavedPaymentMethod = {
  id: 'pm_mc',
  type: 'card',
  brand: 'mastercard',
  last4: '4402',
  is_default: false
}

const ALIPAY: SavedPaymentMethod = {
  id: 'pm_alipay',
  type: 'alipay',
  is_default: true
}

const tab = (name: 'Saved' | 'Add new payment') =>
  screen.getByRole('tab', { name })

const savedPicker = () =>
  screen.getByRole('combobox', { name: 'Choose a saved payment method' })

const SUCCEEDED: TopupResult = {
  status: 'ok',
  operation: settledTopup({ amountChargedCents: 2500, creditsAdded: 5275 }),
  creditsReconciled: true
}

const NO_ANSWER: TopupResult = {
  status: 'error',
  code: 'REQUEST_FAILED',
  httpStatus: 503
}

const topupInFlight = (
  facts: Partial<
    Pick<PendingBillingOperation, 'authenticationState' | 'serverPhase'>
  >
): PendingBillingOperation => ({
  ...pendingOperation('op_topup'),
  kind: 'topup',
  ...facts
})

function readyCardForm() {
  form.emit('phase', { phase: 'payment_element_ready', element: 'payment' })
}

describe('FullPageTopupView paying once', () => {
  beforeEach(() => {
    form.mounts = 0
  })

  it('pays with the saved card the customer picks, though none is the invoice default, and offers only cards', async () => {
    const fake = renderTopup({
      topupQuote: PAYS_ONCE,
      topup: SUCCEEDED,
      paymentMethods: { status: 'ok', value: [ALIPAY, VISA, MASTERCARD] }
    })
    await screen.findByText('Add credits · Acme Team')

    expect(tab('Saved')).toHaveAttribute('aria-selected', 'true')
    await userEvent.click(savedPicker())
    expect(
      screen.queryByRole('option', { name: /Alipay/ })
    ).not.toBeInTheDocument()
    await userEvent.click(await screen.findByRole('option', { name: /4402/ }))
    await userEvent.click(payButton())

    await waitFor(() =>
      expect(fake.createInteractiveTopup).toHaveBeenCalledOnce()
    )
    const [request] = fake.createInteractiveTopup.mock.calls[0]
    expect(request).toMatchObject({
      amountCents: 2500,
      payment: { savedPaymentMethodId: 'pm_mc' }
    })
    expect(request.payment).not.toHaveProperty('confirmationToken')
    expect(fake.createTopupCheckout).not.toHaveBeenCalled()
    expect(
      await screen.findByRole('heading', { name: '5,275 credits added' })
    ).toBeInTheDocument()
  })

  it('pays once with a new card on the quoted configuration and comes back to the same workspace and amount', async () => {
    const fake = renderTopup({
      topupQuote: PAYS_ONCE,
      topup: SUCCEEDED,
      paymentMethods: { status: 'ok', value: [] }
    })
    await screen.findByText('Add credits · Acme Team')
    readyCardForm()

    expect(form.payOnce).toBe(true)
    expect(form.configuration).toBe('pmc_topup')
    form.emit('confirm', 'ctoken_1', 'card')

    await waitFor(() =>
      expect(fake.createInteractiveTopup).toHaveBeenCalledOnce()
    )
    const { payment } = fake.createInteractiveTopup.mock.calls[0][0]
    expect(payment).not.toHaveProperty('savedPaymentMethodId')
    expect(payment).toMatchObject({ confirmationToken: 'ctoken_1' })
    assert('returnUrl' in payment)
    const back = new URL(payment.returnUrl)
    expect(back.pathname).toBe('/v1/top-up')
    expect(back.searchParams.get('amount_cents')).toBe('2500')
    expect(back.searchParams.get('workspace')).toBe('ws-team')
    expect(fake.createTopupCheckout).not.toHaveBeenCalled()
  })

  it('sends nothing for a new method that is not a card, and says a card is needed', async () => {
    const fake = renderTopup({
      topupQuote: PAYS_ONCE,
      paymentMethods: { status: 'ok', value: [] }
    })
    await screen.findByText('Add credits · Acme Team')
    readyCardForm()

    form.emit('confirm', 'ctoken_alipay', 'alipay')

    expect(await screen.findByRole('alert')).toHaveTextContent(
      'Credits can only be paid for with a card.'
    )
    expect(fake.createInteractiveTopup).not.toHaveBeenCalled()
    expect(fake.createTopupCheckout).not.toHaveBeenCalled()
  })

  it('resends the same purchase under the same key until the server answers it, then starts a new one', async () => {
    const fake = renderTopup({
      topupQuote: PAYS_ONCE,
      paymentMethods: { status: 'ok', value: [VISA, MASTERCARD] }
    })
    fake.createInteractiveTopup
      .mockResolvedValueOnce(NO_ANSWER)
      .mockResolvedValueOnce({
        status: 'declined',
        operation: {
          ...failedOperation('card_declined', 'op_topup'),
          phase: 'failed',
          declineReason: 'card_declined',
          retryable: true
        }
      })
      .mockResolvedValueOnce(SUCCEEDED)
    await screen.findByText('Add credits · Acme Team')

    await userEvent.click(payButton())
    await waitFor(() => expect(payButton()).toBeEnabled())
    await userEvent.click(payButton())
    await waitFor(() =>
      expect(screen.getByRole('alert')).toHaveTextContent('Payment declined')
    )
    await userEvent.click(savedPicker())
    await userEvent.click(await screen.findByRole('option', { name: /4402/ }))
    await userEvent.click(payButton())

    await waitFor(() =>
      expect(fake.createInteractiveTopup).toHaveBeenCalledTimes(3)
    )
    const [first, unresolved, fresh] =
      fake.createInteractiveTopup.mock.calls.map(([request]) => request)
    expect(unresolved.idempotencyKey).toBe(first.idempotencyKey)
    expect(unresolved.payment).toStrictEqual(first.payment)
    expect(fresh.idempotencyKey).not.toBe(first.idempotencyKey)
    expect(fresh.payment).toStrictEqual({ savedPaymentMethodId: 'pm_mc' })
  })

  it.for<{ name: string; answer: TopupResult }>([
    { name: 'a 503', answer: NO_ANSWER },
    {
      name: 'no response',
      answer: { status: 'error', code: 'REQUEST_FAILED' }
    },
    {
      name: 'a 429',
      answer: { status: 'error', code: 'REQUEST_FAILED', httpStatus: 429 }
    },
    {
      name: 'a 409',
      answer: { status: 'error', code: 'CONFLICT', httpStatus: 409 }
    }
  ])(
    'keeps the page locked with no card while it re-reads a Pay that got $name, so no other card can be chosen',
    async ({ answer }) => {
      const fake = renderTopup({
        topupQuote: PAYS_ONCE,
        paymentMethods: { status: 'ok', value: [VISA, MASTERCARD] }
      })
      fake.createInteractiveTopup.mockResolvedValueOnce(answer)
      await screen.findByText('Add credits · Acme Team')
      fake.recover.mockImplementation(() => new Promise(() => {}))

      await userEvent.click(payButton())

      await waitFor(() =>
        expect(
          screen.queryByRole('button', { name: 'Back' })
        ).not.toBeInTheDocument()
      )
      expect(payButton()).toBeDisabled()
      expect(payButton()).toHaveAttribute('aria-busy', 'true')
      expect(screen.queryByRole('alert')).not.toBeInTheDocument()
      expect(
        screen.queryByRole('link', { name: 'Contact support' })
      ).not.toBeInTheDocument()
      expect(fake.createInteractiveTopup).toHaveBeenCalledOnce()
    }
  )

  it('goes back to the form with the card still typed in when the re-read finds nothing charged, and Pay resends it under the same key', async () => {
    const fake = renderTopup({
      topupQuote: PAYS_ONCE,
      topup: SUCCEEDED,
      paymentMethods: { status: 'ok', value: [] }
    })
    fake.createInteractiveTopup.mockResolvedValueOnce(NO_ANSWER)
    await screen.findByText('Add credits · Acme Team')
    readyCardForm()
    const recoversBefore = fake.recover.mock.calls.length

    form.emit('confirm', 'ctoken_1', 'card')
    await waitFor(() =>
      expect(fake.recover.mock.calls.length).toBeGreaterThan(recoversBefore)
    )
    await waitFor(() => expect(payButton()).toBeEnabled())

    expect(screen.queryByRole('alert')).not.toBeInTheDocument()
    expect(form.mounts).toBe(1)
    form.emit('confirm', 'ctoken_2', 'card')

    expect(
      await screen.findByRole('heading', { name: '5,275 credits added' })
    ).toBeInTheDocument()
    const [first, resent] = fake.createInteractiveTopup.mock.calls.map(
      ([request]) => request
    )
    expect(resent).toStrictEqual(first)
  })

  it('keeps an unconfirmed purchase on its key when recovery only finds an earlier settled operation', async () => {
    const fake = renderTopup({
      topupQuote: PAYS_ONCE,
      paymentMethods: { status: 'ok', value: [VISA, MASTERCARD] }
    })
    fake.createInteractiveTopup
      .mockResolvedValueOnce(NO_ANSWER)
      .mockResolvedValueOnce(SUCCEEDED)
    await screen.findByText('Add credits · Acme Team')
    fake.recover.mockResolvedValue({
      status: 'ok',
      value: failedOperation('card_declined', 'op_earlier')
    })

    await userEvent.click(payButton())
    await waitFor(() => expect(payButton()).toBeEnabled())

    expect(screen.queryByRole('alert')).not.toBeInTheDocument()
    await userEvent.click(payButton())
    await waitFor(() =>
      expect(fake.createInteractiveTopup).toHaveBeenCalledTimes(2)
    )
    const [first, resent] = fake.createInteractiveTopup.mock.calls.map(
      ([request]) => request
    )
    expect(resent).toStrictEqual(first)
  })

  it.for<{
    name: string
    found: () => BillingResult<BillingOperationState | undefined>
    heading: string
    code?: string
  }>([
    {
      name: 'went through is Success',
      found: () => ({
        status: 'ok',
        value: settledTopup({ amountChargedCents: 2500, creditsAdded: 5275 })
      }),
      heading: "You're all set"
    },
    {
      name: 'the bank is still settling is Payment in progress',
      found: () => ({
        status: 'ok',
        value: topupInFlight({
          authenticationState: 'processing',
          serverPhase: 'in_progress'
        })
      }),
      heading: 'Payment in progress',
      code: 'op_topup'
    },
    {
      name: 'the server parked for a human is We couldn’t confirm your payment',
      found: () => ({
        status: 'ok',
        value: {
          ...unresolvedOperation('reconciliation_needed', 'op_topup'),
          kind: 'topup'
        }
      }),
      heading: "We couldn't confirm your payment",
      code: 'op_topup'
    },
    {
      name: 'cannot be read is We couldn’t confirm your payment',
      found: () => ({ status: 'error', code: 'REQUEST_FAILED' }),
      heading: "We couldn't confirm your payment"
    }
  ])(
    'an unanswered Pay whose re-read $name, with no form',
    async ({ found, heading, code }) => {
      const fake = renderTopup({
        topupQuote: PAYS_ONCE,
        paymentMethods: { status: 'ok', value: [VISA] }
      })
      fake.createInteractiveTopup.mockResolvedValueOnce(NO_ANSWER)
      await screen.findByText('Add credits · Acme Team')
      fake.recover.mockImplementation(async () => found())

      await userEvent.click(payButton())

      expect(
        await screen.findByRole('heading', { name: heading })
      ).toBeInTheDocument()
      expect(
        screen.queryByRole('button', { name: 'Pay' })
      ).not.toBeInTheDocument()
      if (code === undefined)
        expect(
          screen.queryByTestId('checkout-ending-code')
        ).not.toBeInTheDocument()
      else
        expect(screen.getByTestId('checkout-ending-code')).toHaveTextContent(
          code
        )
      expect(fake.createInteractiveTopup).toHaveBeenCalledOnce()
    }
  )

  it('342-4767: an unanswered Pay whose charge is still processing says it cannot be canceled, then lands on Success', async () => {
    const fake = renderTopup({
      topupQuote: PAYS_ONCE,
      paymentMethods: { status: 'ok', value: [VISA] }
    })
    fake.createInteractiveTopup.mockResolvedValueOnce(NO_ANSWER)
    await screen.findByText('Add credits · Acme Team')
    fake.recover.mockResolvedValue({
      status: 'ok',
      value: topupInFlight({ authenticationState: 'processing' })
    })

    await userEvent.click(payButton())

    expect(
      await screen.findByText(
        "This payment is already processing and can't be canceled."
      )
    ).toBeInTheDocument()
    expect(payButton()).toBeDisabled()
    expect(
      screen.queryByRole('link', { name: 'Contact support' })
    ).not.toBeInTheDocument()

    fake.publishOperation(
      settledTopup({ amountChargedCents: 2500, creditsAdded: 5275 })
    )

    expect(
      await screen.findByRole('heading', { name: "You're all set" })
    ).toBeInTheDocument()
    expect(screen.getByText('+5,275')).toBeInTheDocument()
    expect(fake.createInteractiveTopup).toHaveBeenCalledOnce()
  })

  it('a rate-limited Pay that charged nothing shows the couldn’t-be-processed card and keeps its key', async () => {
    const fake = renderTopup({
      topupQuote: PAYS_ONCE,
      paymentMethods: { status: 'ok', value: [VISA] }
    })
    fake.createInteractiveTopup
      .mockResolvedValueOnce({
        status: 'error',
        code: 'REQUEST_FAILED',
        httpStatus: 429
      })
      .mockResolvedValueOnce(SUCCEEDED)
    await screen.findByText('Add credits · Acme Team')
    const recoversBefore = fake.recover.mock.calls.length

    await userEvent.click(payButton())

    expect(await screen.findByRole('alert')).toHaveTextContent(
      "Payment couldn't be processed"
    )
    expect(fake.recover.mock.calls.length).toBeGreaterThan(recoversBefore)
    expect(
      screen.queryByRole('link', { name: 'Contact support' })
    ).not.toBeInTheDocument()
    await userEvent.click(payButton())
    await waitFor(() =>
      expect(fake.createInteractiveTopup).toHaveBeenCalledTimes(2)
    )
    const [first, resent] = fake.createInteractiveTopup.mock.calls.map(
      ([request]) => request
    )
    expect(resent).toStrictEqual(first)
  })

  it('a Pay blocked by a pending operation follows that operation, never a retry card', async () => {
    const fake = renderTopup({
      topupQuote: PAYS_ONCE,
      paymentMethods: { status: 'ok', value: [VISA] }
    })
    fake.createInteractiveTopup.mockResolvedValueOnce({
      status: 'error',
      code: 'CONFLICT',
      httpStatus: 409
    })
    await screen.findByText('Add credits · Acme Team')
    fake.recover.mockResolvedValue({
      status: 'ok',
      value: topupInFlight({ authenticationState: 'processing' })
    })

    await userEvent.click(payButton())

    expect(await screen.findByTestId('checkout-waiting')).toBeInTheDocument()
    expect(screen.queryByRole('alert')).not.toBeInTheDocument()
    expect(payButton()).toBeDisabled()
    expect(fake.createInteractiveTopup).toHaveBeenCalledOnce()
  })

  it('keeps an unanswered purchase on its key when the pending operation recovery found is declined, since nothing ties that operation to this Pay', async () => {
    const fake = renderTopup({
      topupQuote: PAYS_ONCE,
      paymentMethods: { status: 'ok', value: [VISA] }
    })
    fake.createInteractiveTopup
      .mockResolvedValueOnce(NO_ANSWER)
      .mockResolvedValueOnce(SUCCEEDED)
    await screen.findByText('Add credits · Acme Team')
    fake.recover.mockResolvedValueOnce({
      status: 'ok',
      value: topupInFlight({ authenticationState: 'processing' })
    })

    await userEvent.click(payButton())
    await screen.findByText(
      "This payment is already processing and can't be canceled."
    )
    fake.recover.mockResolvedValue({ status: 'ok', value: undefined })
    fake.publishOperation({
      ...failedOperation('card_declined', 'op_topup'),
      kind: 'topup'
    })

    await waitFor(() => expect(payButton()).toBeEnabled())
    expect(screen.queryByRole('alert')).not.toBeInTheDocument()
    await userEvent.click(payButton())
    await waitFor(() =>
      expect(fake.createInteractiveTopup).toHaveBeenCalledTimes(2)
    )
    const [first, resent] = fake.createInteractiveTopup.mock.calls.map(
      ([request]) => request
    )
    expect(resent).toStrictEqual(first)
  })

  it.for([1, 2])(
    'a return from the bank check (%i loads) follows the operation already under way and pays nothing again',
    async (loads) => {
      const fakes = Array.from({ length: loads }, () =>
        renderTopup({
          topupQuote: PAYS_ONCE,
          paymentMethods: { status: 'ok', value: [VISA] },
          recover: {
            status: 'ok',
            value: { ...pendingOperation('op_topup'), kind: 'topup' }
          }
        })
      )

      expect(
        (await screen.findAllByTestId('checkout-waiting')).length
      ).toBeGreaterThan(0)
      expect(
        fakes.map((fake) => ({
          recovered: fake.recover.mock.calls.length > 0,
          paidInteractively: fake.createInteractiveTopup.mock.calls.length,
          openedCheckout: fake.createTopupCheckout.mock.calls.length
        }))
      ).toStrictEqual(
        fakes.map(() => ({
          recovered: true,
          paidInteractively: 0,
          openedCheckout: 0
        }))
      )
    }
  )

  it('keeps charging the method on file when the quote names no payment configuration', async () => {
    const fake = renderTopup({
      topup: SUCCEEDED,
      paymentMethods: { status: 'ok', value: [{ ...VISA, is_default: true }] }
    })
    await screen.findByText('Add credits · Acme Team')

    expect(screen.queryByRole('tab')).not.toBeInTheDocument()
    expect(form.mounts).toBe(0)
    await userEvent.click(payButton())

    await waitFor(() => expect(fake.createTopupCheckout).toHaveBeenCalledOnce())
    expect(fake.createInteractiveTopup).not.toHaveBeenCalled()
  })

  it.for<{ name: string; read: () => Promise<Response | undefined> }>([
    {
      name: 'unified_billing_settings is off',
      read: unifiedBillingSettings(false)
    },
    {
      name: 'the flag read fails',
      read: () => Promise.reject(new TypeError('Failed to fetch'))
    },
    {
      name: 'the flag read answers a server error',
      read: async () =>
        new Response(JSON.stringify({ unified_billing_settings: true }), {
          status: 500
        })
    }
  ])(
    'charges the method on file for a paying-once quote when $name',
    async ({ read }) => {
      serveFeatures(read)
      const fake = renderTopup({
        topupQuote: PAYS_ONCE,
        topup: SUCCEEDED,
        paymentMethods: { status: 'ok', value: [{ ...VISA, is_default: true }] }
      })
      await screen.findByText('Add credits · Acme Team')

      expect(screen.queryByRole('tab')).not.toBeInTheDocument()
      expect(form.mounts).toBe(0)
      await userEvent.click(payButton())

      await waitFor(() =>
        expect(fake.createTopupCheckout).toHaveBeenCalledOnce()
      )
      expect(fake.createInteractiveTopup).not.toHaveBeenCalled()
    }
  )
})
