import { datadogRum } from '@datadog/browser-rum'

import type { BillingSession } from '@comfyorg/account-core/billing'
import type { BillingClient } from '@comfyorg/account-ui/billing'
import { disposeBillingClient } from '@comfyorg/account-ui/billing'
import type {
  AccountCredential,
  SessionSnapshot
} from '@comfyorg/account-core/session'

import { createBillingWebClient } from '@/session/billingWebClient'

const h = vi.hoisted(() => ({
  boundWorkspaceId: undefined as string | undefined
}))

vi.mock(import('@/entry/workspaceBinding'), () => ({
  boundWorkspaceId: () => h.boundWorkspaceId
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
    '/api/billing/ops/op_1': {
      id: 'op_1',
      started_at: '2026-09-14T00:00:00.000Z',
      ...operation
    }
  }
  vi.stubGlobal(
    'fetch',
    vi.fn(async (url: string) => {
      const body = answers[new URL(url).pathname]
      return new Response(JSON.stringify(body ?? {}), {
        status: body === undefined ? 404 : 200,
        headers: { 'Content-Type': 'application/json' }
      })
    })
  )
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

  it('reports an issued operation from its start to its success, as the SDK on billing web', async () => {
    stubBillingRoutes({ status: 'succeeded' })
    const client = createBillingWebClient(authenticatedSession())

    await client.lifecycle.begin('subscription', issueOperation)
    await client.lifecycle.settled('op_1')

    const sent = vi
      .mocked(datadogRum.addAction)
      .mock.calls.map(([name, context]) => ({ name, context }))
    expect(sent).toEqual([
      {
        name: 'billing.operation.started',
        context: {
          operation: 'operation',
          stage: 'started',
          outcome: 'pending',
          operation_type: 'subscription',
          billing_op_id: 'op_1',
          presentation: 'embedded',
          resumed: false,
          billing_client: 'sdk',
          billing_surface: 'billing_web'
        }
      },
      {
        name: 'billing.operation.succeeded',
        context: {
          operation: 'operation',
          stage: 'succeeded',
          outcome: 'success',
          operation_type: 'subscription',
          billing_op_id: 'op_1',
          presentation: 'embedded',
          resumed: false,
          duration_ms: expect.any(Number),
          billing_client: 'sdk',
          billing_surface: 'billing_web'
        }
      }
    ])
  })
})
