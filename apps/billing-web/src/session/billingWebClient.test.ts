import { datadogRum } from '@datadog/browser-rum'

import type {
  BillingCapabilitiesResponse,
  BillingStatusResponse
} from '@comfyorg/ingest-types'
import type { BillingSession } from '@comfyorg/account-core/billing'
import type { BillingClient } from '@comfyorg/account-ui/billing'
import { disposeBillingClient } from '@comfyorg/account-ui/billing'
import type {
  AccountCredential,
  SessionSnapshot
} from '@comfyorg/account-core/session'
import { fetchRequests, respondToFetch } from '@comfyorg/test-utils/fetch'

import { createHandoffBillingSession } from '@/handoff/handoffBillingSession'
import type { HandoffState } from '@/handoff/handoffTab'
import {
  endHandoffSession,
  handoffTab,
  sessionTabStorage,
  writeHandoffState
} from '@/handoff/handoffTab'
import type { BillingWebClient } from '@/session/billingWebClient'
import {
  createBillingWebClient,
  createHandoffBillingClient
} from '@/session/billingWebClient'
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
  ended_at: null,
  has_funds: true,
  is_active: true,
  max_seats: 1,
  occupied_seats: 1,
  scheduled_change: null,
  next_charge: null,
  team_credit_stop: null
} satisfies BillingStatusResponse

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

describe('billing status wire compatibility', () => {
  it('reads older status without an end date through the authenticated billing web client', async () => {
    const body = { ...STATUS_BODY, ended_at: undefined }
    vi.mocked(fetch).mockResolvedValue(
      new Response(JSON.stringify(body), { status: 200 })
    )
    const client = createBillingWebClient(authenticatedSession())

    const result = await client.status.read()

    expect(result).toMatchObject({
      status: 'ok',
      value: { status: { has_funds: true } }
    })
    expect(client.status.getSnapshot()?.status).not.toHaveProperty('ended_at')
    disposeBillingClient(client)
  })

  it('rejects a malformed supplied end date through the authenticated billing web client', async () => {
    vi.mocked(fetch).mockResolvedValue(
      new Response(JSON.stringify({ ...STATUS_BODY, ended_at: 'not-a-date' }), {
        status: 200
      })
    )
    const client = createBillingWebClient(authenticatedSession())

    const result = await client.status.read()

    expect(result).toEqual({
      status: 'error',
      code: 'MALFORMED_RESPONSE',
      httpStatus: 200
    })
    expect(client.status.getSnapshot()).toBeUndefined()
    disposeBillingClient(client)
  })
})

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

