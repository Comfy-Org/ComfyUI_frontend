import { datadogRum } from '@datadog/browser-rum'

import type { BillingSession } from '@comfyorg/account-core/billing'
import type { BillingClient } from '@comfyorg/account-ui/billing'
import { disposeBillingClient } from '@comfyorg/account-ui/billing'
import type {
  AccountCredential,
  SessionSnapshot
} from '@comfyorg/account-core/session'

import { createBillingWebClient } from '@/session/billingWebClient'
import { createResubscribeTelemetry } from '@/telemetry/resubscribeTelemetry'
import { createSubscriptionCheckoutTelemetry } from '@/telemetry/subscriptionCheckoutTelemetry'

const h = vi.hoisted(() => ({
  boundWorkspaceId: undefined as string | undefined
}))

vi.mock(import('@/entry/workspaceBinding'), () => ({
  boundWorkspaceId: () => h.boundWorkspaceId
}))

vi.mock(import('@/config/stripeKey'), () => ({
  billingWebStripeKey: () => undefined
}))

vi.mock(import('@datadog/browser-rum'))

const CREDENTIAL: AccountCredential = {
  token: 'jwt-1',
  permissions: ['workspace:read'],
  expiresAt: Date.now() + 3_600_000,
  uid: 'uid-1',
  workspace: { id: 'ws-1', name: 'Personal', type: 'personal' },
  role: 'owner'
}

const SIGNED_IN: SessionSnapshot = {
  phase: 'authenticated',
  user: { uid: 'uid-1', getIdToken: async () => 'id-token' },
  session: CREDENTIAL
}

function signedInSession() {
  const listeners = new Set<(snapshot: SessionSnapshot) => void>()
  const session: BillingSession = {
    getSnapshot: () => SIGNED_IN,
    subscribe: (listener) => {
      listeners.add(listener)
      return () => listeners.delete(listener)
    },
    ensureFresh: vi.fn(),
    remint: vi.fn()
  }
  return { session, listeners }
}

/** Each member paired with the entry point that proves it was really built. */
const MEMBERS = [
  ['lifecycle', (client: BillingClient) => client.lifecycle.begin],
  ['capabilities', (client: BillingClient) => client.capabilities.read],
  ['credits', (client: BillingClient) => client.credits.read],
  ['status', (client: BillingClient) => client.status.read],
  ['plans', (client: BillingClient) => client.plans.read],
  ['paymentMethods', (client: BillingClient) => client.paymentMethods.read],
  ['topup', (client: BillingClient) => client.topup.createTopupCheckout],
  ['commands', (client: BillingClient) => client.commands.subscribe]
] as const

describe('workspace targeting', () => {
  beforeEach(() => {
    h.boundWorkspaceId = undefined
  })

  it('mints for the session workspace once no entry has bound the tab', async () => {
    const { session } = signedInSession()
    const client = createBillingWebClient(session)

    await client.status.read()

    expect(session.ensureFresh).toHaveBeenCalledWith(
      undefined,
      expect.objectContaining({ workspaceId: 'ws-1' })
    )
  })

  it('sends team invites to the entry-bound workspace', async () => {
    h.boundWorkspaceId = 'ws-team'
    const { session } = signedInSession()
    const client = createBillingWebClient(session)

    await client.invites.listPendingInvites()

    expect(session.ensureFresh).toHaveBeenCalledWith(
      undefined,
      expect.objectContaining({ workspaceId: 'ws-team' })
    )
  })

  it('mints for the entry-bound workspace over the session one', async () => {
    h.boundWorkspaceId = 'ws-team'
    const { session } = signedInSession()
    const client = createBillingWebClient(session)

    await client.status.read()

    expect(session.ensureFresh).toHaveBeenCalledWith(
      undefined,
      expect.objectContaining({ workspaceId: 'ws-team' })
    )
  })
})

describe('createBillingWebClient', () => {
  it.for(MEMBERS)('wires %s', ([, entry]) => {
    const { session } = signedInSession()

    expect(entry(createBillingWebClient(session))).toBeTypeOf('function')
  })

  it('releases every scope subscription when the client is disposed', () => {
    const { session, listeners } = signedInSession()
    const client = createBillingWebClient(session)
    expect(listeners.size).toBeGreaterThan(0)

    disposeBillingClient(client)

    expect(
      listeners.size,
      'a retained reader goes on serving the previous scope'
    ).toBe(0)
  })
})

const STATUS_BODY = {
  billing_rail: 'stripe',
  has_funds: true,
  is_active: true,
  max_seats: 1,
  occupied_seats: 1,
  scheduled_change: null,
  team_credit_stop: null
}

/** The network edge: the billing routes the lifecycle reads, answered by route. */
function stubBillingRoutes(operation: Record<string, unknown>) {
  const answers: Record<string, unknown> = {
    '/api/billing/status': STATUS_BODY,
    '/api/billing/subscribe': { billing_op_id: 'op_1', status: 'subscribed' },
    '/api/billing/subscription/resubscribe': {
      billing_op_id: 'op_1',
      status: 'active'
    },
    '/api/billing/ops/op_1': {
      id: 'op_1',
      started_at: '2026-09-14T00:00:00.000Z',
      ...operation
    }
  }
  vi.mocked(fetch).mockImplementation(async (input: RequestInfo | URL) => {
    const url = String(input)

    const body = answers[new URL(url).pathname]
    return new Response(JSON.stringify(body ?? {}), {
      status: body === undefined ? 404 : 200,
      headers: { 'Content-Type': 'application/json' }
    })
  })
}

