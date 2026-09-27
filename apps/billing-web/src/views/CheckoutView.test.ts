import userEvent from '@testing-library/user-event'
import { render, screen, waitFor } from '@testing-library/vue'
import { defineComponent, h, nextTick, ref } from 'vue'
import { createMemoryHistory, createRouter } from 'vue-router'

import type {
  BillingOperationState,
  SubscriptionPreview
} from '@comfyorg/account-core/billing'
import type { AccountCredential } from '@comfyorg/account-core/session'
import { BILLING_CLIENT_KEY } from '@comfyorg/account-ui/billing'
import { parseBillingEntry } from '@comfyorg/billing-contract'

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
import { WORKSPACE_INVITES_KEY } from '@/session/workspaceInvites'
import CheckoutView from '@/views/CheckoutView.vue'

const ENTRY_QUERY = 'product=comfyui&return_to=comfyui_workspace'
const ENTRY_QUERY_PATH = `/v1/checkout?${ENTRY_QUERY}`
const CHECKOUT_PATH = `${ENTRY_QUERY_PATH}&plan=creator_monthly`

/** The values this view and its surface read; a test-family key stands in for a deployment's. */
vi.mock<unknown>(import('@/config/env'), () => ({
  BILLING_WEB_ENV: 'test',
  CLOUD_BASE_URL: 'https://testcloud.comfy.org'
}))

vi.mock(import('@/config/stripeKey'), () => ({
  awaitBillingWebStripeKey: () => Promise.resolve('pk_test_example'),
  useBillingWebStripeKey: () => ref('pk_test_example')
}))

const workspace = vi.hoisted(() => ({
  session: undefined as AccountCredential | undefined,
  bound: undefined as string | undefined
}))

vi.mock(import('@/session/billingWebSession'), async () => {
  const { computed } = await import('vue')
  return {
    useBillingWebSession: () => ({
      phase: computed(() =>
        workspace.session ? 'authenticated' : 'signed-out'
      ),
      user: computed(() => null),
      session: computed(() => workspace.session),
      failure: computed(() => undefined)
    })
  }
})

vi.mock(import('@/entry/workspaceBinding'), () => ({
  boundWorkspaceId: () => workspace.bound,
  bindEntryWorkspace: () => false
}))

function teamSession(): AccountCredential {
  return {
    token: 'jwt-1',
    permissions: [],
    expiresAt: Date.now() + 3_600_000,
    uid: 'uid-1',
    workspace: { id: 'ws-team', name: 'Acme Team', type: 'team' },
    role: 'owner'
  }
}

const challengeMocks = vi.hoisted(() => ({
  createPort: vi.fn(),
  handleNextAction: vi.fn(async () => ({}))
}))

vi.mock(import('@/session/stripeChallengePort'), () => ({
  createDeferredStripeChallengePort: (
    getKey: () => string | undefined | Promise<string | undefined>
  ) => {
    void Promise.resolve(getKey()).then((key) => challengeMocks.createPort(key))
    return { handleNextAction: challengeMocks.handleNextAction }
  }
}))

/**
 * The card form is covered in the package against the real Stripe mocks. Here
 * it records what it was handed and lets a test hand back a token.
 */
const formProps = vi.hoisted(() => ({
  value: {} as Record<string, unknown>,
  mounted: false
}))
let reportConfirm: (confirmationToken: string) => void = () => {}

const PaymentFormStub = defineComponent({
  name: 'CheckoutPaymentForm',
  props: {
    publishableKey: { type: String, default: '' },
    amountCents: { type: Number, default: 0 },
    currency: { type: String, default: '' },
    submitLabel: { type: String, default: '' },
    isLoading: { type: Boolean, default: false },
    canSubmit: { type: Boolean, default: true }
  },
  emits: ['confirm'],
  setup(props, { emit }) {
    formProps.value = props
    formProps.mounted = true
    reportConfirm = (token) => emit('confirm', token)
    return () =>
      h(
        'button',
        {
          type: 'submit',
          disabled: !props.canSubmit,
          'aria-busy': props.isLoading || undefined
        },
        props.submitLabel
      )
  }
})

/** A quote the card form can price: an exact amount, a currency and an identity. */
function cardQuote(overrides: Partial<SubscriptionPreview> = {}) {
  return previewOf({
    quote_id: 'q_1',
    quote_version: 3,
    amount_due_cents: 2800,
    currency: 'usd',
    ...overrides
  })
}

