import userEvent from '@testing-library/user-event'
import { render, screen, waitFor } from '@testing-library/vue'
import { nextTick, ref } from 'vue'
import type { VNode } from 'vue'

import type {
  PreviewSubscribeResult,
  SavedPaymentMethod
} from '@comfyorg/account-core/billing'
import { readBillingErrorCode } from '@comfyorg/account-core/billing'
import type { AccountCredential } from '@comfyorg/account-core/session'
import { BILLING_CLIENT_KEY } from '@comfyorg/account-ui/billing'
import type { StripePaymentPhase } from '@comfyorg/account-ui/billing/stripe'
import { parseBillingEntry } from '@comfyorg/billing-contract'

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
  previewOf
} from '@/test/fakeBillingClient'
import FullPageCheckoutView from '@/views/FullPageCheckoutView.vue'

const CHECKOUT_PATH =
  '/v1/checkout?product=comfyui&return_to=comfyui_workspace&plan=creator_monthly'

vi.mock<unknown>(import('@/config/env'), () => ({
  BILLING_WEB_ENV: 'test',
  CLOUD_BASE_URL: 'https://testcloud.comfy.org'
}))

vi.mock(import('@/config/stripeKey'), () => ({
  awaitBillingWebStripeKey: () => Promise.resolve('pk_test_example'),
  useBillingWebStripeKey: () => ref('pk_test_example')
}))

