import userEvent from '@testing-library/user-event'
import { render, screen, waitFor } from '@testing-library/vue'
import { createMemoryHistory, createRouter } from 'vue-router'

import { BILLING_CLIENT_KEY } from '@comfyorg/account-ui/billing'
import { parseBillingEntry } from '@comfyorg/billing-contract'

import { recordBillingEntry } from '@/entry/billingEntry'
import { createBillingI18n } from '@/i18n'
import type { FakeBillingClientOptions } from '@/test/fakeBillingClient'
import {
  createFakeBillingClient,
  failedOperation,
  previewOf,
  succeededOperation
} from '@/test/fakeBillingClient'
import CheckoutView from '@/views/CheckoutView.vue'

const ENTRY_QUERY = 'product=comfyui&return_to=comfyui_workspace'
const CHECKOUT_PATH = `/v1/checkout?${ENTRY_QUERY}&plan=creator_monthly`

/** The two values the view and its surface read; a test-family key stands in for a deployment's. */
vi.mock<unknown>(import('@/config/env'), () => ({
  BILLING_WEB_ENV: 'test',
  STRIPE_PUBLISHABLE_KEY: 'pk_test_example'
}))

vi.mock(import('@/session/stripeChallengePort'), () => ({
  createStripeChallengePort: () => ({
    handleNextAction: () => Promise.resolve({})
  })
}))

/**
 * The provider form is covered in the package against the real Stripe mocks.
 * Here it records what it was handed and lets a test hand back a token.
 */
const formProps = vi.hoisted(() => ({ value: {} as Record<string, unknown> }))
let reportConfirm: (confirmationToken: string) => void = () => {}

vi.mock<unknown>(import('@comfyorg/account-ui/billing/stripe'), () => ({
  StripePaymentForm: {
    name: 'StripePaymentForm',
    props: {
      publishableKey: { type: String, default: '' },
      amountCents: { type: Number, default: 0 },
      currency: { type: String, default: '' },
      copy: { type: Object, default: () => ({}) },
      paymentMethodConfigurationId: { type: String, default: '' },
      isLoading: { type: Boolean, default: false },
      canSubmit: { type: Boolean, default: true }
    },
    emits: ['confirm', 'submittingChange', 'phase'],
    setup(
      props: Record<string, unknown>,
      {
        emit,
        slots
      }: {
        emit: (event: string, payload: unknown) => void
        slots: { submit?: (slotProps: Record<string, unknown>) => unknown }
      }
    ) {
      formProps.value = props
      reportConfirm = (token) => emit('confirm', token)
      return () =>
        slots.submit?.({ disabled: !props.canSubmit, loading: props.isLoading })
    }
  }
}))

async function renderCheckout(
  path = CHECKOUT_PATH,
  options: FakeBillingClientOptions = {}
) {
  recordBillingEntry(parseBillingEntry(path))
  const router = createRouter({
    history: createMemoryHistory(),
    routes: [
      { path: '/v1/checkout', component: CheckoutView },
      { path: '/v1/subscription', component: { template: '<div />' } }
    ]
  })
  const fake = createFakeBillingClient({
    preview: {
      status: 'ok',
      value: previewOf({ quote_id: 'q_1', quote_version: 3 })
    },
    ...options
  })
  await router.push(path)
  await router.isReady()
  render(CheckoutView, {
    global: {
      plugins: [createBillingI18n(), router],
      provide: { [BILLING_CLIENT_KEY]: fake.client }
    }
  })
  return { ...fake, router }
}

function stubNavigation() {
  const assign = vi.fn()
  vi.spyOn(window.location, 'assign').mockImplementation(assign)
  return assign
}