/** A cancelled Standard subscriber upgrading to Creator. */
function upgradeQuote(overrides: Partial<SubscriptionPreview> = {}) {
  return cardQuote({
    transition_type: 'upgrade',
    current_plan: {
      slug: 'standard_monthly',
      tier: 'STANDARD',
      duration: 'MONTHLY',
      price_cents: 2000,
      credits_cents: 0,
      seat_summary: {
        seat_count: 1,
        total_cost_cents: 2000,
        total_credits_cents: 0
      },
      period_end: '2026-10-19T00:00:00.000Z'
    },
    ...overrides
  })
}

async function renderCheckout(
  path = CHECKOUT_PATH,
  options: FakeBillingClientOptions = {},
  /** Published before mount, the way a lifecycle that already holds one would. */
  live?: BillingOperationState
) {
  recordBillingEntry(parseBillingEntry(path))
  const router = createRouter({
    history: createMemoryHistory(),
    routes: [{ path: '/v1/checkout', component: CheckoutView }]
  })
  const fake = createFakeBillingClient({
    preview: { status: 'ok', value: cardQuote() },
    ...options
  })
  if (live !== undefined) fake.publishOperation(live)
  await router.push(path)
  await router.isReady()
  render(CheckoutView, {
    global: {
      plugins: [createBillingI18n(), router],
      provide: {
        [BILLING_CLIENT_KEY]: fake.client,
        [WORKSPACE_INVITES_KEY]: fake.invites
      },
      stubs: { CheckoutPaymentForm: PaymentFormStub }
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
  beforeEach(() => {
    workspace.session = undefined
    workspace.bound = undefined
    formProps.mounted = false
  })

  it('quotes the plan the link names and prices the confirm from it', async () => {
    const fake = await renderCheckout()

    expect(
      await screen.findByRole('heading', { name: 'Confirm your payment' })
    ).toBeInTheDocument()
    expect(fake.previewSubscribe).toHaveBeenCalledWith(
      { planSlug: 'creator_monthly' },
      expect.anything()
    )
    expect(screen.getByText('Creator')).toBeInTheDocument()
    expect(screen.getByText('$28')).toBeInTheDocument()
    expect(screen.getByText('USD / mo')).toBeInTheDocument()
    expect(screen.getByText('7,400')).toBeInTheDocument()
    expect(screen.getByText('$28.00')).toBeInTheDocument()
  })

  it('quotes and subscribes with the team credit stop the link names', async () => {
    const path = `${ENTRY_QUERY_PATH}&plan=team_per_credit_annual&team_credit_stop_id=stop_700`
    const fake = await renderCheckout(path, {
      preview: {
        status: 'ok',
        value: cardQuote({
          new_plan: {
            ...cardQuote().new_plan,
            slug: 'team_per_credit_annual',
            tier: 'TEAM',
            duration: 'ANNUAL',
            price_cents: 756_000
          }
        })
      },
      plans: {
        status: 'ok',
        value: {
          current_plan_slug: undefined,
          plans: [],
          team_credit_stops: {
            default_stop_index: 0,
            stops: [
              {
                id: 'stop_700',
                credits: 147_700n,
                monthly: { list_price_cents: 70_000n, price_cents: 66_500n },
                yearly: { list_price_cents: 70_000n, price_cents: 63_000n }
              }
            ]
          }
        }
      }
    })
    await screen.findByRole('button', { name: 'Pay and subscribe' })

    expect(fake.previewSubscribe).toHaveBeenCalledWith(
      { planSlug: 'team_per_credit_annual', teamCreditStopId: 'stop_700' },
      expect.anything()
    )
    expect(screen.getByText('Team Plan')).toBeInTheDocument()
    expect(screen.getByText('$630')).toBeInTheDocument()
    expect(screen.getByText('1,772,400')).toBeInTheDocument()

    reportConfirm('ctoken_1')

    await waitFor(() =>
      expect(fake.subscribe).toHaveBeenCalledWith(
        expect.objectContaining({
          plan_slug: 'team_per_credit_annual',
          team_credit_stop_id: 'stop_700',
          return_url: expect.stringContaining('team_credit_stop_id=stop_700')
        })
      )
    )
  })

  it('re-quotes when the entry names a different plan and never submits a stale quote', async () => {
    const fake = await renderCheckout()
    await screen.findByRole('button', { name: 'Pay and subscribe' })

    const next = `/v1/checkout?${ENTRY_QUERY}&plan=creator_annual`
    fake.previewSubscribe.mockResolvedValue({
      status: 'ok',
      value: cardQuote({ quote_id: 'q_2', quote_version: 7 })
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

  it('keeps a live operation on the plan it was quoted for, paying', async () => {
    const fake = await renderCheckout()
    await screen.findByRole('button', { name: 'Pay and subscribe' })
    fake.publishOperation(pendingOperation())
    await waitFor(() => expect(formProps.value.isLoading).toBe(true))

    const next = `/v1/checkout?${ENTRY_QUERY}&plan=creator_annual`
    recordBillingEntry(parseBillingEntry(next))
    await fake.router.push(next)
    await nextTick()

    // The operation is still running against creator_monthly, so the page
    // stays on the quote that produced it rather than pricing another plan.
    expect(fake.previewSubscribe).toHaveBeenCalledTimes(1)
    expect(screen.getByText('Creator')).toBeInTheDocument()
  })

  it('still quotes when the lifecycle already carries an operation at mount', async () => {
    const fake = await renderCheckout(CHECKOUT_PATH, {}, pendingOperation())

    await waitFor(() => expect(fake.previewSubscribe).toHaveBeenCalledTimes(1))
    expect(
      await screen.findByRole('heading', { name: 'Confirm your payment' })
    ).toBeInTheDocument()
  })

  it('re-quotes the deferred plan once the payment in flight settles', async () => {
    const fake = await renderCheckout()
    await screen.findByRole('button', { name: 'Pay and subscribe' })
    fake.publishOperation(pendingOperation())

    const next = `${ENTRY_QUERY_PATH}&plan=creator_annual`
    fake.previewSubscribe.mockResolvedValue({
      status: 'ok',
      value: cardQuote({ quote_id: 'q_2', quote_version: 7 })
    })
    recordBillingEntry(parseBillingEntry(next))
    await fake.router.push(next)
    await nextTick()
    expect(fake.previewSubscribe).toHaveBeenCalledTimes(1)

    // The decline ends the attempt; only then may the new link be priced.
    fake.publishOperation(failedOperation('card_declined'))
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

  it("hands the card form the quote and this deployment's key", async () => {
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

  it('charges the default saved method instead of showing the card form', async () => {
    const fake = await renderCheckout(CHECKOUT_PATH, {
      paymentMethods: {
        status: 'ok',
        value: [
          {
            id: 'pm_visa',
            type: 'card',
            brand: 'visa',
            last4: '4242',
            is_default: true
          }
        ]
      }
    })

    expect(await screen.findByText('visa •••• 4242')).toBeInTheDocument()
    expect(formProps.mounted).toBe(false)
    await userEvent.click(
      screen.getByRole('button', { name: 'Pay and subscribe' })
    )

    await waitFor(() =>
      expect(fake.subscribe).toHaveBeenCalledWith(
        expect.objectContaining({ saved_payment_method_id: 'pm_visa' })
      )
    )
    expect(fake.subscribe.mock.calls[0][0]).not.toHaveProperty(
      'confirmation_token'
    )
  })

  it('swaps the saved method for the card form on Change', async () => {
    await renderCheckout(CHECKOUT_PATH, {
      paymentMethods: {
        status: 'ok',
        value: [
          {
            id: 'pm_visa',
            type: 'card',
            brand: 'visa',
            last4: '4242',
            is_default: true
          }
        ]
      }
    })

    await userEvent.click(await screen.findByRole('button', { name: 'Change' }))

    await waitFor(() => expect(formProps.mounted).toBe(true))
    expect(screen.queryByText('visa •••• 4242')).toBeNull()
  })

  it('re-quotes with a promo code only when it is applied', async () => {
    const fake = await renderCheckout()
    await screen.findByRole('button', { name: 'Pay and subscribe' })

    await userEvent.type(
      screen.getByRole('textbox', { name: 'Promo code' }),
      'SPRING'
    )
    await waitFor(() => expect(formProps.value.canSubmit).toBe(false))
    expect(fake.previewSubscribe).toHaveBeenCalledTimes(1)

    fake.previewSubscribe.mockResolvedValue({
      status: 'ok',
      value: cardQuote({ promotion_code: 'SPRING', quote_version: 4 })
    })
    await userEvent.click(screen.getByRole('button', { name: 'Apply' }))

    await waitFor(() =>
      expect(fake.previewSubscribe).toHaveBeenLastCalledWith(
        { planSlug: 'creator_monthly', promotionCode: 'SPRING' },
        expect.anything()
      )
    )
    await waitFor(() => expect(formProps.value.canSubmit).toBe(true))
    reportConfirm('ctoken_1')
    await waitFor(() =>
      expect(fake.subscribe).toHaveBeenCalledWith(
        expect.objectContaining({ promotion_code: 'SPRING', quote_version: 4 })
      )
    )
  })

  it('charges at the instant the quote was priced, not at the instant it arrives', async () => {
    const fake = await renderCheckout(CHECKOUT_PATH, {
      preview: {
        status: 'ok',
        value: cardQuote({ proration_at: '2026-09-18T12:00:00.000Z' })
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
        value: cardQuote({
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
    expect(await screen.findByRole('alert')).toHaveTextContent(
      'That change conflicts with your current subscription.'
    )

    const next = `/v1/checkout?${ENTRY_QUERY}&plan=creator_annual`
    fake.previewSubscribe.mockResolvedValue({
      status: 'ok',
      value: cardQuote({ quote_id: 'q_2' })
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

  it('shows the success step and closes back to the product with the outcome', async () => {
    const assign = stubNavigation()
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
    const [, close] = screen.getAllByRole('button', { name: 'Close' })
    await userEvent.click(close)
    expect(assign).toHaveBeenCalledExactlyOnceWith(
      'https://testcloud.comfy.org/?billing_result=success&billing_ref=op_9'
    )
  })

  it('offers the team invite on a multi-seat success and sends it to the workspace', async () => {
    const fake = await renderCheckout(CHECKOUT_PATH, {
      subscribe: {
        status: 'ok',
        value: { phase: 'succeeded', operation: succeededOperation('op_9') }
      },
      status: {
        is_active: true,
        has_funds: true,
        max_seats: 20,
        occupied_seats: 1,
        scheduled_change: null,
        team_credit_stop: null
      }
    })
    await screen.findByRole('button', { name: 'Pay and subscribe' })
    reportConfirm('ctoken_1')

    expect(
      await screen.findByRole('heading', { name: 'Invite your team' })
    ).toBeInTheDocument()
    await userEvent.type(
      screen.getByRole('textbox', { name: 'Enter emails separated by commas' }),
      'ada@example.com,'
    )
    await userEvent.click(screen.getByRole('button', { name: 'Send invites' }))

    expect(
      await screen.findByText('An invite was sent to ada@example.com')
    ).toBeInTheDocument()
    expect(fake.invites.createInvite).toHaveBeenCalledWith('ada@example.com')
  })

  it('shows no invite on a single-seat success', async () => {
    const fake = await renderCheckout(CHECKOUT_PATH, {
      subscribe: {
        status: 'ok',
        value: { phase: 'succeeded', operation: succeededOperation('op_9') }
      }
    })
    await screen.findByRole('button', { name: 'Pay and subscribe' })
    reportConfirm('ctoken_1')

    await screen.findByRole('heading', { name: "You're all set" })
    await waitFor(() => expect(fake.readStatus).toHaveBeenCalled())
    expect(
      screen.queryByRole('heading', { name: 'Invite your team' })
    ).toBeNull()
    expect(fake.invites.listPendingInvites).not.toHaveBeenCalled()
  })

  it('returns the customer into the workspace the session was minted for', async () => {
    const assign = stubNavigation()
    workspace.session = teamSession()
    workspace.bound = 'ws-other'
    await renderCheckout(CHECKOUT_PATH, {
      subscribe: {
        status: 'ok',
        value: { phase: 'succeeded', operation: succeededOperation('op_9') }
      }
    })
    await screen.findByRole('button', { name: 'Pay and subscribe' })

    reportConfirm('ctoken_1')

    await screen.findByRole('heading', { name: "You're all set" })
    const [, close] = screen.getAllByRole('button', { name: 'Close' })
    await userEvent.click(close)
    expect(assign).toHaveBeenCalledExactlyOnceWith(
      'https://testcloud.comfy.org/?workspace=ws-team&billing_result=success&billing_ref=op_9'
    )
  })

  it('names the minted workspace on the hosted payment way back here', async () => {
    workspace.session = teamSession()
    const fake = await renderCheckout()
    await screen.findByRole('button', { name: 'Pay and subscribe' })

    reportConfirm('ctoken_1')

    await waitFor(() => expect(fake.subscribe).toHaveBeenCalled())
    const [request] = fake.subscribe.mock.calls[0]
    const returnUrl = new URL(String(request.return_url))
    expect(returnUrl.pathname).toBe('/v1/result')
    expect(returnUrl.searchParams.get('workspace')).toBe('ws-team')
  })

  it.for([
    ['card_declined', 'Your bank declined this payment.'],
    ['insufficient_funds', 'This payment method has insufficient funds.'],
    ['expired_card', 'This card has expired.']
  ] as const)(
    'reports a %s decline as the app does and keeps the confirm usable',
    async ([reason, detail]) => {
      await renderCheckout(CHECKOUT_PATH, {
        subscribe: {
          status: 'ok',
          value: { phase: 'failed', operation: failedOperation(reason) }
        }
      })
      await screen.findByRole('button', { name: 'Pay and subscribe' })

      reportConfirm('ctoken_1')

      const toast = await screen.findByRole('alert')
      expect(toast).toHaveTextContent('Error')
      expect(toast).toHaveTextContent(detail)
      expect(formProps.value.isLoading).toBe(false)
      expect(
        screen.getByRole('heading', { name: 'Confirm your payment' })
      ).toBeInTheDocument()
    }
  )

  it('shows a failed in-page verification inline, as the app does', async () => {
    const fake = await renderCheckout()
    await screen.findByRole('button', { name: 'Pay and subscribe' })

    fake.publishOperation({
      ...challengedPendingOperation('pi_1_secret'),
      challenge: { status: 'failed', clientSecret: 'pi_1_secret' }
    })

    expect(
      await screen.findByText(
        "We couldn't complete payment verification. Please try again."
      )
    ).toBeInTheDocument()
    expect(screen.queryByRole('status')).toBeNull()
  })

  it('shows the processing toast while the payment settles', async () => {
    const fake = await renderCheckout()
    await screen.findByRole('button', { name: 'Pay and subscribe' })

    fake.publishOperation(pendingOperation())

    expect(await screen.findByRole('status')).toHaveTextContent(
      'Processing payment — setting up your workspace...'
    )
  })

  it('holds a reactivating plan change until its charge is acknowledged', async () => {
    const fake = await renderCheckout(CHECKOUT_PATH, {
      preview: {
        status: 'ok',
        value: upgradeQuote({
          requires_reactivation_confirmation: true,
          amount_due_cents: 4500
        })
      }
    })
    const confirm = await screen.findByRole('button', {
      name: 'Confirm & reactivate — $45.00 today'
    })
    expect(confirm).toBeDisabled()

    await userEvent.click(
      screen.getByRole('checkbox', {
        name: "I understand I'll be charged $45.00 today"
      })
    )
    expect(confirm).toBeEnabled()
    await userEvent.click(confirm)

    await waitFor(() =>
      expect(fake.subscribe).toHaveBeenCalledWith(
        expect.objectContaining({ confirm_reactivation: true })
      )
    )
    expect(fake.subscribe.mock.calls[0][0]).not.toHaveProperty(
      'confirmation_token'
    )
  })

  it('re-quotes and asks when the server, not the quote, demands the confirmation', async () => {
    const fake = await renderCheckout(CHECKOUT_PATH, {
      preview: { status: 'ok', value: upgradeQuote() }
    })
    fake.subscribe.mockResolvedValueOnce({
      status: 'error',
      code: 'REACTIVATION_CONFIRMATION_REQUIRED'
    })

    await userEvent.click(
      await screen.findByRole('button', { name: 'Confirm upgrade' })
    )

    const reactivate = await screen.findByRole('button', {
      name: 'Confirm & reactivate — $28.00 today'
    })
    expect(fake.previewSubscribe).toHaveBeenCalledTimes(2)
    expect(fake.subscribe).toHaveBeenCalledTimes(1)
    expect(reactivate).toBeDisabled()

    await userEvent.click(screen.getByRole('checkbox'))
    await userEvent.click(reactivate)

    await waitFor(() => expect(fake.subscribe).toHaveBeenCalledTimes(2))
    expect(fake.subscribe).toHaveBeenLastCalledWith(
      expect.objectContaining({ confirm_reactivation: true })
    )
  })

  it('tells the customer when the subscribe itself was refused and keeps the form', async () => {
    await renderCheckout(CHECKOUT_PATH, {
      subscribe: { status: 'error', code: 'REQUEST_FAILED' }
    })
    await screen.findByRole('button', { name: 'Pay and subscribe' })

    reportConfirm('ctoken_1')

    expect(await screen.findByRole('alert')).toHaveTextContent(
      "We couldn't reach the billing service. Please try again."
    )
    // Present is not the same as usable: a refused charge has to leave the
    // customer able to try again.
    expect(
      screen.getByRole('button', { name: 'Pay and subscribe' })
    ).toBeEnabled()
  })

  it.for(['Back', 'Close'])(
    'closes a tab the product opened on %s, leaving the product where it was',
    async (action) => {
      const assign = stubNavigation()
      const close = vi.spyOn(window, 'close').mockImplementation(() => {
        vi.spyOn(window, 'closed', 'get').mockReturnValue(true)
      })
      await renderCheckout()
      await screen.findByRole('button', { name: 'Pay and subscribe' })

      await userEvent.click(screen.getByRole('button', { name: action }))

      expect(close).toHaveBeenCalledOnce()
      expect(assign).not.toHaveBeenCalled()
    }
  )

  it('closes the tab from the success step instead of opening the product in it', async () => {
    const assign = stubNavigation()
    const close = vi.spyOn(window, 'close').mockImplementation(() => {
      vi.spyOn(window, 'closed', 'get').mockReturnValue(true)
    })
    await renderCheckout(CHECKOUT_PATH, {
      subscribe: {
        status: 'ok',
        value: { phase: 'succeeded', operation: succeededOperation('op_9') }
      }
    })
    await screen.findByRole('button', { name: 'Pay and subscribe' })
    reportConfirm('ctoken_1')
    await screen.findByRole('heading', { name: "You're all set" })

    const [, closeButton] = screen.getAllByRole('button', { name: 'Close' })
    await userEvent.click(closeButton)

    expect(close).toHaveBeenCalledOnce()
    expect(assign).not.toHaveBeenCalled()
  })

  it.for(['Back', 'Close'])(
    'returns to the product, where plans are chosen, on %s',
    async (action) => {
      const assign = stubNavigation()
      await renderCheckout()
      await screen.findByRole('button', { name: 'Pay and subscribe' })

      await userEvent.click(screen.getByRole('button', { name: action }))

      expect(assign).toHaveBeenCalledExactlyOnceWith(
        'https://testcloud.comfy.org/'
      )
    }
  )

  it.for([
    ['upgrade', true, 2800, 'Confirm upgrade'] as const,
    ['downgrade', true, 1400, 'Confirm upgrade'] as const,
    ['duration_change', false, 0, 'Confirm change'] as const
  ])(
    'confirms a %s plan change against the saved payment method, no card form',
    async ([transitionType, isImmediate, costTodayCents, cta]) => {
      const fake = await renderCheckout(CHECKOUT_PATH, {
        preview: {
          status: 'ok',
          value: cardQuote({
            transition_type: transitionType,
            is_immediate: isImmediate,
            cost_today_cents: costTodayCents,
            amount_due_cents: costTodayCents
          })
        }
      })
      const confirm = await screen.findByRole('button', { name: cta })
      expect(formProps.mounted).toBe(false)

      await userEvent.click(confirm)

      await waitFor(() =>
        expect(fake.subscribe).toHaveBeenCalledWith(
          expect.objectContaining({ plan_slug: 'creator_monthly' })
        )
      )
      const [request] = fake.subscribe.mock.calls[0]
      expect(request).not.toHaveProperty('confirmation_token')
      expect(request).not.toHaveProperty('saved_payment_method_id')
    }
  )

  it('explains a quote the server refused and offers the way back', async () => {
    await renderCheckout(CHECKOUT_PATH, {
      preview: { status: 'error', code: 'NO_ACTIVE_SUBSCRIPTION' }
    })

    const assign = stubNavigation()
    expect(
      await screen.findByText('There is no active subscription to change.')
    ).toBeInTheDocument()

    await userEvent.click(screen.getByRole('button', { name: 'Back' }))

    expect(assign).toHaveBeenCalledExactlyOnceWith(
      'https://testcloud.comfy.org/'
    )
  })
})
