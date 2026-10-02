import { datadogRum } from '@datadog/browser-rum'
import { render, screen, waitFor } from '@testing-library/vue'
import { defineComponent, h, ref } from 'vue'
import { createMemoryHistory, createRouter } from 'vue-router'

import type { BillingSession } from '@comfyorg/account-core/billing'
import type { AccountCredential } from '@comfyorg/account-core/session'
import {
  BILLING_CLIENT_KEY,
  disposeBillingClient
} from '@comfyorg/account-ui/billing'
import { parseBillingEntry } from '@comfyorg/billing-contract'

import { recordBillingEntry } from '@/entry/billingEntry'
import { createBillingI18n } from '@/i18n'
import type { BillingWebClient } from '@/session/billingWebClient'
import { createBillingWebClient } from '@/session/billingWebClient'
import { WORKSPACE_INVITES_KEY } from '@/session/workspaceInvites'
import { previewOf } from '@/test/fakeBillingClient'
import CheckoutView from '@/views/CheckoutView.vue'

vi.mock(import('@datadog/browser-rum'))

vi.mock<unknown>(import('@/config/env'), () => ({
  BILLING_WEB_ENV: 'test',
  CLOUD_BASE_URL: 'https://testcloud.comfy.org'
}))

vi.mock(import('@/config/stripeKey'), () => ({
  awaitBillingWebStripeKey: () => Promise.resolve('pk_test_example'),
  useBillingWebStripeKey: () => ref('pk_test_example'),
  billingWebStripeKey: () => 'pk_test_example'
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

let reportConfirm: (
  confirmationToken: string,
  methodType: string
) => void = () => {}

const PaymentFormStub = defineComponent({
  name: 'CheckoutPaymentForm',
  props: {
    submitLabel: { type: String, default: '' },
    canSubmit: { type: Boolean, default: true }
  },
  emits: ['confirm', 'phase'],
  setup(props, { emit }) {
    reportConfirm = (token, methodType) => emit('confirm', token, methodType)
    return () =>
      h(
        'button',
        { type: 'submit', disabled: !props.canSubmit },
        props.submitLabel
      )
  }
})

const CREDENTIAL: AccountCredential = {
  token: 'jwt-1',
  permissions: ['workspace:read'],
  expiresAt: Date.now() + 3_600_000,
  uid: 'uid-1',
  workspace: { id: 'ws-1', name: 'Personal', type: 'personal' },
  role: 'owner'
}

function authenticatedSession(): BillingSession {
  const session: BillingSession = {
    getSnapshot: () => ({
      phase: 'authenticated',
      user: { uid: 'uid-1', getIdToken: async () => 'id-token' },
      session: CREDENTIAL
    }),
    subscribe: () => () => {},
    ensureFresh: vi.fn(),
    remint: vi.fn()
  }
  vi.mocked(session.ensureFresh).mockResolvedValue({
    status: 'ok',
    session: CREDENTIAL
  })
  return session
}

/**
 * The network edge: the billing routes a successful Pay touches, answered by
 * route. The server answers the operation's first poll only once the test
 * lets it, the way a network round trip lands after the page has already seen
 * the operation pending.
 */
function stubBillingRoutes() {
  let answerPoll: () => void = () => {}
  const polled = new Promise<void>((resolve) => {
    answerPoll = resolve
  })
  const answers: Record<string, unknown> = {
    '/api/billing/status': {
      billing_rail: 'stripe',
      has_funds: true,
      is_active: true,
      max_seats: 1,
      occupied_seats: 1,
      scheduled_change: null,
      team_credit_stop: null
    },
    '/api/billing/preview-subscribe': previewOf({
      quote_id: 'q_1',
      quote_version: 3,
      amount_due_cents: 2800,
      currency: 'usd'
    }),
    '/api/billing/subscribe': {
      billing_op_id: 'op_1',
      status: 'pending_payment'
    },
    '/api/billing/ops/op_1': {
      id: 'op_1',
      started_at: '2026-09-14T00:00:00.000Z',
      status: 'succeeded'
    }
  }
  vi.stubGlobal(
    'fetch',
    vi.fn(async (url: string) => {
      const { pathname } = new URL(url)
      if (pathname === '/api/billing/ops/op_1') await polled
      const body = answers[pathname]
      return new Response(JSON.stringify(body ?? {}), {
        status: body === undefined ? 404 : 200,
        headers: { 'Content-Type': 'application/json' }
      })
    })
  )
  return answerPoll
}

const FAMILIES = [
  'billing.checkout.',
  'billing.subscription_checkout.',
  'billing.operation.'
]

/** Everything a Pay reports: the journey, the attempt and the SDK stream, in the order RUM got it. */
function reported() {
  return vi
    .mocked(datadogRum.addAction)
    .mock.calls.filter(([name]) =>
      FAMILIES.some((family) => name.startsWith(family))
    )
    .map(([name, context]) => ({
      name,
      billingOpId:
        context !== undefined && 'billing_op_id' in context
          ? context.billing_op_id
          : undefined
    }))
}

let client: BillingWebClient | undefined

afterEach(() => {
  if (client) disposeBillingClient(client)
  client = undefined
})

describe('the embedded checkout journey beside the attempt and the SDK stream', () => {
  it('orders one successful Pay across all three, joined by the operation it issued', async () => {
    vi.mocked(datadogRum.getInitConfiguration).mockReturnValue({
      clientToken: 'pub',
      applicationId: 'app'
    })
    const answerPoll = stubBillingRoutes()
    const path =
      '/v1/checkout?product=comfyui&return_to=comfyui_workspace&plan=creator_monthly&source=subscribe_now_button'
    recordBillingEntry(parseBillingEntry(path))
    const router = createRouter({
      history: createMemoryHistory(),
      routes: [{ path: '/v1/checkout', component: CheckoutView }]
    })
    client = createBillingWebClient(authenticatedSession())
    await router.push(path)
    await router.isReady()
    render(CheckoutView, {
      global: {
        plugins: [createBillingI18n(), router],
        provide: {
          [BILLING_CLIENT_KEY]: client,
          [WORKSPACE_INVITES_KEY]: client.invites
        },
        stubs: { CheckoutPaymentForm: PaymentFormStub }
      }
    })
    await screen.findByRole('button', { name: 'Pay and subscribe' })

    reportConfirm('ctoken_1', 'card')

    await waitFor(() =>
      expect(reported().map(({ name }) => name)).toContain(
        'billing.checkout.operation_linked'
      )
    )
    answerPoll()
    await waitFor(() =>
      expect(reported().map(({ name }) => name)).toContain(
        'billing.subscription_checkout.succeeded'
      )
    )

    expect(reported()).toEqual([
      { name: 'billing.checkout.entered' },
      { name: 'billing.checkout.preview_ready' },
      { name: 'billing.checkout.method_selected' },
      { name: 'billing.checkout.submitted' },
      { name: 'billing.subscription_checkout.intent' },
      { name: 'billing.subscription_checkout.started' },
      { name: 'billing.operation.started', billingOpId: 'op_1' },
      { name: 'billing.checkout.operation_linked', billingOpId: 'op_1' },
      { name: 'billing.operation.succeeded', billingOpId: 'op_1' },
      { name: 'billing.subscription_checkout.succeeded', billingOpId: 'op_1' }
    ])
  })
})
