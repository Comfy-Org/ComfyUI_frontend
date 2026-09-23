import type { BillingOperationState } from '@comfyorg/account-core/billing'
import { BILLING_CLIENT_KEY } from '@comfyorg/account-ui/billing'
import { parseBillingEntry } from '@comfyorg/billing-contract'
import userEvent from '@testing-library/user-event'
import { render, screen, waitFor } from '@testing-library/vue'
import { nextTick } from 'vue'
import { createMemoryHistory, createRouter } from 'vue-router'

import { recordBillingEntry } from '@/entry/billingEntry'
import { createBillingI18n } from '@/i18n'
import type { FakeBillingClientOptions } from '@/test/fakeBillingClient'
import {
  challengedPendingOperation,
  createFakeBillingClient,
  failedOperation,
  hostedPendingOperation,
  pendingOperation,
  previewOf,
  succeededOperation
} from '@/test/fakeBillingClient'
import CheckoutView from '@/views/CheckoutView.vue'

const ENTRY_QUERY = 'product=comfyui&return_to=comfyui_workspace'
const ENTRY_QUERY_PATH = `/v1/checkout?${ENTRY_QUERY}`
const CHECKOUT_PATH = `${ENTRY_QUERY_PATH}&plan=creator_monthly`

/** The two values the view and its surface read; a test-family key stands in for a deployment's. */
vi.mock<unknown>(import('@/config/env'), () => ({
  BILLING_WEB_ENV: 'test',
  STRIPE_PUBLISHABLE_KEY: 'pk_test_example'
}))

const challengeMocks = vi.hoisted(() => ({
  createPort: vi.fn(),
  handleNextAction: vi.fn(async () => ({}))
}))

