import { datadogRum } from '@datadog/browser-rum'
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
  hostedPendingOperation,
  pendingOperation,
  previewOf,
  succeededOperation
} from '@/test/fakeBillingClient'
import FullPageCheckoutView from '@/views/FullPageCheckoutView.vue'

vi.mock(import('@datadog/browser-rum'))

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
    handleNextAction: async () => ({}),
    leavesPage: async () => false
  })
}))

vi.mock(import('@/entry/workspaceBinding'), () => ({
  boundWorkspaceId: () => undefined,
  bindEntryWorkspace: () => false
}))

vi.mock(import('@/checkout/operationChannel'), () => ({
  createOperationChannel: () => ({
    publish: () => {},
    subscribe: () => () => {},
    close: () => {}
  })
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
  emit: (() => {}) as (event: string, ...payload: unknown[]) => void
}))

vi.mock<unknown>(import('@comfyorg/account-ui/billing/stripe'), async () => {
  const { h } = await import('vue')
  return {
    StripePaymentForm: {
      name: 'StripePaymentForm',
      emits: ['confirm', 'phase'],
      setup(
        _props: object,
        {
          emit,
          slots
        }: {
          emit: (event: string, ...payload: unknown[]) => void
          slots: { submit?: (slotProps: Record<string, unknown>) => VNode[] }
        }
      ) {
        form.emit = emit
        return () =>
          h('div', slots.submit?.({ disabled: false, loading: false }))
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
  path = CHECKOUT_PATH,
  errorHandler?: (error: unknown) => void
) {
  recordBillingEntry(parseBillingEntry(path))
  const fake = createFakeBillingClient({
    preview: {
      status: 'ok',
      value: previewOf({ quote_id: 'q_1', quote_version: 3 })
    },
    capabilities: { can_subscribe_self_serve: true },
    ...options
  })
  arrange(fake)
  render(FullPageCheckoutView, {
    global: {
      plugins: [createBillingI18n()],
      provide: { [BILLING_CLIENT_KEY]: fake.client },
      ...(errorHandler === undefined ? {} : { config: { errorHandler } })
    }
  })
  return fake
}

interface ReportedAction {
  readonly name: string
  readonly [field: string]: unknown
}

/** What RUM was told on the checkout journey, in order. */
function journey(): ReportedAction[] {
  return vi
    .mocked(datadogRum.addAction)
    .mock.calls.filter(([name]) => name.startsWith('billing.checkout.'))
    .map(([name, context]) => ({
      name,
      ...Object.fromEntries(Object.entries(context ?? {}))
    }))
}

const journeyNames = () => journey().map(({ name }) => name)

const payButton = () =>
  screen.getByRole('button', { name: 'Pay and subscribe' })

const VISA: SavedPaymentMethod = {
  id: 'pm_visa',
  type: 'card',
  brand: 'visa',
  last4: '4242',
  is_default: false
}

const REFUSED_BY_THE_SERVER = {
  status: 'error',
  code: 'REQUEST_FAILED',
  httpStatus: 400,
  serverCode: readBillingErrorCode({ code: 'INVALID_PLAN', message: 'no' })
} as const

const vueErrors: unknown[] = []

beforeEach(() => {
  vueErrors.length = 0
})

afterEach(() => {
  sessionStorage.clear()
})

describe('the full-page checkout journey', () => {
  beforeEach(() => {
    vi.mocked(datadogRum.getInitConfiguration).mockReturnValue({
      clientToken: 'pub',
      applicationId: 'app'
    })
  })

  it('continues the cloud journey and entry the link carries', async () => {
    await renderCheckout(
      {},
      () => {},
      `${CHECKOUT_PATH}&correlation_id=journey-7&source=agent_paywall`
    )

    await waitFor(() =>
      expect(journeyNames()).toEqual([
        'billing.checkout.entered',
        'billing.checkout.preview_ready'
      ])
    )
    const [entered, ready] = journey()
    expect(entered).toMatchObject({
      phase: 'entered',
      checkout_journey_id: 'journey-7',
      ui_mode: 'full_page',
      entry_flow: 'unknown',
      entry_source: 'agent_paywall',
      payment_intent_source: 'agent_paywall',
      assignment_status: 'unavailable',
      billing_surface: 'billing_web'
    })
    expect(ready).toMatchObject({
      phase: 'preview_ready',
      checkout_journey_id: 'journey-7',
      entry_flow: 'initial_subscription',
      preview_revision: 'q_1:3'
    })
  })

  it('gives every phase of a link that carries no journey the same journey id', async () => {
    await renderCheckout()

    await waitFor(() => expect(journey()).toHaveLength(2))
    const ids = journey().map((event) => event.checkout_journey_id)
    expect(ids[0]).toEqual(expect.any(String))
    expect(ids[1]).toBe(ids[0])
  })

  it.for<{
    name: string
    options: FakeBillingClientOptions
    arrange?: (fake: FakeBillingClient) => void
    path?: string
    last: Record<string, unknown>
  }>([
    {
      name: 'a workspace the server refuses names the bounded denial',
      options: {
        capabilities: {},
        denials: { can_subscribe_self_serve: 'not_workspace_owner' }
      },
      last: {
        phase: 'preview_failed',
        failure_category: 'api_rejected',
        denial_reason: 'not_workspace_owner'
      }
    },
    {
      name: 'a capabilities read that never got an answer fails as a network failure',
      options: {},
      arrange: (fake) =>
        fake.readCapabilities.mockResolvedValue({
          status: 'error',
          code: 'REQUEST_FAILED'
        }),
      last: { phase: 'preview_failed', failure_category: 'network' }
    },
    {
      name: 'a quote the server refuses fails with the checkout code',
      options: {
        preview: { status: 'ok', value: previewOf({ allowed: false }) }
      },
      last: {
        phase: 'preview_failed',
        failure_category: 'api_rejected',
        error_code: 'quote_not_allowed'
      }
    },
    {
      name: 'a quote the server answered with an error fails as a rejection',
      options: {
        preview: {
          status: 'error',
          code: 'REQUEST_FAILED',
          httpStatus: 503
        }
      },
      last: { phase: 'preview_failed', failure_category: 'api_rejected' }
    },
    {
      name: 'a plan the catalog lacks fails as a rejection of the plan',
      options: { preview: REFUSED_BY_THE_SERVER },
      last: {
        phase: 'preview_failed',
        failure_category: 'api_rejected',
        error_code: 'plan_unavailable'
      }
    },
    {
      name: 'a team plan named without its stop fails as an invalid link',
      options: {
        preview: {
          status: 'ok',
          value: previewOf({
            new_plan: { ...previewOf().new_plan, tier: 'TEAM' }
          })
        }
      },
      path: '/v1/checkout?product=comfyui&return_to=comfyui_workspace&plan=team_per_credit_monthly',
      last: {
        phase: 'preview_failed',
        failure_category: 'validation',
        error_code: 'plan_unavailable'
      }
    }
  ])('$name', async ({ options, arrange, path, last }) => {
    await renderCheckout(options, arrange, path)

    await waitFor(() =>
      expect(journeyNames()).toEqual([
        'billing.checkout.entered',
        'billing.checkout.preview_failed',
        'billing.checkout.ended'
      ])
    )
    expect(journey()[1]).toMatchObject(last)
  })

  it.for<{
    name: string
    phase: StripePaymentPhase
    reported: Record<string, unknown>
  }>([
    {
      name: 'the payment element mounting',
      phase: { phase: 'payment_element_ready', element: 'payment' },
      reported: { phase: 'payment_element_ready', element: 'payment' }
    },
    {
      name: 'the address element mounting',
      phase: { phase: 'payment_element_ready', element: 'address' },
      reported: { phase: 'payment_element_ready', element: 'address' }
    },
    {
      name: 'the payment element failing to load',
      phase: {
        phase: 'payment_element_failed',
        element: 'payment',
        element_phase: 'mount',
        error_code: 'invalid_request_error'
      },
      reported: {
        phase: 'payment_element_failed',
        element: 'payment',
        element_phase: 'mount',
        error_code: 'invalid_request_error'
      }
    },
    {
      name: 'the form attempting to submit',
      phase: { phase: 'payment_submit_attempted' },
      reported: { phase: 'payment_submit_attempted' }
    },
    {
      name: 'the form failing to validate',
      phase: {
        phase: 'payment_submit_failed',
        submit_phase: 'validation',
        error_code: 'incomplete_number'
      },
      reported: {
        phase: 'payment_submit_failed',
        submit_phase: 'validation',
        error_code: 'incomplete_number'
      }
    },
    {
      name: 'the form failing to mint a token',
      phase: { phase: 'payment_submit_failed', submit_phase: 'token_creation' },
      reported: {
        phase: 'payment_submit_failed',
        submit_phase: 'token_creation'
      }
    }
  ])('reports $name as the cloud app does', async ({ phase, reported }) => {
    await renderCheckout()
    await screen.findByText('Subscribe to Creator Plan · Acme Team')

    reportPhase(phase)

    await waitFor(() => expect(journey()).toHaveLength(3))
    expect(journey()[2]).toMatchObject({
      name: `billing.checkout.${phase.phase}`,
      ...reported,
      ui_mode: 'full_page',
      billing_surface: 'billing_web'
    })
  })

  it('reports the journey of a payment from the first look to the operation it issued', async () => {
    const fake = await renderCheckout({
      subscribe: {
        status: 'ok',
        value: { phase: 'succeeded', operation: succeededOperation('op_9') }
      }
    })
    await screen.findByText('Subscribe to Creator Plan · Acme Team')

    reportPhase({ phase: 'payment_element_ready', element: 'payment' })
    reportPhase({ phase: 'payment_submit_attempted' })
    form.emit('confirm', 'ctoken_1', 'card')

    await waitFor(() => expect(fake.subscribe).toHaveBeenCalled())
    await waitFor(() =>
      expect(journeyNames()).toEqual([
        'billing.checkout.entered',
        'billing.checkout.preview_ready',
        'billing.checkout.payment_element_ready',
        'billing.checkout.payment_submit_attempted',
        'billing.checkout.method_selected',
        'billing.checkout.submitted',
        'billing.checkout.operation_linked',
        'billing.checkout.ended'
      ])
    )
    const [, , , , , submitted, linked] = journey()
    expect(submitted).not.toHaveProperty('billing_op_id')
    expect(linked).toMatchObject({ billing_op_id: 'op_9' })
  })

  it('reports no operation for a payment the server refused before issuing one', async () => {
    const fake = await renderCheckout()
    await screen.findByText('Subscribe to Creator Plan · Acme Team')
    fake.subscribe.mockResolvedValueOnce({ status: 'error', code: 'CONFLICT' })

    reportPhase({ phase: 'payment_element_ready', element: 'payment' })
    form.emit('confirm', 'ctoken_1', 'card')

    await waitFor(() => expect(fake.subscribe).toHaveBeenCalled())
    await fake.subscribe.mock.results[0]?.value
    expect(journeyNames()).toEqual([
      'billing.checkout.entered',
      'billing.checkout.preview_ready',
      'billing.checkout.payment_element_ready',
      'billing.checkout.method_selected',
      'billing.checkout.submitted'
    ])
  })

  it('reports no operation for one the checkout recovered rather than paid', async () => {
    await renderCheckout({
      recover: { status: 'ok', value: pendingOperation('op_old') }
    })

    expect(await screen.findByTestId('checkout-waiting')).toBeInTheDocument()
    expect(journeyNames()).not.toContain('billing.checkout.operation_linked')
    expect(journeyNames()).not.toContain('billing.checkout.submitted')
  })

  it.for<{
    name: string
    options: FakeBillingClientOptions
    choose: () => Promise<void> | void
    selected: Record<string, unknown>
  }>([
    {
      name: 'a new card',
      options: {},
      choose: () => form.emit('confirm', 'ctoken_1', 'card'),
      selected: { rail: 'new', method_kind: 'card' }
    },
    {
      name: 'a new Alipay account',
      options: {},
      choose: () => form.emit('confirm', 'ctoken_1', 'alipay'),
      selected: { rail: 'new', method_kind: 'alipay' }
    },
    {
      name: 'a new method of any other type',
      options: {},
      choose: () => form.emit('confirm', 'ctoken_1', 'sepa_debit'),
      selected: { rail: 'new', method_kind: 'other' }
    },
    {
      name: 'a saved card',
      options: { paymentMethods: { status: 'ok', value: [VISA] } },
      choose: () => userEvent.click(payButton()),
      selected: { rail: 'saved', method_kind: 'card' }
    },
    {
      name: 'the method on file for a plan change',
      options: {
        preview: {
          status: 'ok',
          value: previewOf({ transition_type: 'upgrade' })
        }
      },
      choose: () => userEvent.click(payButton()),
      selected: { rail: 'on_file' }
    }
  ])(
    'reports $name as the method chosen, just before the submit',
    async ({ options, choose, selected }) => {
      await renderCheckout(options)
      await screen.findByText(
        /Subscribe to Creator Plan|Upgrade to Creator Plan/
      )
      reportPhase({ phase: 'payment_element_ready', element: 'payment' })

      await choose()

      await waitFor(() =>
        expect(journeyNames().slice(-2)).toEqual([
          'billing.checkout.method_selected',
          'billing.checkout.submitted'
        ])
      )
      expect(journey().at(-2)).toMatchObject({
        phase: 'method_selected',
        ...selected
      })
    }
  )

  it('reports a Pay the keep-subscription consent holds back, then the Pay that goes ahead', async () => {
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
    const box = await screen.findByRole('checkbox', {
      name: 'Keep my subscription and renew it'
    })

    await userEvent.click(payButton())

    expect(journeyNames().slice(2)).toEqual(['billing.checkout.pay_blocked'])
    expect(journey()[2]).toMatchObject({
      phase: 'pay_blocked',
      reason: 'reactivation_unconfirmed'
    })

    await userEvent.click(box)
    await userEvent.click(payButton())

    await waitFor(() => expect(fake.subscribe).toHaveBeenCalled())
    expect(journeyNames().slice(2)).toEqual([
      'billing.checkout.pay_blocked',
      'billing.checkout.method_selected',
      'billing.checkout.submitted'
    ])
  })
})

const LAUNCH20_QUOTE = previewOf({
  quote_id: 'q_promo',
  amount_due_cents: 2240,
  promotion_code: 'LAUNCH20',
  discounts: [{ kind: 'promotion', code: 'LAUNCH20', amount_off_cents: 560 }]
})

function refusedWith(serverCode: string): PreviewSubscribeResult {
  return {
    status: 'error',
    code: 'REQUEST_FAILED',
    httpStatus: 400,
    serverCode: readBillingErrorCode({ code: serverCode, message: 'refused' })
  }
}

/** Answers a quote by the code it was asked for: none, LAUNCH20, or anything else. */
function quotesByCode(
  fake: FakeBillingClient,
  launch20: PreviewSubscribeResult = { status: 'ok', value: LAUNCH20_QUOTE }
) {
  fake.previewSubscribe.mockImplementation(async ({ promotionCode }) => {
    if (promotionCode === undefined)
      return { status: 'ok', value: previewOf({ quote_id: 'q_1' }) }
    return promotionCode.toUpperCase() === 'LAUNCH20'
      ? launch20
      : refusedWith('PROMOTION_CODE_INVALID')
  })
}

async function enterCode(code: string) {
  await userEvent.click(screen.getByRole('button', { name: 'Add promo code' }))
  await userEvent.type(
    screen.getByRole('textbox', { name: 'Promo code' }),
    code
  )
  await userEvent.click(screen.getByRole('button', { name: 'Apply' }))
}

const promoEvents = () =>
  journey().filter(({ name }) => name === 'billing.checkout.promo')

describe('the full-page checkout promo journey', () => {
  beforeEach(() => {
    vi.mocked(datadogRum.getInitConfiguration).mockReturnValue({
      clientToken: 'pub',
      applicationId: 'app'
    })
  })

  it.for<{
    name: string
    path: string
    act: (fake: FakeBillingClient) => Promise<void>
    reported: string[]
    promo: Record<string, unknown>
  }>([
    {
      name: 'a code the customer typed and the server priced',
      path: CHECKOUT_PATH,
      act: () => enterCode('launch20'),
      reported: ['promo'],
      promo: { result: 'applied', prefilled: false }
    },
    {
      name: 'a code the customer typed and the server refused',
      path: CHECKOUT_PATH,
      act: () => enterCode('NOPE'),
      reported: ['promo'],
      promo: { result: 'rejected', prefilled: false }
    },
    {
      name: 'a code the link carried, applied by the Pay over it',
      path: `${CHECKOUT_PATH}&promo=LAUNCH20`,
      act: async () => {
        form.emit('confirm', 'ctoken_1', 'card')
      },
      reported: ['pay_blocked', 'promo'],
      promo: { result: 'applied', prefilled: true }
    },
    {
      name: 'a code the link carried, taken off after the server priced it in other letters',
      path: `${CHECKOUT_PATH}&promo=launch20`,
      act: async () => {
        form.emit('confirm', 'ctoken_1', 'card')
        await userEvent.click(
          await screen.findByRole('button', { name: 'Remove LAUNCH20' })
        )
      },
      reported: ['pay_blocked', 'promo', 'promo'],
      promo: { result: 'removed', prefilled: true }
    },
    {
      name: 'a code the customer took off',
      path: CHECKOUT_PATH,
      act: async () => {
        await enterCode('LAUNCH20')
        await userEvent.click(
          await screen.findByRole('button', { name: 'Remove LAUNCH20' })
        )
      },
      reported: ['promo', 'promo'],
      promo: { result: 'removed', prefilled: false }
    },
    {
      name: 'an applied code Pay found lapsed',
      path: CHECKOUT_PATH,
      act: async (fake) => {
        fake.subscribe.mockResolvedValueOnce({
          status: 'error',
          code: 'QUOTE_STALE'
        })
        await enterCode('LAUNCH20')
        await screen.findByText('−$5.60')
        quotesByCode(fake, refusedWith('PROMOTION_CODE_INVALID'))
        form.emit('confirm', 'ctoken_1', 'card')
      },
      reported: ['promo', 'method_selected', 'submitted', 'promo'],
      promo: { result: 'expired', prefilled: false }
    }
  ])(
    'reports $name, never the code itself',
    async ({ path, act, reported, promo }) => {
      const fake = await renderCheckout({}, quotesByCode, path)
      await screen.findByText('Subscribe to Creator Plan · Acme Team')
      reportPhase({ phase: 'payment_element_ready', element: 'payment' })

      await act(fake)

      await waitFor(() =>
        expect(journeyNames().slice(3)).toEqual(
          reported.map((name) => `billing.checkout.${name}`)
        )
      )
      expect(journey().at(-1)).toMatchObject({ phase: 'promo', ...promo })
      expect(JSON.stringify(journey())).not.toMatch(/launch20|nope/i)
    }
  )

  it('reports nothing for a code that no quote could judge', async () => {
    await renderCheckout({}, (fake) =>
      quotesByCode(fake, { status: 'error', code: 'REQUEST_FAILED' })
    )
    await screen.findByText('Subscribe to Creator Plan · Acme Team')

    await enterCode('LAUNCH20')

    expect(await screen.findByRole('alert')).toBeInTheDocument()
    expect(promoEvents()).toHaveLength(0)
  })
})

describe('the full-page operation a Pay links', () => {
  beforeEach(() => {
    vi.mocked(datadogRum.getInitConfiguration).mockReturnValue({
      clientToken: 'pub',
      applicationId: 'app'
    })
  })

  const linked = () =>
    journey().filter(({ name }) => name === 'billing.checkout.operation_linked')

  async function renderReady(
    options: FakeBillingClientOptions = {},
    errorHandler?: (error: unknown) => void
  ) {
    const fake = await renderCheckout(
      options,
      () => {},
      CHECKOUT_PATH,
      errorHandler
    )
    await screen.findByText('Subscribe to Creator Plan · Acme Team')
    reportPhase({ phase: 'payment_element_ready', element: 'payment' })
    return fake
  }

  it.for<{ name: string; code: 'OPERATION_ALREADY_PENDING' | 'CONFLICT' }>([
    {
      name: 'a Pay refused because an operation is already pending',
      code: 'OPERATION_ALREADY_PENDING'
    },
    { name: 'a Pay refused as a conflict', code: 'CONFLICT' }
  ])(
    'does not link the operation the SDK surfaces after $name',
    async ({ code }) => {
      const fake = await renderReady()
      fake.subscribe.mockResolvedValueOnce({ status: 'error', code })
      fake.recover.mockImplementation(async () => {
        fake.publishOperation(pendingOperation('op_old'))
        return { status: 'ok', value: pendingOperation('op_old') }
      })

      form.emit('confirm', 'ctoken_1', 'card')
      await waitFor(() => expect(fake.subscribe).toHaveBeenCalled())
      await fake.subscribe.mock.results[0]?.value
      fake.publishOperation(pendingOperation('op_old'))
      expect(await screen.findByTestId('checkout-waiting')).toBeInTheDocument()
      reportPhase({ phase: 'payment_submit_attempted' })

      expect(linked()).toHaveLength(0)
      expect(journey().at(-1)).toMatchObject({
        name: 'billing.checkout.payment_submit_attempted'
      })
      expect(journey().at(-1)).not.toHaveProperty('billing_op_id')
    }
  )

  it.for<{
    name: string
    fail: (fake: FakeBillingClient) => void
    settled: () => Promise<unknown>
  }>([
    {
      name: 'a Pay whose request never got an answer',
      fail: (fake) =>
        fake.subscribe.mockResolvedValueOnce({
          status: 'error',
          code: 'REQUEST_FAILED'
        }),
      settled: () => screen.findByRole('alert')
    },
    {
      name: 'a Pay whose command rejects',
      fail: (fake) =>
        fake.subscribe.mockRejectedValueOnce(new TypeError('Failed to fetch')),
      settled: () => waitFor(() => expect(vueErrors).toHaveLength(1))
    }
  ])(
    'does not link an operation that appears after $name',
    async ({ fail, settled }) => {
      const fake = await renderReady({}, (error) => vueErrors.push(error))
      fail(fake)

      form.emit('confirm', 'ctoken_1', 'card')
      await settled()
      fake.publishOperation(pendingOperation('op_late'))
      await nextTick()

      expect(linked()).toHaveLength(0)
    }
  )

  it('links the operation a Pay issued once, with its id, whatever follows', async () => {
    const fake = await renderReady({
      subscribe: {
        status: 'ok',
        value: { phase: 'succeeded', operation: succeededOperation('op_9') }
      }
    })

    form.emit('confirm', 'ctoken_1', 'card')
    await waitFor(() => expect(fake.subscribe).toHaveBeenCalled())
    await fake.subscribe.mock.results[0]?.value
    fake.publishOperation(succeededOperation('op_9'))
    await waitFor(() => expect(linked()).toHaveLength(1))

    expect(linked()).toMatchObject([{ billing_op_id: 'op_9' }])
  })
})

describe('the full-page checkout exits and endings', () => {
  beforeEach(() => {
    vi.mocked(datadogRum.getInitConfiguration).mockReturnValue({
      clientToken: 'pub',
      applicationId: 'app'
    })
    vi.spyOn(window.location, 'assign').mockImplementation(() => {})
  })

  const leavePage = () => {
    window.dispatchEvent(new PageTransitionEvent('pagehide'))
  }
  const exitsOf = () =>
    journey().filter(({ name }) => name === 'billing.checkout.abandoned')

  it.for<{ name: string; leave: () => Promise<void> | void; exit: string }>([
    { name: 'the page goes away', leave: leavePage, exit: 'page_exit' },
    {
      name: 'the customer goes Back',
      leave: () =>
        userEvent.click(screen.getByRole('button', { name: 'Back' })),
      exit: 'back'
    }
  ])(
    'reports a checkout abandoned once, at its last phase, when $name',
    async ({ leave, exit }) => {
      await renderCheckout()
      await waitFor(() =>
        expect(journeyNames()).toContain('billing.checkout.preview_ready')
      )

      await leave()
      leavePage()

      expect(exitsOf()).toEqual([
        expect.objectContaining({
          phase: 'abandoned',
          last_phase: 'preview_ready',
          exit,
          billing_surface: 'billing_web'
        })
      ])
    }
  )

  async function payWithAlipayHeld() {
    const fake = await renderCheckout()
    await screen.findByText('Subscribe to Creator Plan · Acme Team')
    fake.subscribe.mockImplementation(() => new Promise(() => {}))
    reportPhase({ phase: 'payment_element_ready', element: 'payment' })
    form.emit('confirm', 'ctoken_1', 'alipay')
    await waitFor(() => expect(fake.subscribe).toHaveBeenCalled())
    return fake
  }

  it('reports an abandon for a page that closes while its Alipay request is still pending', async () => {
    await payWithAlipayHeld()

    leavePage()

    expect(exitsOf()).toEqual([
      expect.objectContaining({ last_phase: 'submitted', exit: 'page_exit' })
    ])
  })

  it('reports no abandon for a page whose Alipay challenge took it to the provider', async () => {
    const fake = await payWithAlipayHeld()
    fake.publishOperation({
      ...pendingOperation('op_3ds'),
      authenticationState: 'requires_action',
      challenge: { clientSecret: 'cs', status: 'in_progress' }
    })
    await nextTick()

    leavePage()

    expect(exitsOf()).toEqual([])
  })

  it('reports an abandon for a page the customer came Back to from a hosted step, then closed', async () => {
    const fake = await renderCheckout()
    await screen.findByText('Subscribe to Creator Plan · Acme Team')
    fake.subscribe.mockImplementation(() => new Promise(() => {}))
    reportPhase({ phase: 'payment_element_ready', element: 'payment' })
    form.emit('confirm', 'ctoken_1', 'card')
    await waitFor(() => expect(fake.subscribe).toHaveBeenCalled())
    const hosted = hostedPendingOperation('https://pay.test/3ds', 'op_hosted')
    fake.publishOperation(hosted)
    await waitFor(() =>
      expect(window.location.assign).toHaveBeenCalledWith(
        'https://pay.test/3ds'
      )
    )
    leavePage()
    expect(exitsOf()).toEqual([])

    fake.recover.mockResolvedValue({ status: 'ok', value: hosted })
    const restored = new Event('pageshow')
    Object.defineProperty(restored, 'persisted', { value: true })
    window.dispatchEvent(restored)
    await waitFor(() => expect(fake.recover).toHaveBeenCalledTimes(2))
    leavePage()

    expect(exitsOf()).toEqual([
      expect.objectContaining({ phase: 'abandoned', exit: 'page_exit' })
    ])
  })

  it('reports an abandon after an ending the customer retried past', async () => {
    await renderCheckout({}, (fake) =>
      fake.readCapabilities.mockResolvedValueOnce({
        status: 'error',
        code: 'REQUEST_FAILED'
      })
    )
    await waitFor(() =>
      expect(journeyNames()).toContain('billing.checkout.ended')
    )
    await userEvent.click(screen.getByRole('button', { name: 'Try again' }))
    await waitFor(() =>
      expect(journeyNames()).toContain('billing.checkout.preview_ready')
    )

    leavePage()

    expect(exitsOf()).toEqual([
      expect.objectContaining({
        last_phase: 'preview_ready',
        exit: 'page_exit'
      })
    ])
  })

  it('reports the ending its own payment reached, and no abandon after it', async () => {
    const fake = await renderCheckout({
      subscribe: {
        status: 'ok',
        value: { phase: 'succeeded', operation: succeededOperation('op_9') }
      }
    })
    await screen.findByText('Subscribe to Creator Plan · Acme Team')
    reportPhase({ phase: 'payment_element_ready', element: 'payment' })
    form.emit('confirm', 'ctoken_1', 'card')
    await waitFor(() => expect(fake.subscribe).toHaveBeenCalled())
    await waitFor(() =>
      expect(journeyNames()).toContain('billing.checkout.ended')
    )

    leavePage()

    expect(
      journey().filter(({ name }) => name === 'billing.checkout.ended')
    ).toEqual([
      expect.objectContaining({
        phase: 'ended',
        ending_kind: 'success',
        attribution: 'started'
      })
    ])
    expect(exitsOf()).toEqual([])
  })

  it('reports an ending no payment reached without an attribution', async () => {
    await renderCheckout({
      capabilities: {},
      denials: { can_subscribe_self_serve: 'not_workspace_owner' }
    })

    await waitFor(() =>
      expect(journeyNames()).toContain('billing.checkout.ended')
    )
    const [ended] = journey().filter(
      ({ name }) => name === 'billing.checkout.ended'
    )
    expect(ended).toMatchObject({ ending_kind: 'refused' })
    expect(ended).not.toHaveProperty('attribution')
  })
})