vi.mock(import('@/session/stripeChallengePort'), () => ({
  createDeferredStripeChallengePort: () => ({
    handleNextAction: async () => ({})
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

/** The provider form is covered in its package; here it reports phases and hands back a token. */
const form = vi.hoisted(() => ({
  mounts: 0,
  emit: (() => {}) as (event: string, payload: unknown) => void
}))

vi.mock<unknown>(import('@comfyorg/account-ui/billing/stripe'), async () => {
  const { h } = await import('vue')
  return {
    StripePaymentForm: {
      name: 'StripePaymentForm',
      props: {
        canSubmit: { type: Boolean, default: true },
        isLoading: { type: Boolean, default: false }
      },
      emits: ['confirm', 'phase'],
      setup(
        props: { canSubmit: boolean; isLoading: boolean },
        {
          emit,
          slots
        }: {
          emit: (event: string, payload: unknown) => void
          slots: { submit?: (slotProps: Record<string, unknown>) => VNode[] }
        }
      ) {
        form.mounts += 1
        form.emit = emit
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

function reportPhase(phase: StripePaymentPhase) {
  form.emit('phase', phase)
}

async function renderCheckout(
  options: FakeBillingClientOptions = {},
  arrange: (fake: FakeBillingClient) => void = () => {},
  path = CHECKOUT_PATH
) {
  recordBillingEntry(parseBillingEntry(path))
  const fake = createFakeBillingClient({
    preview: { status: 'ok', value: previewOf({ quote_id: 'q_1' }) },
    capabilities: { can_subscribe_self_serve: true },
    ...options
  })
  arrange(fake)
  render(FullPageCheckoutView, {
    global: {
      plugins: [createBillingI18n()],
      provide: { [BILLING_CLIENT_KEY]: fake.client }
    }
  })
  return fake
}

const payButton = () =>
  screen.getByRole('button', { name: 'Pay and subscribe' })

describe('FullPageCheckoutView', () => {
  beforeEach(() => {
    form.mounts = 0
  })

  it('holds the skeleton with Pay disabled until the quote and the element are both ready', async () => {
    let answerQuote: (result: PreviewSubscribeResult) => void = () => {}
    await renderCheckout({}, (fake) =>
      fake.previewSubscribe.mockImplementation(
        () => new Promise((resolve) => (answerQuote = resolve))
      )
    )

    expect(screen.getByText('Loading…')).toBeInTheDocument()
    expect(screen.getByText('Total due today')).toBeInTheDocument()
    expect(payButton()).toBeDisabled()
    expect(form.mounts).toBe(0)

    answerQuote({ status: 'ok', value: previewOf() })

    expect(
      await screen.findByText('Subscribe to Creator Plan · Acme Team')
    ).toBeInTheDocument()
    expect(screen.getAllByText('$28.00')).toHaveLength(2)
    expect(screen.queryByText('Loading…')).not.toBeInTheDocument()
    expect(payButton()).toBeDisabled()

    reportPhase({ phase: 'payment_element_ready', element: 'address' })
    await nextTick()
    expect(payButton()).toBeDisabled()

    reportPhase({ phase: 'payment_element_ready', element: 'payment' })
    await waitFor(() => expect(payButton()).toBeEnabled())
  })

  it('subscribes with the quoted plan and the confirmation token on Pay', async () => {
    const fake = await renderCheckout()
    await screen.findByText('Subscribe to Creator Plan · Acme Team')
    reportPhase({ phase: 'payment_element_ready', element: 'payment' })

    form.emit('confirm', 'ctoken_1')

    await waitFor(() =>
      expect(fake.subscribe).toHaveBeenCalledWith(
        expect.objectContaining({
          plan_slug: 'creator_monthly',
          confirmation_token: 'ctoken_1',
          quote_id: 'q_1'
        })
      )
    )
  })

  it('charges a plan change to the method on file without mounting the card form', async () => {
    const fake = await renderCheckout({
      preview: {
        status: 'ok',
        value: previewOf({ transition_type: 'upgrade' })
      }
    })
    await screen.findByText('Subscribe to Creator Plan · Acme Team')

    expect(form.mounts).toBe(0)
    await userEvent.click(payButton())

    await waitFor(() => expect(fake.subscribe).toHaveBeenCalledOnce())
    expect(fake.subscribe.mock.calls[0][0]).not.toHaveProperty(
      'confirmation_token'
    )
  })

  it.for<Extract<StripePaymentPhase, { phase: 'payment_element_failed' }>>([
    {
      phase: 'payment_element_failed',
      element: 'payment',
      element_phase: 'init'
    },
    {
      phase: 'payment_element_failed',
      element: 'payment',
      element_phase: 'mount'
    },
    {
      phase: 'payment_element_failed',
      element: 'address',
      element_phase: 'mount'
    },
    {
      phase: 'payment_element_failed',
      element: 'payment',
      element_phase: 'update'
    }
  ])(
    'replaces the whole payment column when the $element element fails at $element_phase, and Try again remounts it',
    async (failure) => {
      await renderCheckout()
      await screen.findByText('Subscribe to Creator Plan · Acme Team')
      reportPhase(failure)

      expect(
        await screen.findByText("The payment form couldn't load")
      ).toBeInTheDocument()
      expect(
        screen.queryByRole('button', { name: 'Pay and subscribe' })
      ).not.toBeInTheDocument()
      expect(
        screen.getByText('Subscribe to Creator Plan · Acme Team')
      ).toBeInTheDocument()

      await userEvent.click(screen.getByRole('button', { name: 'Try again' }))

      expect(form.mounts).toBe(2)
      expect(
        screen.queryByText("The payment form couldn't load")
      ).not.toBeInTheDocument()
      expect(payButton()).toBeDisabled()
    }
  )

  it('ignores a confirm that arrives before the element is ready', async () => {
    const fake = await renderCheckout()
    await screen.findByText('Subscribe to Creator Plan · Acme Team')

    form.emit('confirm', 'ctoken_early')
    await nextTick()

    expect(fake.subscribe).not.toHaveBeenCalled()
  })

  it('keeps Pay disabled for a quote the server does not allow', async () => {
    await renderCheckout({
      preview: { status: 'ok', value: previewOf({ allowed: false }) }
    })
    await screen.findByText('Subscribe to Creator Plan · Acme Team')
    reportPhase({ phase: 'payment_element_ready', element: 'payment' })
    await nextTick()

    expect(payButton()).toBeDisabled()
  })

  it('locks Pay once an operation is in flight, so a second click cannot charge twice', async () => {
    const fake = await renderCheckout({
      preview: {
        status: 'ok',
        value: previewOf({ transition_type: 'upgrade' })
      }
    })
    await screen.findByText('Subscribe to Creator Plan · Acme Team')
    expect(payButton()).toBeEnabled()

    fake.publishOperation(pendingOperation())

    await waitFor(() => expect(payButton()).toBeDisabled())
  })

  it.for<{
    name: string
    options: FakeBillingClientOptions
    arrange: (fake: FakeBillingClient) => void
  }>([
    {
      name: 'the capabilities read',
      options: {},
      arrange: (fake) =>
        fake.readCapabilities.mockResolvedValue({
          status: 'error',
          code: 'REQUEST_FAILED'
        })
    },
    {
      name: 'the quote',
      options: { preview: { status: 'error', code: 'REQUEST_FAILED' } },
      arrange: () => {}
    }
  ])(
    'says so instead of capture when $name fails',
    async ({ options, arrange }) => {
      await renderCheckout(options, arrange)

      expect(
        await screen.findByText(
          "We couldn't reach the billing service. Please try again."
        )
      ).toBeInTheDocument()
      expect(
        screen.queryByRole('button', { name: 'Pay and subscribe' })
      ).not.toBeInTheDocument()
    }
  )

  it('renders the refusal instead of capture when the capability is denied', async () => {
    await renderCheckout({ capabilities: {} })

    expect(
      await screen.findByRole('heading', {
        name: "You can't subscribe from this account"
      })
    ).toBeInTheDocument()
    expect(
      screen.queryByRole('button', { name: 'Pay and subscribe' })
    ).not.toBeInTheDocument()
    expect(form.mounts).toBe(0)
  })

  it.for<{ name: string; returnTo: string; href: string }>([
    {
      name: 'the product that sent the customer, in the billed workspace',
      returnTo: 'comfyui_workspace',
      href: 'https://testcloud.comfy.org/?workspace=ws-team'
    },
    {
      name: "the workspace's Plan & Credits settings when this family has no destination for the target",
      returnTo: 'platform_account',
      href: 'https://testcloud.comfy.org/?settings=plan-credits&workspace=ws-team'
    }
  ])('the back arrow goes to $name', async ({ returnTo, href }) => {
    const assign = vi
      .spyOn(window.location, 'assign')
      .mockImplementation(() => {})
    await renderCheckout(
      {},
      () => {},
      `/v1/checkout?product=comfyui&return_to=${returnTo}&plan=creator_monthly`
    )
    await screen.findByText('Subscribe to Creator Plan · Acme Team')

    await userEvent.click(screen.getByRole('button', { name: 'Back' }))

    expect(assign).toHaveBeenCalledWith(href)
  })
})

const VISA: SavedPaymentMethod = {
  id: 'pm_visa',
  type: 'card',
  brand: 'visa',
  last4: '4242',
  is_default: false
}
const MASTERCARD: SavedPaymentMethod = {
  id: 'pm_mastercard',
  type: 'card',
  brand: 'mastercard',
  last4: '4402',
  is_default: true
}

const tab = (name: 'Saved' | 'Add new payment') =>
  screen.getByRole('tab', { name })

async function renderQuoted(options: FakeBillingClientOptions = {}) {
  const fake = await renderCheckout(options)
  await screen.findByText('Subscribe to Creator Plan · Acme Team')
  return fake
}

describe('FullPageCheckoutView saved methods and rail failures', () => {
  beforeEach(() => {
    form.mounts = 0
  })

  it('opens on Saved with the default method and charges it without a card token', async () => {
    const fake = await renderQuoted({
      paymentMethods: { status: 'ok', value: [VISA, MASTERCARD] }
    })

    expect(tab('Saved')).toHaveAttribute('aria-selected', 'true')
    expect(screen.getByRole('combobox')).toBeInTheDocument()
    await userEvent.click(payButton())

    await waitFor(() => expect(fake.subscribe).toHaveBeenCalledOnce())
    const request = fake.subscribe.mock.calls[0][0]
    expect(request).toMatchObject({ saved_payment_method_id: 'pm_mastercard' })
    expect(request).not.toHaveProperty('confirmation_token')
  })

  it('shows a single saved method as a row, not a picker', async () => {
    await renderQuoted({ paymentMethods: { status: 'ok', value: [VISA] } })

    expect(screen.getByText('visa •••• 4242')).toBeInTheDocument()
    expect(screen.queryByRole('combobox')).not.toBeInTheDocument()
  })

  it('keeps the card form mounted across tab switches, so typed details survive', async () => {
    const fake = await renderQuoted({
      paymentMethods: { status: 'ok', value: [VISA] }
    })
    reportPhase({ phase: 'payment_element_ready', element: 'payment' })

    await userEvent.click(tab('Add new payment'))
    await userEvent.click(tab('Saved'))
    await userEvent.click(tab('Add new payment'))
    form.emit('confirm', 'ctoken_new')

    expect(form.mounts).toBe(1)
    await waitFor(() =>
      expect(fake.subscribe).toHaveBeenCalledWith(
        expect.objectContaining({ confirmation_token: 'ctoken_new' })
      )
    )
    expect(fake.subscribe.mock.calls[0][0]).not.toHaveProperty(
      'saved_payment_method_id'
    )
  })

  it('368-15401: a failed saved read errors on Saved only, hides the address, and Try again reads again', async () => {
    const fake = await renderQuoted({
      paymentMethods: { status: 'error', code: 'REQUEST_FAILED' }
    })
    reportPhase({ phase: 'payment_element_ready', element: 'payment' })

    expect(tab('Saved')).toHaveAttribute('aria-selected', 'true')
    expect(
      screen.getByText("Your saved payment methods couldn't load")
    ).toBeInTheDocument()
    expect(
      screen.queryByRole('button', { name: 'Pay and subscribe' })
    ).not.toBeInTheDocument()

    await userEvent.click(tab('Add new payment'))
    expect(payButton()).toBeEnabled()

    await userEvent.click(tab('Saved'))
    fake.readPaymentMethods.mockResolvedValueOnce({
      status: 'ok',
      value: {
        scope: { userId: 'uid-1', workspaceId: 'ws-1', role: 'owner' },
        methods: [VISA],
        readAt: 0
      }
    })
    await userEvent.click(screen.getByRole('button', { name: 'Try again' }))

    expect(await screen.findByText('visa •••• 4242')).toBeInTheDocument()
    expect(tab('Saved')).toHaveAttribute('aria-selected', 'true')
    expect(payButton()).toBeEnabled()
    expect(form.mounts).toBe(1)
  })

  it('368-15319: a failed element beside saved methods errors on Add new only, and Saved stays payable', async () => {
    await renderQuoted({ paymentMethods: { status: 'ok', value: [VISA] } })
    reportPhase({
      phase: 'payment_element_failed',
      element: 'payment',
      element_phase: 'mount'
    })
    await nextTick()

    expect(tab('Saved')).toHaveAttribute('aria-selected', 'true')
    expect(payButton()).toBeEnabled()

    await userEvent.click(tab('Add new payment'))
    expect(
      screen.getByText(
        'Nothing has been charged. Check your connection and try again, or pay with a saved payment method.'
      )
    ).toBeInTheDocument()

    await userEvent.click(screen.getByRole('button', { name: 'Try again' }))

    expect(form.mounts).toBe(2)
    expect(tab('Add new payment')).toHaveAttribute('aria-selected', 'true')
    expect(payButton()).toBeDisabled()
  })

  it('takes the whole column when both rails are down, and Try again retries both', async () => {
    const fake = await renderQuoted({
      paymentMethods: { status: 'error', code: 'REQUEST_FAILED' }
    })
    reportPhase({
      phase: 'payment_element_failed',
      element: 'payment',
      element_phase: 'init'
    })

    expect(
      await screen.findByText(
        'Nothing has been charged. Check your connection and try again — your order details are unaffected.'
      )
    ).toBeInTheDocument()
    expect(screen.queryByRole('tab')).not.toBeInTheDocument()
    expect(fake.readPaymentMethods).toHaveBeenCalledOnce()

    await userEvent.click(screen.getByRole('button', { name: 'Try again' }))

    expect(form.mounts).toBe(2)
    await waitFor(() =>
      expect(fake.readPaymentMethods).toHaveBeenCalledTimes(2)
    )
  })
})

const payReady = async (options: FakeBillingClientOptions = {}) => {
  const fake = await renderQuoted(options)
  reportPhase({ phase: 'payment_element_ready', element: 'payment' })
  await waitFor(() => expect(payButton()).toBeEnabled())
  return fake
}

describe('FullPageCheckoutView outcomes after Pay', () => {
  beforeEach(() => {
    form.mounts = 0
  })

  it('puts a decline above Pay with its reason, keeps the typed form, and clears it on the next Pay', async () => {
    const fake = await payReady({
      subscribe: {
        status: 'ok',
        value: {
          phase: 'failed',
          operation: failedOperation('insufficient_funds', 'op_declined')
        }
      }
    })

    form.emit('confirm', 'ctoken_1')

    const card = await screen.findByRole('alert')
    expect(card).toHaveTextContent('Payment declined')
    expect(card).toHaveTextContent('Reported issue: Insufficient funds')
    expect(card).toHaveFocus()
    const support = screen.getByRole('link', { name: 'Contact support' })
    expect(support.getAttribute('href')).toContain('op_declined')
    expect(support.getAttribute('href')).toContain('insufficient_funds')
    expect(form.mounts).toBe(1)
    await waitFor(() => expect(payButton()).toBeEnabled())

    fake.subscribe.mockResolvedValueOnce({
      status: 'ok',
      value: { phase: 'succeeded' }
    })
    form.emit('confirm', 'ctoken_2')

    await waitFor(() =>
      expect(screen.queryByText('Payment declined')).not.toBeInTheDocument()
    )
    expect(
      screen.queryByRole('link', { name: 'Contact support' })
    ).not.toBeInTheDocument()
    expect(fake.subscribe).toHaveBeenCalledTimes(2)
  })

  it.for<{
    name: string
    declineReason: 'authentication_failed' | 'processing_error'
    title: string
  }>([
    {
      name: 'a challenge the customer did not complete',
      declineReason: 'authentication_failed',
      title: 'Payment not completed'
    },
    {
      name: 'a processing fault',
      declineReason: 'processing_error',
      title: "Payment couldn't be processed"
    }
  ])(
    'names $name in its own card, with no reason line',
    async ({ declineReason, title }) => {
      await payReady({
        subscribe: {
          status: 'ok',
          value: { phase: 'failed', operation: failedOperation(declineReason) }
        }
      })

      form.emit('confirm', 'ctoken_1')

      const card = await screen.findByRole('alert')
      expect(card).toHaveTextContent(title)
      expect(card).not.toHaveTextContent('Reported issue')
      expect(payButton()).toBeInTheDocument()
    }
  )

  it.for<{ name: string; code: 'OPERATION_ALREADY_PENDING' | 'CONFLICT' }>([
    { name: 'an operation already pending', code: 'OPERATION_ALREADY_PENDING' },
    { name: 'a server conflict', code: 'CONFLICT' }
  ])(
    'never shows a decline for $name, and keeps Pay locked',
    async ({ code }) => {
      const fake = await payReady({ subscribe: { status: 'error', code } })

      form.emit('confirm', 'ctoken_1')

      await waitFor(() => expect(fake.subscribe).toHaveBeenCalledOnce())
      await waitFor(() => expect(payButton()).toBeDisabled())
      expect(screen.queryByRole('alert')).not.toBeInTheDocument()
      expect(
        screen.queryByRole('link', { name: 'Contact support' })
      ).not.toBeInTheDocument()
    }
  )

  it('re-prices an expired quote and says so, without charging', async () => {
    const fake = await payReady({
      subscribe: {
        status: 'error',
        code: 'CONFLICT',
        serverCode: readBillingErrorCode({
          code: 'PRORATION_QUOTE_EXPIRED',
          message: 'expired'
        })
      }
    })
    fake.previewSubscribe.mockResolvedValueOnce({
      status: 'ok',
      value: previewOf({ amount_due_cents: 3100 })
    })

    form.emit('confirm', 'ctoken_1')

    expect(await screen.findByRole('alert')).toHaveTextContent(
      'The price has updated'
    )
    expect(fake.previewSubscribe).toHaveBeenCalledTimes(2)
    expect(form.mounts).toBe(1)
    expect(payButton()).toBeEnabled()
  })

  it('553-9297: a plan change on a plan set to end asks to keep it; Pay without the tick sends nothing, with it sends the consent', async () => {
    const fake = await renderCheckout({
      preview: {
        status: 'ok',
        value: previewOf({
          transition_type: 'upgrade',
          requires_reactivation_confirmation: true,
          cost_next_period_cents: 10_000,
          renewal_at: '2026-07-28T00:00:00.000Z'
        })
      },
      status: {
        is_active: true,
        has_funds: true,
        max_seats: 1,
        occupied_seats: 1,
        scheduled_change: null,
        team_credit_stop: null,
        cancel_at: '2026-07-28T00:00:00.000Z'
      }
    })
    await screen.findByText('Subscribe to Creator Plan · Acme Team')

    expect(
      await screen.findByText('Your plan was set to end on July 28, 2026')
    ).toBeInTheDocument()
    expect(
      screen.getByText(
        'Upgrading keeps your subscription, and it renews that day at $100.00.'
      )
    ).toBeInTheDocument()
    const box = screen.getByRole('checkbox', {
      name: 'Keep my subscription and renew it'
    })
    expect(payButton()).toBeEnabled()

    await userEvent.click(payButton())

    expect(fake.subscribe).not.toHaveBeenCalled()
    expect(box).toHaveAttribute('aria-invalid', 'true')
    expect(box).toHaveFocus()
    expect(box).toHaveAccessibleDescription(
      'Check the box to keep your subscription, then pay.'
    )
    expect(payButton()).toBeEnabled()

    await userEvent.click(box)

    expect(box).toHaveAttribute('aria-invalid', 'false')
    expect(screen.queryByRole('alert')).not.toBeInTheDocument()

    await userEvent.click(payButton())

    await waitFor(() =>
      expect(fake.subscribe).toHaveBeenCalledWith(
        expect.objectContaining({ confirm_reactivation: true })
      )
    )
  })

  it('a token the form hands over without the tick sends nothing either', async () => {
    const fake = await payReady({
      preview: {
        status: 'ok',
        value: previewOf({ requires_reactivation_confirmation: true })
      }
    })

    form.emit('confirm', 'ctoken_1')
    await nextTick()

    expect(fake.subscribe).not.toHaveBeenCalled()
    expect(screen.getByRole('checkbox')).toHaveAttribute('aria-invalid', 'true')
  })

  it('re-quotes and asks unticked when the server wants the consent, with Pay still live', async () => {
    const fake = await payReady({
      subscribe: { status: 'error', code: 'REACTIVATION_CONFIRMATION_REQUIRED' }
    })

    form.emit('confirm', 'ctoken_1')

    expect(await screen.findByRole('checkbox')).not.toBeChecked()
    expect(fake.previewSubscribe).toHaveBeenCalledTimes(2)
    expect(fake.readStatus).toHaveBeenCalledOnce()
    expect(payButton()).toBeEnabled()
    expect(screen.queryByRole('alert')).not.toBeInTheDocument()
  })

  it.for<{ name: string; subscribe: FakeBillingClientOptions['subscribe'] }>([
    {
      name: 'an expired quote',
      subscribe: {
        status: 'error',
        code: 'CONFLICT',
        serverCode: readBillingErrorCode({
          code: 'PRORATION_QUOTE_EXPIRED',
          message: 'expired'
        })
      }
    },
    {
      name: 'a consent the server wants',
      subscribe: { status: 'error', code: 'REACTIVATION_CONFIRMATION_REQUIRED' }
    }
  ])(
    'leaves no Pay over the refused price when re-quoting $name fails',
    async ({ subscribe }) => {
      const fake = await payReady({ subscribe })
      fake.previewSubscribe.mockResolvedValueOnce({
        status: 'error',
        code: 'REQUEST_FAILED'
      })

      form.emit('confirm', 'ctoken_1')

      expect(
        await screen.findByText(
          "We couldn't reach the billing service. Please try again."
        )
      ).toBeInTheDocument()
      expect(fake.previewSubscribe).toHaveBeenCalledTimes(2)
      expect(fake.subscribe).toHaveBeenCalledOnce()
      expect(
        screen.queryByRole('button', { name: 'Pay and subscribe' })
      ).not.toBeInTheDocument()
    }
  )
})
