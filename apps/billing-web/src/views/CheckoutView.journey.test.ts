import { datadogRum } from '@datadog/browser-rum'
import userEvent from '@testing-library/user-event'
import { render, screen, waitFor } from '@testing-library/vue'
import { defineComponent, h, ref } from 'vue'
import { createMemoryHistory, createRouter } from 'vue-router'

import type {
  PreviewSubscribeResult,
  SubscriptionPreview
} from '@comfyorg/account-core/billing'
import { readBillingErrorCode } from '@comfyorg/account-core/billing'
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
  hostedPendingOperation,
  pendingOperation,
  previewOf,
  succeededOperation
} from '@/test/fakeBillingClient'
import { WORKSPACE_INVITES_KEY } from '@/session/workspaceInvites'
import CheckoutView from '@/views/CheckoutView.vue'

vi.mock(import('@datadog/browser-rum'))

const ENTRY_QUERY = 'product=comfyui&return_to=comfyui_workspace'
const CHECKOUT_PATH = `/v1/checkout?${ENTRY_QUERY}&plan=creator_monthly`

vi.mock<unknown>(import('@/config/env'), () => ({
  BILLING_WEB_ENV: 'test',
  CLOUD_BASE_URL: 'https://testcloud.comfy.org'
}))

vi.mock(import('@/config/stripeKey'), () => ({
  awaitBillingWebStripeKey: () => Promise.resolve('pk_test_example'),
  useBillingWebStripeKey: () => ref('pk_test_example')
}))

vi.mock(import('@/session/billingWebSession'), async () => {
  const { computed } = await import('vue')
  return {
    useBillingWebSession: () => ({
      phase: computed(() => 'signed-out' as const),
      user: computed(() => null),
      session: computed(() => undefined),
      failure: computed(() => undefined)
    })
  }
})

vi.mock(import('@/entry/workspaceBinding'), () => ({
  boundWorkspaceId: () => undefined,
  bindEntryWorkspace: () => false
}))

vi.mock(import('@/session/stripeChallengePort'), () => ({
  createDeferredStripeChallengePort: () => ({
    handleNextAction: async () => ({}),
    leavesPage: () => Promise.resolve(true)
  })
}))

let reportPhase: (phase: StripePaymentPhase) => void = () => {}
let reportConfirm: (
  confirmationToken: string,
  methodType?: string
) => void = () => {}