describe('CheckoutView', () => {
  it('quotes the plan the link names and prices the summary from it', async () => {
    const fake = await renderCheckout()

    expect(await screen.findByText('Creator · Monthly')).toBeInTheDocument()
    expect(fake.previewSubscribe).toHaveBeenCalledWith(
      { planSlug: 'creator_monthly' },
      expect.anything()
    )
    expect(screen.getAllByText('$28.00')).toHaveLength(2)
    expect(screen.getByText('USD per month')).toBeInTheDocument()
    expect(screen.getByText('$69.00')).toBeInTheDocument()
  })

  it("hands the form the quote and this deployment's key", async () => {
    await renderCheckout()

    await screen.findByRole('button', { name: 'Pay and subscribe' })

    expect(formProps.value).toMatchObject({
      publishableKey: 'pk_test_example',
      amountCents: 2800,
      currency: 'usd',
      canSubmit: true
    })
  })

  it('subscribes with the token, the quote identity and a way back here', async () => {
    const fake = await renderCheckout()
    await screen.findByRole('button', { name: 'Pay and subscribe' })

    reportConfirm('ctoken_1')

    await waitFor(() =>
      expect(fake.subscribe).toHaveBeenCalledWith({
        plan_slug: 'creator_monthly',
        confirmation_token: 'ctoken_1',
        quote_id: 'q_1',
        quote_version: 3,
        return_url: expect.stringContaining(
          '/v1/result?product=comfyui&return_to=comfyui_workspace&plan=creator_monthly'
        )
      })
    )
  })

  it('shows the completed state and carries the outcome on the way back', async () => {
    await renderCheckout(CHECKOUT_PATH, {
      subscribe: {
        status: 'ok',
        value: { phase: 'succeeded', operation: succeededOperation('op_9') }
      }
    })
    await screen.findByRole('button', { name: 'Pay and subscribe' })

    reportConfirm('ctoken_1')

    expect(
      await screen.findByRole('heading', { name: "You're all set" })
    ).toBeInTheDocument()
    const back = screen.getByRole('link', { name: 'Return to ComfyUI' })
    expect(back).toHaveAttribute(
      'href',
      'https://testcloud.comfy.org/?billing_result=success&billing_ref=op_9'
    )
  })

  it('keeps a declined customer on the page with the form one click away', async () => {
    await renderCheckout(CHECKOUT_PATH, {
      subscribe: {
        status: 'ok',
        value: {
          phase: 'failed',
          operation: failedOperation('card_declined')
        }
      }
    })
    await screen.findByRole('button', { name: 'Pay and subscribe' })

    reportConfirm('ctoken_1')

    const declined = await screen.findByRole('region', {
      name: 'Payment declined'
    })
    expect(declined).toHaveAttribute('data-billing-step', 'declined')
    expect(
      screen.queryByRole('button', { name: 'Pay and subscribe' })
    ).not.toBeInTheDocument()

    await userEvent.click(screen.getByRole('button', { name: 'Try again' }))

    expect(
      await screen.findByRole('button', { name: 'Pay and subscribe' })
    ).toBeInTheDocument()
  })

  it('holds the pay action until a reactivation charge the quote names is confirmed', async () => {
    const fake = await renderCheckout(CHECKOUT_PATH, {
      preview: {
        status: 'ok',
        value: previewOf({ requires_reactivation_confirmation: true })
      }
    })
    const pay = await screen.findByRole('button', { name: 'Pay and subscribe' })
    expect(pay).toBeDisabled()

    await userEvent.click(
      screen.getByRole('checkbox', {
        name: 'Your subscription was cancelled. I confirm the $28.00 charge to reactivate it.'
      })
    )
    expect(pay).toBeEnabled()
    reportConfirm('ctoken_1')

    await waitFor(() =>
      expect(fake.subscribe).toHaveBeenCalledWith(
        expect.objectContaining({ confirm_reactivation: true })
      )
    )
  })

  it('re-quotes and asks when the server, not the quote, demands the confirmation', async () => {
    const fake = await renderCheckout()
    fake.subscribe.mockResolvedValueOnce({
      status: 'error',
      code: 'REACTIVATION_CONFIRMATION_REQUIRED'
    })
    await screen.findByRole('button', { name: 'Pay and subscribe' })

    reportConfirm('ctoken_1')

    const confirmBox = await screen.findByRole('checkbox')
    expect(fake.previewSubscribe).toHaveBeenCalledTimes(2)
    expect(
      screen.getByRole('button', { name: 'Pay and subscribe' })
    ).toBeDisabled()
    expect(fake.subscribe).toHaveBeenCalledTimes(1)

    await userEvent.click(confirmBox)
    reportConfirm('ctoken_2')

    await waitFor(() => expect(fake.subscribe).toHaveBeenCalledTimes(2))
    expect(fake.subscribe).toHaveBeenLastCalledWith(
      expect.objectContaining({
        confirmation_token: 'ctoken_2',
        confirm_reactivation: true
      })
    )
  })

  it('tells the customer when the subscribe itself was refused and keeps the form', async () => {
    await renderCheckout(CHECKOUT_PATH, {
      subscribe: { status: 'error', code: 'REQUEST_FAILED' }
    })
    await screen.findByRole('button', { name: 'Pay and subscribe' })

    reportConfirm('ctoken_1')

    expect(
      await screen.findByText(
        "We couldn't reach the billing service. Please try again."
      )
    ).toBeInTheDocument()
    expect(
      screen.getByRole('button', { name: 'Pay and subscribe' })
    ).toBeInTheDocument()
  })

  it('goes back to the plans with the same request', async () => {
    const { router } = await renderCheckout()
    await screen.findByText('Creator · Monthly')

    await userEvent.click(screen.getByRole('button', { name: 'Back' }))

    expect(router.currentRoute.value.fullPath).toBe(
      `/v1/subscription?${ENTRY_QUERY}&plan=creator_monthly`
    )
  })

  it('returns to the product on close once there is somewhere to go', async () => {
    const assign = stubNavigation()
    await renderCheckout()
    await screen.findByText('Creator · Monthly')

    await userEvent.click(screen.getByRole('button', { name: 'Close' }))

    expect(assign).toHaveBeenCalledWith('https://testcloud.comfy.org/')
  })

  it('asks for a plan when the link names none', async () => {
    await renderCheckout(`/v1/checkout?${ENTRY_QUERY}`)

    expect(
      await screen.findByRole('heading', { name: 'Choose a plan first' })
    ).toBeInTheDocument()
    expect(screen.getByRole('link', { name: 'See plans' })).toHaveAttribute(
      'href',
      `/v1/subscription?${ENTRY_QUERY}`
    )
  })

  it('explains a quote the server refused and offers the way back', async () => {
    await renderCheckout(CHECKOUT_PATH, {
      preview: { status: 'error', code: 'NO_ACTIVE_SUBSCRIPTION' }
    })

    expect(
      await screen.findByText('There is no active subscription to change.')
    ).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Back' })).toBeInTheDocument()
  })
})
