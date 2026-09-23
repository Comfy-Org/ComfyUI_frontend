import type { BillingSession } from '@comfyorg/account-core/billing'
import type { SessionSnapshot } from '@comfyorg/account-core/session'
import type { BillingClient } from '@comfyorg/account-ui/billing'
import { disposeBillingClient } from '@comfyorg/account-ui/billing'

import { createBillingWebClient } from '@/session/billingWebClient'

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
