import { datadogRum } from '@datadog/browser-rum'
import { render, screen, waitFor } from '@testing-library/vue'
import { ref } from 'vue'
import type { VNode } from 'vue'

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
  path = CHECKOUT_PATH
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
      provide: { [BILLING_CLIENT_KEY]: fake.client }
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

const REFUSED_BY_THE_SERVER = {
  status: 'error',
  code: 'REQUEST_FAILED',
  httpStatus: 400,
  serverCode: readBillingErrorCode({ code: 'INVALID_PLAN', message: 'no' })
} as const

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
})