function authenticatedSession(): BillingSession {
  const { session } = signedInSession()
  vi.mocked(session.ensureFresh).mockResolvedValue({
    status: 'ok',
    session: CREDENTIAL
  })
  return session
}

const issueOperation = async () =>
  ({ status: 'ok', value: { operationId: 'op_1' } }) as const

describe('SDK operation telemetry', () => {
  beforeEach(() => {
    vi.mocked(datadogRum.getInitConfiguration).mockReturnValue({
      clientToken: 'pub',
      applicationId: 'app'
    })
  })

  it.for<{
    name: string
    serverStatus: Record<string, unknown>
    terminal: Record<string, unknown>
  }>([
    {
      name: 'a success',
      serverStatus: { status: 'succeeded' },
      terminal: { stage: 'succeeded', outcome: 'success' }
    },
    {
      name: 'a decline, with the bank reason',
      serverStatus: { status: 'failed', decline_reason: 'card_declined' },
      terminal: {
        stage: 'failed',
        outcome: 'failure',
        failure_category: 'provider_decline',
        decline_reason: 'card_declined'
      }
    },
    {
      name: 'an operation the server parks for reconciliation',
      serverStatus: { status: 'reconciliation_needed' },
      terminal: {
        stage: 'failed',
        outcome: 'failure',
        failure_category: 'reconciliation_needed'
      }
    }
  ])(
    'reports an issued operation from its start to $name, as the SDK on billing web',
    async ({ serverStatus, terminal }) => {
      stubBillingRoutes(serverStatus)
      const client = createBillingWebClient(authenticatedSession())

      await client.lifecycle.begin('subscription', issueOperation)
      await client.lifecycle.settled('op_1')

      const common = {
        operation: 'operation',
        operation_type: 'subscription',
        billing_op_id: 'op_1',
        presentation: 'hosted',
        resumed: false,
        billing_client: 'sdk',
        billing_surface: 'billing_web'
      }
      const sent = vi
        .mocked(datadogRum.addAction)
        .mock.calls.map(([name, context]) => ({ name, context }))
      expect(sent).toEqual([
        {
          name: 'billing.operation.started',
          context: { ...common, stage: 'started', outcome: 'pending' }
        },
        {
          name: `billing.operation.${terminal.stage}`,
          context: { ...common, ...terminal, duration_ms: expect.any(Number) }
        }
      ])
    }
  )

  it('reports a retryable decline inside an issued operation, as the SDK on billing web', async () => {
    stubBillingRoutes({
      status: 'pending',
      authentication_state: 'failed_retryable',
      decline_reason: 'card_declined'
    })
    const client = createBillingWebClient(authenticatedSession())
    onTestFinished(() => disposeBillingClient(client))

    await client.lifecycle.begin('subscription', issueOperation)

    await vi.waitFor(() =>
      expect(datadogRum.addAction).toHaveBeenCalledWith(
        'billing.checkout.challenge_failed',
        {
          operation: 'checkout',
          stage: 'challenge_failed',
          outcome: 'pending',
          operation_type: 'subscription',
          billing_op_id: 'op_1',
          presentation: 'hosted',
          resumed: false,
          decline_reason: 'card_declined',
          billing_client: 'sdk',
          billing_surface: 'billing_web'
        }
      )
    )
  })

  it.for<{
    name: string
    run: (client: BillingClient) => Promise<unknown>
    sequence: string[]
  }>([
    {
      name: 'a checkout',
      run: (client) =>
        createSubscriptionCheckoutTelemetry({ ui: 'embedded' }).run(
          { cycle: 'monthly', checkoutType: 'new' },
          () => client.commands.subscribe({ plan_slug: 'creator_monthly' })
        ),
      sequence: [
        'billing.subscription_checkout.intent',
        'billing.subscription_checkout.started',
        'billing.operation.started',
        'billing.operation.succeeded',
        'billing.subscription_checkout.succeeded'
      ]
    },
    {
      name: 'a resubscribe',
      run: (client) =>
        createResubscribeTelemetry().run(undefined, () =>
          client.commands.resubscribe()
        ),
      sequence: [
        'billing.resubscribe.started',
        'billing.operation.started',
        'billing.operation.succeeded',
        'billing.resubscribe.succeeded'
      ]
    }
  ])(
    'reports $name once on each stream, over the real SDK',
    async ({ run, sequence }) => {
      stubBillingRoutes({ status: 'succeeded' })
      const client = createBillingWebClient(authenticatedSession())

      await run(client)

      expect(
        vi.mocked(datadogRum.addAction).mock.calls.map(([name]) => name)
      ).toEqual(sequence)
    }
  )
})