/** The card form is covered in its package; here it takes the place of the provider's form. */
const PaymentFormStub = defineComponent({
  name: 'CheckoutPaymentForm',
  props: {
    submitLabel: { type: String, default: '' },
    isLoading: { type: Boolean, default: false },
    canSubmit: { type: Boolean, default: true }
  },
  emits: ['confirm', 'phase'],
  setup(props, { emit }) {
    reportPhase = (phase) => emit('phase', phase)
    reportConfirm = (token, methodType) => emit('confirm', token, methodType)
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

function cardQuote(overrides: Partial<SubscriptionPreview> = {}) {
  return previewOf({
    quote_id: 'q_1',
    quote_version: 3,
    amount_due_cents: 2800,
    currency: 'usd',
    ...overrides
  })
}

async function renderCheckout(
  path = CHECKOUT_PATH,
  options: FakeBillingClientOptions = {},
  arrange: (fake: FakeBillingClient) => void = () => {},
  errorHandler?: (error: unknown) => void
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
  arrange(fake)
  await router.push(path)
  await router.isReady()
  render(CheckoutView, {
    global: {
      plugins: [createBillingI18n(), router],
      provide: {
        [BILLING_CLIENT_KEY]: fake.client,
        [WORKSPACE_INVITES_KEY]: fake.invites
      },
      stubs: { CheckoutPaymentForm: PaymentFormStub },
      ...(errorHandler === undefined ? {} : { config: { errorHandler } })
    }
  })
  return { ...fake, router }
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

const vueErrors: unknown[] = []

beforeEach(() => {
  vueErrors.length = 0
})

describe('the embedded checkout journey', () => {
  beforeEach(() => {
    vi.mocked(datadogRum.getInitConfiguration).mockReturnValue({
      clientToken: 'pub',
      applicationId: 'app'
    })
  })

  it('continues the cloud journey and entry the link carries', async () => {
    await renderCheckout(
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
      ui_mode: 'embedded',
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
    expect(journey()[0]).toMatchObject({ entry_source: 'unknown' })
    expect(journey()[0]).not.toHaveProperty('payment_intent_source')
  })

  it.for<{
    name: string
    options: FakeBillingClientOptions
    last: Record<string, unknown>
  }>([
    {
      name: 'a plan change reads as a paid upgrade',
      options: {
        preview: {
          status: 'ok',
          value: cardQuote({ transition_type: 'upgrade' })
        }
      },
      last: { phase: 'preview_ready', entry_flow: 'paid_upgrade' }
    },
    {
      name: 'a quote the server refuses fails the preview',
      options: {
        preview: { status: 'ok', value: cardQuote({ allowed: false }) }
      },
      last: {
        phase: 'preview_failed',
        failure_category: 'api_rejected',
        error_code: 'quote_not_allowed'
      }
    },
    {
      name: 'a quote that never got an answer fails as a network failure',
      options: { preview: { status: 'error', code: 'REQUEST_FAILED' } },
      last: { phase: 'preview_failed', failure_category: 'network' }
    },
    {
      name: 'a quote the server answered with an error fails as a rejection',
      options: {
        preview: { status: 'error', code: 'REQUEST_FAILED', httpStatus: 503 }
      },
      last: { phase: 'preview_failed', failure_category: 'api_rejected' }
    },
    {
      name: 'a refused session fails as a rejection',
      options: { preview: { status: 'error', code: 'ACCESS_DENIED' } },
      last: { phase: 'preview_failed', failure_category: 'api_rejected' }
    }
  ])('$name', async ({ options, last }) => {
    await renderCheckout(CHECKOUT_PATH, options)

    await waitFor(() => expect(journey()[1]).toMatchObject(last))
    expect(journeyNames()[0]).toBe('billing.checkout.entered')
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
    await screen.findByRole('button', { name: 'Pay and subscribe' })

    reportPhase(phase)

    await waitFor(() => expect(journey()).toHaveLength(3))
    expect(journey()[2]).toMatchObject({
      name: `billing.checkout.${phase.phase}`,
      ...reported,
      ui_mode: 'embedded',
      billing_surface: 'billing_web'
    })
  })

  it('reports the journey of a payment from the first look to the operation it issued', async () => {
    const fake = await renderCheckout(CHECKOUT_PATH, {
      subscribe: {
        status: 'ok',
        value: { phase: 'succeeded', operation: succeededOperation('op_9') }
      }
    })
    await screen.findByRole('button', { name: 'Pay and subscribe' })

    reportPhase({ phase: 'payment_element_ready', element: 'payment' })
    reportPhase({ phase: 'payment_submit_attempted' })
    reportConfirm('ctoken_1')

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
    await screen.findByRole('button', { name: 'Pay and subscribe' })
    fake.subscribe.mockResolvedValueOnce({ status: 'error', code: 'CONFLICT' })

    reportConfirm('ctoken_1')

    expect(await screen.findByRole('alert')).toBeInTheDocument()
    expect(journeyNames()).toEqual([
      'billing.checkout.entered',
      'billing.checkout.preview_ready',
      'billing.checkout.method_selected',
      'billing.checkout.submitted'
    ])
  })

  it('reports no operation for one the checkout recovered rather than paid', async () => {
    await renderCheckout(CHECKOUT_PATH, {
      recover: { status: 'ok', value: pendingOperation('op_old') }
    })

    await waitFor(() =>
      expect(
        screen.getByRole('button', { name: 'Pay and subscribe' })
      ).toHaveAttribute('aria-busy', 'true')
    )
    expect(journeyNames()).toEqual([
      'billing.checkout.entered',
      'billing.checkout.preview_ready'
    ])
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
      choose: () => reportConfirm('ctoken_1', 'card'),
      selected: { rail: 'new', method_kind: 'card' }
    },
    {
      name: 'a new Alipay account',
      options: {},
      choose: () => reportConfirm('ctoken_1', 'alipay'),
      selected: { rail: 'new', method_kind: 'alipay' }
    },
    {
      name: 'a new method of any other type',
      options: {},
      choose: () => reportConfirm('ctoken_1', 'sepa_debit'),
      selected: { rail: 'new', method_kind: 'other' }
    },
    {
      name: 'the saved card the confirm preselects',
      options: {
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
      },
      choose: async () => {
        await screen.findByText('visa •••• 4242')
        await userEvent.click(
          screen.getByRole('button', { name: 'Pay and subscribe' })
        )
      },
      selected: { rail: 'saved', method_kind: 'card' }
    },
    {
      name: 'the method on file for a plan change',
      options: {
        preview: {
          status: 'ok',
          value: cardQuote({ transition_type: 'upgrade' })
        }
      },
      choose: async () =>
        userEvent.click(
          await screen.findByRole('button', { name: 'Confirm upgrade' })
        ),
      selected: { rail: 'on_file' }
    }
  ])(
    'reports $name as the method chosen, just before the submit',
    async ({ options, choose, selected }) => {
      await renderCheckout(CHECKOUT_PATH, options)
      await waitFor(() => expect(journey()).toHaveLength(2))

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

  it('leaves a method the form could not name without a kind', async () => {
    await renderCheckout()
    await waitFor(() => expect(journey()).toHaveLength(2))

    reportConfirm('ctoken_1')

    await waitFor(() => expect(journey()).toHaveLength(4))
    expect(journey()[2]).toMatchObject({ rail: 'new' })
    expect(journey()[2]).not.toHaveProperty('method_kind')
  })

  it.for<{
    name: string
    answer: PreviewSubscribeResult
    result: string
  }>([
    {
      name: 'a code the server priced',
      answer: {
        status: 'ok',
        value: cardQuote({ promotion_code: 'SPRING', quote_version: 4 })
      },
      result: 'applied'
    },
    {
      name: 'a code the server refused',
      answer: {
        status: 'error',
        code: 'REQUEST_FAILED',
        httpStatus: 400,
        serverCode: readBillingErrorCode({
          code: 'PROMOTION_CODE_INVALID',
          message: 'refused'
        })
      },
      result: 'rejected'
    }
  ])(
    'reports $name as $result, never the code itself',
    async ({ answer, result }) => {
      const fake = await renderCheckout()
      await screen.findByRole('button', { name: 'Pay and subscribe' })
      await userEvent.type(
        screen.getByRole('textbox', { name: 'Promo code' }),
        'SPRING'
      )
      fake.previewSubscribe.mockResolvedValue(answer)

      await userEvent.click(screen.getByRole('button', { name: 'Apply' }))

      await waitFor(() =>
        expect(journeyNames().at(-1)).toBe('billing.checkout.promo')
      )
      expect(journey().at(-1)).toMatchObject({
        phase: 'promo',
        result,
        prefilled: false
      })
      expect(JSON.stringify(journey())).not.toContain('SPRING')
    }
  )

  it('reports nothing for a code that no quote could judge', async () => {
    const fake = await renderCheckout()
    await screen.findByRole('button', { name: 'Pay and subscribe' })
    await userEvent.type(
      screen.getByRole('textbox', { name: 'Promo code' }),
      'SPRING'
    )
    fake.previewSubscribe.mockResolvedValue({
      status: 'error',
      code: 'REQUEST_FAILED'
    })

    await userEvent.click(screen.getByRole('button', { name: 'Apply' }))

    expect(await screen.findByRole('alert')).toBeInTheDocument()
    expect(journeyNames()).toEqual([
      'billing.checkout.entered',
      'billing.checkout.preview_ready'
    ])
  })

  it.for<{ name: string; requoted: SubscriptionPreview; ready: number }>([
    {
      name: 'the quote the server prices again unchanged',
      requoted: cardQuote(),
      ready: 1
    },
    {
      name: 'a quote of a new revision',
      requoted: cardQuote({ quote_version: 4 }),
      ready: 2
    }
  ])(
    'reports $ready preview_ready for $name after a stale quote',
    async ({ requoted, ready }) => {
      const fake = await renderCheckout()
      await waitFor(() => expect(journey()).toHaveLength(2))
      fake.subscribe.mockResolvedValueOnce({
        status: 'error',
        code: 'QUOTE_STALE'
      })
      fake.previewSubscribe.mockResolvedValue({ status: 'ok', value: requoted })

      reportConfirm('ctoken_1', 'card')

      expect(await screen.findByRole('alert')).toBeInTheDocument()
      expect(
        journeyNames().filter(
          (name) => name === 'billing.checkout.preview_ready'
        )
      ).toHaveLength(ready)
    }
  )

  it('links each attempt to its own operation, never the one a declined attempt left', async () => {
    const fake = await renderCheckout()
    await waitFor(() => expect(journey()).toHaveLength(2))
    fake.subscribe
      .mockImplementationOnce(async () => {
        const operation = failedOperation('card_declined', 'op_1')
        fake.publishOperation(operation)
        return { status: 'ok', value: { phase: 'failed', operation } }
      })
      .mockImplementationOnce(async () => {
        const operation = succeededOperation('op_2')
        fake.publishOperation(operation)
        return { status: 'ok', value: { phase: 'succeeded', operation } }
      })

    reportConfirm('ctoken_1', 'card')
    expect(await screen.findByRole('alert')).toBeInTheDocument()
    reportConfirm('ctoken_2', 'card')

    await waitFor(() =>
      expect(
        journeyNames().filter(
          (name) => name === 'billing.checkout.operation_linked'
        )
      ).toHaveLength(2)
    )
    const submissions = journey().filter(
      ({ name }) => name === 'billing.checkout.submitted'
    )
    expect(submissions[1]).not.toHaveProperty('billing_op_id')
    expect(
      journey().filter(
        ({ name }) => name === 'billing.checkout.operation_linked'
      )
    ).toMatchObject([{ billing_op_id: 'op_1' }, { billing_op_id: 'op_2' }])
  })

  it('reports nothing for a re-quote a newer quote overtook', async () => {
    let answerOvertaken: (result: PreviewSubscribeResult) => void = () => {}
    const fake = await renderCheckout()
    await waitFor(() => expect(journey()).toHaveLength(2))
    fake.subscribe.mockResolvedValueOnce({
      status: 'error',
      code: 'QUOTE_STALE'
    })
    fake.previewSubscribe
      .mockImplementationOnce(
        () => new Promise((resolve) => (answerOvertaken = resolve))
      )
      .mockResolvedValueOnce({
        status: 'ok',
        value: cardQuote({ quote_version: 5 })
      })
    reportConfirm('ctoken_1', 'card')
    await waitFor(() => expect(fake.previewSubscribe).toHaveBeenCalledTimes(2))
    const next = `/v1/checkout?${ENTRY_QUERY}&plan=creator_annual`
    recordBillingEntry(parseBillingEntry(next))
    await fake.router.push(next)
    await waitFor(() =>
      expect(
        journeyNames().filter(
          (name) => name === 'billing.checkout.preview_ready'
        )
      ).toHaveLength(2)
    )
    expect(screen.queryByRole('alert')).not.toBeInTheDocument()

    answerOvertaken({ status: 'error', code: 'REQUEST_FAILED' })
    expect(await screen.findByRole('alert')).toBeInTheDocument()

    expect(journeyNames()).not.toContain('billing.checkout.preview_failed')
  })

  it('reports nothing for a promo quote a newer one overtook', async () => {
    let answerOvertaken: (result: PreviewSubscribeResult) => void = () => {}
    const fake = await renderCheckout()
    await screen.findByRole('button', { name: 'Pay and subscribe' })
    await userEvent.type(
      screen.getByRole('textbox', { name: 'Promo code' }),
      'SPRING'
    )
    fake.previewSubscribe.mockImplementationOnce(
      () => new Promise((resolve) => (answerOvertaken = resolve))
    )
    await userEvent.click(screen.getByRole('button', { name: 'Apply' }))
    await waitFor(() => expect(fake.previewSubscribe).toHaveBeenCalledTimes(2))
    const next = `/v1/checkout?${ENTRY_QUERY}&plan=creator_annual`
    recordBillingEntry(parseBillingEntry(next))
    await fake.router.push(next)
    await waitFor(() => expect(fake.previewSubscribe).toHaveBeenCalledTimes(3))
    expect(screen.getByRole('button', { name: 'Apply' })).toBeDisabled()

    answerOvertaken({
      status: 'ok',
      value: cardQuote({ promotion_code: 'SPRING', quote_version: 4 })
    })
    await waitFor(() =>
      expect(screen.getByRole('button', { name: 'Apply' })).toBeEnabled()
    )

    expect(journeyNames()).not.toContain('billing.checkout.promo')
  })

  describe('the operation a Pay links', () => {
    const linked = () =>
      journey().filter(
        ({ name }) => name === 'billing.checkout.operation_linked'
      )
    const payButton = () =>
      screen.getByRole('button', { name: 'Pay and subscribe' })

    it.for<{ name: string; code: 'OPERATION_ALREADY_PENDING' | 'CONFLICT' }>([
      {
        name: 'a Pay refused because an operation is already pending',
        code: 'OPERATION_ALREADY_PENDING'
      },
      { name: 'a Pay refused as a conflict', code: 'CONFLICT' }
    ])(
      'does not link the operation the SDK surfaces after $name',
      async ({ code }) => {
        const fake = await renderCheckout()
        await waitFor(() => expect(journey()).toHaveLength(2))
        fake.subscribe.mockResolvedValueOnce({ status: 'error', code })
        reportConfirm('ctoken_1', 'card')
        expect(await screen.findByRole('alert')).toBeInTheDocument()

        fake.publishOperation(pendingOperation('op_old'))
        await waitFor(() =>
          expect(payButton()).toHaveAttribute('aria-busy', 'true')
        )
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
          fake.subscribe.mockRejectedValueOnce(
            new TypeError('Failed to fetch')
          ),
        settled: () => waitFor(() => expect(vueErrors).toHaveLength(1))
      }
    ])(
      'does not link an operation that appears after $name',
      async ({ fail, settled }) => {
        const fake = await renderCheckout(
          CHECKOUT_PATH,
          {},
          () => {},
          (error) => vueErrors.push(error)
        )
        await waitFor(() => expect(journey()).toHaveLength(2))
        fail(fake)
        reportConfirm('ctoken_1', 'card')
        await settled()

        fake.publishOperation(pendingOperation('op_late'))
        await waitFor(() =>
          expect(payButton()).toHaveAttribute('aria-busy', 'true')
        )

        expect(linked()).toHaveLength(0)
      }
    )

    it('links the operation a Pay issued once, with its id, whatever follows', async () => {
      await renderCheckout(CHECKOUT_PATH, {
        subscribe: {
          status: 'ok',
          value: { phase: 'succeeded', operation: succeededOperation('op_9') }
        }
      })
      await waitFor(() => expect(journey()).toHaveLength(2))

      reportConfirm('ctoken_1', 'card')
      await screen.findByRole('heading', { name: "You're all set" })

      expect(linked()).toMatchObject([{ billing_op_id: 'op_9' }])
    })
  })
})

describe('the embedded checkout exits and endings', () => {
  beforeEach(() => {
    vi.mocked(datadogRum.getInitConfiguration).mockReturnValue({
      clientToken: 'pub',
      applicationId: 'app'
    })
    vi.spyOn(window.location, 'assign').mockImplementation(() => {})
    vi.spyOn(window, 'close').mockImplementation(() => {})
  })

  const leavePage = () => {
    window.dispatchEvent(new PageTransitionEvent('pagehide'))
  }
  const exitsOf = () =>
    journey().filter(({ name }) => name === 'billing.checkout.abandoned')
  const endingsOf = () =>
    journey().filter(({ name }) => name === 'billing.checkout.ended')

  it.for<{ name: string; leave: () => Promise<void> | void; exit: string }>([
    { name: 'the page goes away', leave: leavePage, exit: 'page_exit' },
    {
      name: 'the customer goes Back',
      leave: () =>
        userEvent.click(screen.getByRole('button', { name: 'Back' })),
      exit: 'back'
    },
    {
      name: 'the customer closes the checkout',
      leave: () =>
        userEvent.click(screen.getByRole('button', { name: 'Close' })),
      exit: 'close'
    }
  ])(
    'reports a checkout abandoned once, at its last phase, when $name',
    async ({ leave, exit }) => {
      await renderCheckout()
      await screen.findByRole('button', { name: 'Pay and subscribe' })
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
          ui_mode: 'embedded',
          billing_surface: 'billing_web'
        })
      ])
    }
  )

  it('reports no abandon for a page handed to a hosted payment step', async () => {
    const fake = await renderCheckout()
    await screen.findByRole('button', { name: 'Pay and subscribe' })

    fake.publishOperation(
      hostedPendingOperation('https://hooks.stripe.test/redirect/op_1')
    )
    await waitFor(() => expect(window.location.assign).toHaveBeenCalled())
    leavePage()

    expect(exitsOf()).toEqual([])
  })

  it('reports no abandon for a page that left for a payment method of its own site', async () => {
    const fake = await renderCheckout()
    await screen.findByRole('button', { name: 'Pay and subscribe' })
    fake.subscribe.mockImplementation(() => new Promise(() => {}))

    reportConfirm('ctoken_1', 'alipay')
    await waitFor(() => expect(fake.subscribe).toHaveBeenCalled())
    leavePage()

    expect(exitsOf()).toEqual([])
  })

  it('reports a card Pay still in flight when the page goes away as abandoned', async () => {
    const fake = await renderCheckout()
    await screen.findByRole('button', { name: 'Pay and subscribe' })
    fake.subscribe.mockImplementation(() => new Promise(() => {}))

    reportConfirm('ctoken_1', 'card')
    await waitFor(() => expect(fake.subscribe).toHaveBeenCalled())
    leavePage()

    expect(exitsOf()).toEqual([
      expect.objectContaining({ last_phase: 'submitted', exit: 'page_exit' })
    ])
  })

  it.for<{ name: string; type: string; label: string; exits: number }>([
    {
      name: 'a saved Alipay account, which pays on its own site',
      type: 'alipay',
      label: 'Alipay',
      exits: 0
    },
    { name: 'a saved card', type: 'card', label: 'visa •••• 4242', exits: 1 }
  ])(
    'reports $exits abandon when the page goes away during a Pay with $name',
    async ({ type, label, exits }) => {
      const fake = await renderCheckout(CHECKOUT_PATH, {
        paymentMethods: {
          status: 'ok',
          value: [
            {
              id: 'pm_saved',
              type,
              brand: 'visa',
              last4: '4242',
              is_default: true
            }
          ]
        }
      })
      await screen.findByText(label)
      fake.subscribe.mockImplementation(() => new Promise(() => {}))

      await userEvent.click(
        screen.getByRole('button', { name: 'Pay and subscribe' })
      )
      await waitFor(() => expect(fake.subscribe).toHaveBeenCalled())
      leavePage()

      expect(exitsOf()).toHaveLength(exits)
    }
  )

  it('reports the success its own payment reached, and no abandon after it', async () => {
    await renderCheckout(CHECKOUT_PATH, {
      subscribe: {
        status: 'ok',
        value: { phase: 'succeeded', operation: succeededOperation('op_9') }
      }
    })
    await screen.findByRole('button', { name: 'Pay and subscribe' })

    reportConfirm('ctoken_1', 'card')
    await screen.findByRole('heading', { name: "You're all set" })
    await waitFor(() => expect(endingsOf()).toHaveLength(1))
    const [, closeButton] = screen.getAllByRole('button', { name: 'Close' })
    await userEvent.click(closeButton)
    leavePage()

    expect(endingsOf()).toEqual([
      expect.objectContaining({
        phase: 'ended',
        ending_kind: 'success',
        attribution: 'started',
        billing_op_id: 'op_9'
      })
    ])
    expect(exitsOf()).toEqual([])
  })

  it('reports a success this page recovered rather than paid as followed', async () => {
    await renderCheckout(CHECKOUT_PATH, {
      recover: { status: 'ok', value: succeededOperation('op_old') }
    })

    await screen.findByRole('heading', { name: "You're all set" })
    await waitFor(() => expect(endingsOf()).toHaveLength(1))

    expect(endingsOf()[0]).toMatchObject({
      ending_kind: 'success',
      attribution: 'followed'
    })
    expect(endingsOf()[0]).not.toHaveProperty('billing_op_id')
  })

  it.for<{
    name: string
    preview: PreviewSubscribeResult
    kind: string
  }>([
    {
      name: 'a session the quote refused',
      preview: { status: 'error', code: 'ACCESS_DENIED' },
      kind: 'refused'
    },
    {
      name: 'a plan the catalog does not have',
      preview: {
        status: 'error',
        code: 'REQUEST_FAILED',
        httpStatus: 400,
        serverCode: readBillingErrorCode({
          code: 'INVALID_PLAN',
          message: 'unknown plan'
        })
      },
      kind: 'plan_unavailable'
    },
    {
      name: 'a quote that never got an answer',
      preview: { status: 'error', code: 'REQUEST_FAILED' },
      kind: 'load_failed'
    }
  ])(
    'reports the ending screen of $name without an attribution, and no abandon after it',
    async ({ preview, kind }) => {
      await renderCheckout(CHECKOUT_PATH, { preview })
      await screen.findByRole('button', { name: 'Back' })

      await userEvent.click(screen.getByRole('button', { name: 'Back' }))
      leavePage()

      expect(endingsOf()).toEqual([
        expect.objectContaining({ phase: 'ended', ending_kind: kind })
      ])
      expect(endingsOf()[0]).not.toHaveProperty('attribution')
      expect(exitsOf()).toEqual([])
    }
  )
})
