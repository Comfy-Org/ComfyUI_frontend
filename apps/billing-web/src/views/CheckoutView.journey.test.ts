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
import type { FakeBillingClientOptions } from '@/test/fakeBillingClient'
import {
  createFakeBillingClient,
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
  options: FakeBillingClientOptions = {}
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

    await waitFor(() => expect(journey()).toHaveLength(2))
    expect(journeyNames()[0]).toBe('billing.checkout.entered')
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
        'billing.checkout.submitted',
        'billing.checkout.operation_linked'
      ])
    )
    const [, , , , submitted, linked] = journey()
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
})
