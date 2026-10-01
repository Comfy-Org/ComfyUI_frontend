import { datadogRum } from '@datadog/browser-rum'
import { render, waitFor } from '@testing-library/vue'
import { defineComponent, h, ref } from 'vue'
import { createMemoryHistory, createRouter } from 'vue-router'

import type {
  PreviewSubscribeResult,
  SubscriptionPreview
} from '@comfyorg/account-core/billing'
import { BILLING_CLIENT_KEY } from '@comfyorg/account-ui/billing'
import { parseBillingEntry } from '@comfyorg/billing-contract'

import { recordBillingEntry } from '@/entry/billingEntry'
import { createBillingI18n } from '@/i18n'
import type {
  FakeBillingClient,
  FakeBillingClientOptions
} from '@/test/fakeBillingClient'
import { createFakeBillingClient, previewOf } from '@/test/fakeBillingClient'
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

/** The card form is covered in its package; here it takes the place of the provider's form. */
const PaymentFormStub = defineComponent({
  name: 'CheckoutPaymentForm',
  props: {
    submitLabel: { type: String, default: '' },
    canSubmit: { type: Boolean, default: true }
  },
  emits: ['confirm', 'phase'],
  setup(props) {
    return () =>
      h(
        'button',
        { type: 'submit', disabled: !props.canSubmit },
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
  arrange: (fake: FakeBillingClient) => void = () => {}
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
      stubs: { CheckoutPaymentForm: PaymentFormStub }
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

const nextMacrotask = () => new Promise((resolve) => setTimeout(resolve))

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

  it('reports nothing for a quote a newer one overtook', async () => {
    let answerOvertaken: (result: PreviewSubscribeResult) => void = () => {}
    const fake = await renderCheckout(CHECKOUT_PATH, {}, (client) =>
      client.previewSubscribe.mockImplementationOnce(
        () => new Promise((resolve) => (answerOvertaken = resolve))
      )
    )
    await waitFor(() => expect(fake.previewSubscribe).toHaveBeenCalledOnce())
    const next = `/v1/checkout?${ENTRY_QUERY}&plan=creator_annual`
    recordBillingEntry(parseBillingEntry(next))
    await fake.router.push(next)
    await waitFor(() => expect(journey()).toHaveLength(2))

    answerOvertaken({ status: 'error', code: 'REQUEST_FAILED' })
    await nextMacrotask()

    expect(journeyNames()).toEqual([
      'billing.checkout.entered',
      'billing.checkout.preview_ready'
    ])
  })
})