describe('createHandoffBillingClient', () => {
  function handoffSession(): BillingSession {
    return {
      ...signedInSession().session,
      ensureFresh: vi.fn(async () => ({
        status: 'ok' as const,
        session: CREDENTIAL
      })),
      remint: vi.fn(async () => ({
        status: 'error' as const,
        code: 'NOT_AUTHENTICATED' as const
      }))
    }
  }

  it.for([
    { name: 'a GET', call: (c: BillingClient) => c.credits.read() },
    {
      name: 'a POST that is never retried',
      call: (c: BillingClient) =>
        c.commands.openPaymentPortal({ returnUrl: 'https://example.test' })
    }
  ])(
    'ends the handoff when Cloud refuses the scoped session on $name',
    async ({ call }) => {
      vi.mocked(fetch).mockResolvedValue(
        new Response(JSON.stringify({ code: 'INVALID_CREDENTIAL' }), {
          status: 401
        })
      )
      const onSessionRefused = vi.fn()
      const client = createHandoffBillingClient(
        handoffSession(),
        onSessionRefused
      )

      await call(client)

      expect(onSessionRefused).toHaveBeenCalled()
      disposeBillingClient(client)
    }
  )

  it('keeps the handoff on a 401 from a route that does not take scoped sessions', async () => {
    vi.mocked(fetch).mockResolvedValue(
      new Response(JSON.stringify({ code: 'UNAUTHORIZED' }), { status: 401 })
    )
    const onSessionRefused = vi.fn()
    const client = createHandoffBillingClient(
      handoffSession(),
      onSessionRefused
    )

    await client.credits.read()

    expect(onSessionRefused).not.toHaveBeenCalled()
    disposeBillingClient(client)
  })

  const LIVE_HANDOFF: HandoffState = {
    kind: 'session',
    session: {
      token: 'comfy-scoped-session-1',
      expiresAt: Date.parse('2099-01-01T00:00:00Z'),
      userId: 'uid-1',
      email: 'a@example.com',
      workspace: { id: 'ws-1', name: 'Personal', type: 'personal' },
      role: 'owner'
    }
  }

  const CAN_TOP_UP = {
    auto_top_up_enabled: false,
    billing_web_checkout_ui: 'full_page',
    capabilities: {
      can_cancel: true,
      can_change_seats: false,
      can_delete_workspace: false,
      can_downgrade_to_personal: false,
      can_edit_workspace: false,
      can_invite_members: false,
      can_leave_workspace: false,
      can_manage_auto_top_up: false,
      can_manage_billing: true,
      can_manage_members: false,
      can_manage_partner_node_access: false,
      can_manage_subscription: true,
      can_open_plans: true,
      can_reactivate: false,
      can_revert_scheduled_change: false,
      can_run_workflows: true,
      can_subscribe_self_serve: true,
      can_top_up: true,
      can_upgrade: true,
      can_view_auto_top_up: false,
      can_view_auto_top_up_member_notice: false,
      can_view_pending_invites: false,
      can_view_team_usage: false
    },
    expires_at: '2099-01-01T00:00:00Z',
    resolved_for: { user_id: 'uid-1', workspace_id: 'ws-1' },
    revision: 1,
    rollout_defaults_applied: {
      can_downgrade_to_personal: false,
      can_subscribe_self_serve: false,
      can_top_up: false
    }
  } satisfies BillingCapabilitiesResponse

  function openHandoffTab(): BillingWebClient {
    globalThis.sessionStorage.clear()
    handoffTab.value = LIVE_HANDOFF
    writeHandoffState(sessionTabStorage, LIVE_HANDOFF)
    onTestFinished(() => {
      handoffTab.value = undefined
      globalThis.sessionStorage.clear()
    })
    stubBillingRoutes({ status: 'succeeded' })
    respondToFetch(/\/api\/billing\/capabilities$/, () =>
      Response.json(CAN_TOP_UP)
    )
    const client = createHandoffBillingClient(
      createHandoffBillingSession(sessionTabStorage),
      () => endHandoffSession(sessionTabStorage)
    )
    onTestFinished(() => disposeBillingClient(client))
    return client
  }

  function howTheSessionEnds(): HandoffState | undefined {
    endHandoffSession(sessionTabStorage)
    return handoffTab.value
  }

  const LINK: HandoffState = { kind: 'ended', ending: 'link_unavailable' }
  const UNCONFIRMED: HandoffState = { kind: 'ended', ending: 'unconfirmed' }
  const completed = (reference: string): HandoffState => ({
    kind: 'ended',
    ending: 'completed',
    workspace: 'Personal',
    reference
  })

  const SERVER_ERROR = () => new Response(null, { status: 500 })

  it.for<{
    name: string
    route: RegExp
    send: (client: BillingWebClient) => Promise<unknown>
    ended: HandoffState
  }>([
    {
      name: 'a subscribe, which starts a payment',
      route: /\/api\/billing\/subscribe$/,
      send: (client) =>
        client.commands.subscribe({ plan_slug: 'creator_monthly' }),
      ended: UNCONFIRMED
    },
    {
      name: 'a top-up on the card on file, which starts a payment',
      route: /\/api\/billing\/topup$/,
      send: (client) => client.topup.createTopupCheckout({ amountCents: 2500 }),
      ended: UNCONFIRMED
    },
    {
      name: 'a pay-once top-up, which starts a payment',
      route: /\/api\/billing\/topup\/interactive$/,
      send: (client) =>
        client.topup.createInteractiveTopup({
          amountCents: 2500,
          payment: { savedPaymentMethodId: 'pm_1' },
          idempotencyKey: 'key-1'
        }),
      ended: UNCONFIRMED
    },
    {
      name: 'a hosted top-up checkout, which starts a payment',
      route: /\/api\/billing\/topup\/checkout$/,
      send: (client) =>
        client.topup.createHostedTopupCheckout({
          amountCents: 2500,
          returnUrl: 'https://testbilling.comfy.org/return/topup'
        }),
      ended: UNCONFIRMED
    },
    {
      name: 'a keep-subscription request, which charges nothing',
      route: /\/api\/billing\/subscription\/resubscribe$/,
      send: (client) => client.commands.resubscribe(),
      ended: LINK
    },
    {
      name: 'a subscription cancellation, which charges nothing',
      route: /\/api\/billing\/subscription\/cancel$/,
      send: (client) => client.commands.cancelSubscription(),
      ended: LINK
    },
    {
      name: 'a payment portal request, which charges nothing',
      route: /\/api\/billing\/payment-portal$/,
      send: (client) =>
        client.commands.openPaymentPortal({
          returnUrl: 'https://example.test'
        }),
      ended: LINK
    },
    {
      name: 'an operation cancellation, which charges nothing',
      route: /\/api\/billing\/ops\/op_9\/cancel$/,
      send: (client) => client.commands.cancelOperation('op_9'),
      ended: LINK
    },
    {
      name: 'a workspace invite, which charges nothing',
      route: /\/api\/workspace\/invites$/,
      send: (client) => client.invites.createInvite('b@example.com'),
      ended: LINK
    },
    {
      name: 'a subscription preview, which charges nothing',
      route: /\/api\/billing\/preview-subscribe$/,
      send: (client) =>
        client.commands.previewSubscribe({ planSlug: 'creator_monthly' }),
      ended: LINK
    },
    {
      name: 'a top-up quote, which charges nothing',
      route: /\/api\/billing\/topup\/quote$/,
      send: (client) => client.topup.quoteTopup({ amountCents: 2500 }),
      ended: LINK
    }
  ])(
    'ends as $ended.ending after a server error on $name',
    async ({ route, send, ended }) => {
      const client = openHandoffTab()
      respondToFetch({ method: 'POST', url: route }, SERVER_ERROR)

      await send(client)

      expect(fetchRequests({ method: 'POST', url: route })).toHaveLength(1)
      expect(howTheSessionEnds()).toEqual(ended)
    }
  )

  const TOPUP = /\/api\/billing\/topup$/
  const topUp = (client: BillingWebClient) =>
    client.topup.createTopupCheckout({ amountCents: 2500 })
  const topUpStarted = (operationId: string) => () =>
    Response.json({
      billing_op_id: operationId,
      topup_id: operationId,
      status: 'pending',
      amount_cents: 2500
    })
  const REFUSED = () =>
    Response.json({ code: 'INVALID_AMOUNT', message: 'no' }, { status: 400 })

  function operationEnds(operationId: string, outcome: object) {
    respondToFetch(new RegExp(`/api/billing/ops/${operationId}$`), () =>
      Response.json({
        id: operationId,
        started_at: '2026-09-14T00:00:00.000Z',
        ...outcome
      })
    )
  }

  const DECLINED = { status: 'failed', decline_reason: 'card_declined' }

  it.for<{
    name: string
    run: (client: BillingWebClient) => Promise<unknown>
    ended: HandoffState
  }>([
    {
      name: 'a session that only read',
      run: (client) => client.credits.read(),
      ended: LINK
    },
    {
      name: 'a top-up the card declined',
      run: (client) => {
        respondToFetch({ method: 'POST', url: TOPUP }, topUpStarted('op_1'))
        operationEnds('op_1', DECLINED)
        return topUp(client)
      },
      ended: LINK
    },
    {
      name: 'a subscription the card declined',
      run: (client) => {
        operationEnds('op_1', DECLINED)
        return client.commands.subscribe({ plan_slug: 'creator_monthly' })
      },
      ended: LINK
    },
    {
      name: 'a top-up Cloud refused',
      run: (client) => {
        respondToFetch({ method: 'POST', url: TOPUP }, REFUSED)
        return topUp(client)
      },
      ended: LINK
    },
    {
      name: 'a top-up on which Cloud refused the session itself',
      run: (client) => {
        respondToFetch({ method: 'POST', url: TOPUP }, () =>
          Response.json({ code: 'INVALID_CREDENTIAL' }, { status: 401 })
        )
        return topUp(client)
      },
      ended: LINK
    },
    {
      name: 'a top-up the network dropped',
      run: (client) => {
        respondToFetch({ method: 'POST', url: TOPUP }, () =>
          Promise.reject(new TypeError('offline'))
        )
        return topUp(client)
      },
      ended: UNCONFIRMED
    },
    {
      name: 'a top-up accepted in a shape the tab cannot follow',
      run: (client) => {
        respondToFetch({ method: 'POST', url: TOPUP }, () => Response.json({}))
        return topUp(client)
      },
      ended: UNCONFIRMED
    },
    {
      name: 'a session that ended while the top-up request was still out',
      run: (client) => {
        respondToFetch({ method: 'POST', url: TOPUP }, () => {
          endHandoffSession(sessionTabStorage)
          return topUpStarted('op_1')()
        })
        return topUp(client)
      },
      ended: UNCONFIRMED
    },
    {
      name: 'a hosted top-up checkout the customer was sent to',
      run: (client) => {
        respondToFetch(
          { method: 'POST', url: /\/api\/billing\/topup\/checkout$/ },
          () =>
            Response.json({
              checkout_url: 'https://checkout.stripe.com/c/pay/cs_1',
              session_id: 'cs_1'
            })
        )
        return client.topup.createHostedTopupCheckout({
          amountCents: 2500,
          returnUrl: 'https://testbilling.comfy.org/return/topup'
        })
      },
      ended: UNCONFIRMED
    },
    {
      name: 'a top-up that went through',
      run: (client) => {
        respondToFetch({ method: 'POST', url: TOPUP }, topUpStarted('op_1'))
        return topUp(client)
      },
      ended: completed('op_1')
    },
    {
      name: 'a top-up that went through before a later one was declined',
      run: async (client) => {
        respondToFetch({ method: 'POST', url: TOPUP }, topUpStarted('op_2'))
        respondToFetch({ method: 'POST', url: TOPUP }, topUpStarted('op_1'), {
          times: 1
        })
        operationEnds('op_2', DECLINED)
        await topUp(client)
        return topUp(client)
      },
      ended: completed('op_1')
    },
    {
      name: 'a top-up that went through before a later one got a server error',
      run: async (client) => {
        respondToFetch({ method: 'POST', url: TOPUP }, SERVER_ERROR)
        respondToFetch({ method: 'POST', url: TOPUP }, topUpStarted('op_1'), {
          times: 1
        })
        await topUp(client)
        return topUp(client)
      },
      ended: UNCONFIRMED
    },
    {
      name: 'a server error on a top-up that Cloud then refused on the retry',
      run: async (client) => {
        respondToFetch({ method: 'POST', url: TOPUP }, REFUSED)
        respondToFetch({ method: 'POST', url: TOPUP }, SERVER_ERROR, {
          times: 1
        })
        await topUp(client)
        return topUp(client)
      },
      ended: UNCONFIRMED
    },
    {
      name: 'a server error on a top-up whose retry was declined',
      run: async (client) => {
        respondToFetch({ method: 'POST', url: TOPUP }, topUpStarted('op_1'))
        respondToFetch({ method: 'POST', url: TOPUP }, SERVER_ERROR, {
          times: 1
        })
        operationEnds('op_1', DECLINED)
        await topUp(client)
        return topUp(client)
      },
      ended: UNCONFIRMED
    },
    {
      name: 'a server error on a top-up whose retry went through',
      run: async (client) => {
        respondToFetch({ method: 'POST', url: TOPUP }, topUpStarted('op_1'))
        respondToFetch({ method: 'POST', url: TOPUP }, SERVER_ERROR, {
          times: 1
        })
        await topUp(client)
        return topUp(client)
      },
      ended: completed('op_1')
    },
    {
      name: 'a subscription the customer cancelled',
      run: (client) => {
        respondToFetch(
          { method: 'POST', url: /\/api\/billing\/subscription\/cancel$/ },
          () =>
            Response.json({
              billing_op_id: 'op_1',
              cancel_at: '2026-10-24T12:00:00Z'
            })
        )
        return client.commands.cancelSubscription()
      },
      ended: LINK
    },
    {
      name: 'a subscription the customer kept',
      run: (client) => client.commands.resubscribe(),
      ended: LINK
    },
    {
      name: 'a payment portal the customer opened',
      run: (client) => {
        respondToFetch(
          { method: 'POST', url: /\/api\/billing\/payment-portal$/ },
          () => Response.json({ url: 'https://billing.stripe.com/p/session/1' })
        )
        return client.commands.openPaymentPortal({
          returnUrl: 'https://example.test'
        })
      },
      ended: LINK
    }
  ])('ends as $ended.ending after $name', async ({ run, ended }) => {
    const client = openHandoffTab()

    await run(client)

    expect(howTheSessionEnds()).toEqual(ended)
  })
})
