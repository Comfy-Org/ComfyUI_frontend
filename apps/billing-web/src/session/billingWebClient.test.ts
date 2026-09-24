import type { BillingSession } from '@comfyorg/account-core/billing'
import type { BillingClient } from '@comfyorg/account-ui/billing'
import { disposeBillingClient } from '@comfyorg/account-ui/billing'
import type { SessionSnapshot } from '@comfyorg/account-core/session'

import { createBillingWebClient } from '@/session/billingWebClient'

const h = vi.hoisted(() => ({
  boundWorkspaceId: undefined as string | undefined
}))

vi.mock(import('@/entry/workspaceBinding'), () => ({
  boundWorkspaceId: () => h.boundWorkspaceId
}))

const SIGNED_IN: SessionSnapshot = {
  phase: 'authenticated',
  user: { uid: 'uid-1', getIdToken: async () => 'id-token' },
  session: {
    token: 'jwt-1',
    permissions: ['workspace:read'],
    expiresAt: Date.now() + 3_600_000,
    uid: 'uid-1',
    workspace: { id: 'ws-1', name: 'Personal', type: 'personal' },
    role: 'owner'
  }
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