vi.mock(import('@/session/stripeChallengePort'), () => ({
  createStripeChallengePort: (key: string) => {
    challengeMocks.createPort(key)
    return { handleNextAction: challengeMocks.handleNextAction }
  }
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
  options: FakeBillingClientOptions = {},
  /** Published before mount, the way a lifecycle that already holds one would. */
  live?: BillingOperationState
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
  if (live !== undefined) fake.publishOperation(live)
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

  it('re-quotes when the entry names a different plan and never submits a stale quote', async () => {
    const fake = await renderCheckout()
    await screen.findByRole('button', { name: 'Pay and subscribe' })

    const next = `/v1/checkout?${ENTRY_QUERY}&plan=creator_annual`
    fake.previewSubscribe.mockResolvedValue({
      status: 'ok',
      value: previewOf({ quote_id: 'q_2', quote_version: 7 })
    })
    // The router guard republishes the entry on every navigation; the route
    // record is the same, so the view is reused rather than remounted.
    recordBillingEntry(parseBillingEntry(next))
    await fake.router.push(next)
    await waitFor(() =>
      expect(fake.previewSubscribe).toHaveBeenCalledWith(
        { planSlug: 'creator_annual' },
        expect.anything()
      )
    )

    reportConfirm('ctoken_1')

    await waitFor(() => expect(fake.subscribe).toHaveBeenCalled())
    expect(fake.subscribe).toHaveBeenCalledWith(
      expect.objectContaining({
        plan_slug: 'creator_annual',
        quote_id: 'q_2',
        quote_version: 7
      })
    )
  })

  it('keeps a live operation on the plan it was quoted for', async () => {
    const fake = await renderCheckout()
    await screen.findByRole('button', { name: 'Pay and subscribe' })
    fake.publishOperation(pendingOperation())
    await waitFor(() =>
      expect(
        screen.queryByRole('button', { name: 'Pay and subscribe' })
      ).toBeNull()
    )

    const next = `/v1/checkout?${ENTRY_QUERY}&plan=creator_annual`
    recordBillingEntry(parseBillingEntry(next))
    await fake.router.push(next)
    await nextTick()

    // The operation is still running against creator_monthly, so the page
    // stays on the quote that produced it rather than pricing another plan.
    expect(fake.previewSubscribe).toHaveBeenCalledTimes(1)
    expect(screen.getByText('Creator · Monthly')).toBeInTheDocument()
  })

  it('still quotes when the lifecycle already carries an operation at mount', async () => {
    const fake = await renderCheckout(CHECKOUT_PATH, {}, pendingOperation())

    await waitFor(() => expect(fake.previewSubscribe).toHaveBeenCalledTimes(1))
    expect(await screen.findByText('Creator · Monthly')).toBeInTheDocument()
  })

  it('re-quotes the deferred plan once a settled operation is dismissed', async () => {
    const fake = await renderCheckout()
    await screen.findByRole('button', { name: 'Pay and subscribe' })
    fake.publishOperation(failedOperation('card_declined'))
    await waitFor(() =>
      expect(
        screen.queryByRole('button', { name: 'Pay and subscribe' })
      ).toBeNull()
    )

    const next = `${ENTRY_QUERY_PATH}&plan=creator_annual`
    fake.previewSubscribe.mockResolvedValue({
      status: 'ok',
      value: previewOf({ quote_id: 'q_2', quote_version: 7 })
    })
    recordBillingEntry(parseBillingEntry(next))
    await fake.router.push(next)
    await nextTick()

    // Dismissing the decline puts the form back; it must not price the plan
    // the customer navigated away from.
    await userEvent
      .setup()
      .click(screen.getByRole('button', { name: 'Try again' }))
    await waitFor(() =>
      expect(fake.previewSubscribe).toHaveBeenLastCalledWith(
        { planSlug: 'creator_annual' },
        expect.anything()
      )
    )

    reportConfirm('ctoken_1')
    await waitFor(() => expect(fake.subscribe).toHaveBeenCalled())
    expect(fake.subscribe).toHaveBeenCalledWith(
      expect.objectContaining({ plan_slug: 'creator_annual', quote_id: 'q_2' })
    )
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

  it('charges at the instant the quote was priced, not at the instant it arrives', async () => {
    const fake = await renderCheckout(CHECKOUT_PATH, {
      preview: {
        status: 'ok',
        value: previewOf({ proration_at: '2026-09-18T12:00:00.000Z' })
      }
    })
    await screen.findByRole('button', { name: 'Pay and subscribe' })

    reportConfirm('ctoken_1')

    await waitFor(() =>
      expect(fake.subscribe).toHaveBeenCalledWith(
        expect.objectContaining({ proration_at: '2026-09-18T12:00:00.000Z' })
      )
    )
  })

  it('leaves a change that takes effect later to be priced when it does', async () => {
    const fake = await renderCheckout(CHECKOUT_PATH, {
      preview: {
        status: 'ok',
        value: previewOf({
          is_immediate: false,
          proration_at: '2026-09-18T12:00:00.000Z'
        })
      }
    })
    await screen.findByRole('button', { name: 'Pay and subscribe' })

    reportConfirm('ctoken_1')

    await waitFor(() => expect(fake.subscribe).toHaveBeenCalled())
    expect(fake.subscribe.mock.calls[0][0]).not.toHaveProperty('proration_at')
  })

  it('stops announcing a failed submission once a new quote replaces it', async () => {
    const fake = await renderCheckout()
    await screen.findByRole('button', { name: 'Pay and subscribe' })
    fake.subscribe.mockResolvedValueOnce({ status: 'error', code: 'CONFLICT' })

    reportConfirm('ctoken_1')
    expect(
      await screen.findByText(
        'That change conflicts with your current subscription.'
      )
    ).toBeInTheDocument()

    const next = `/v1/checkout?${ENTRY_QUERY}&plan=creator_annual`
    fake.previewSubscribe.mockResolvedValue({
      status: 'ok',
      value: previewOf({ quote_id: 'q_2' })
    })
    recordBillingEntry(parseBillingEntry(next))
    await fake.router.push(next)

    await waitFor(() =>
      expect(
        screen.queryByText(
          'That change conflicts with your current subscription.'
        )
      ).toBeNull()
    )
  })

  it('redirects this tab when the server offers a hosted continuation', async () => {
    const assign = stubNavigation()
    const fake = await renderCheckout()
    await screen.findByRole('button', { name: 'Pay and subscribe' })

    fake.publishOperation(
      hostedPendingOperation('https://hooks.stripe.test/redirect/op_1')
    )

    await waitFor(() =>
      expect(assign).toHaveBeenCalledWith(
        'https://hooks.stripe.test/redirect/op_1'
      )
    )
    expect(challengeMocks.handleNextAction).not.toHaveBeenCalled()
  })

  it('drives the 3DS challenge in place when the continuation is embedded', async () => {
    const assign = stubNavigation()
    const fake = await renderCheckout()
    await screen.findByRole('button', { name: 'Pay and subscribe' })

    expect(challengeMocks.createPort).toHaveBeenCalledWith('pk_test_example')

    fake.publishOperation(challengedPendingOperation('pi_1_secret'))

    await waitFor(() =>
      expect(challengeMocks.handleNextAction).toHaveBeenCalledWith(
        'pi_1_secret'
      )
    )
    expect(fake.reportChallengeStarted).toHaveBeenCalledWith('op_1')
    expect(assign).not.toHaveBeenCalled()
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
    // Present is not the same as usable: a refused charge has to leave the
    // customer able to try again.
    expect(
      screen.getByRole('button', { name: 'Pay and subscribe' })
    ).toBeEnabled()
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
