import { describe, expect, it } from 'vitest'

import { createWebSessionIdentity } from './core/webSessionIdentity.js'
import type { WebSessionTelemetryEvent } from './telemetry.js'
import { webSessionTelemetryHooks } from './telemetry.js'
import type { FakeWebSessionState } from './testing.js'
import { createFakeWebSessionEndpoint, fakeWebSessionUser } from './testing.js'

const ORIGIN = 'https://www.comfy.example'
const settle = () => new Promise((resolve) => setTimeout(resolve, 0))

describe('webSessionTelemetryHooks', () => {
  it.for<{ state: FakeWebSessionState; outcome: string }>([
    {
      state: { kind: 'live', user: fakeWebSessionUser({ id: 'user-1' }) },
      outcome: 'signed_in'
    },
    { state: { kind: 'dead', code: 'session_revoked' }, outcome: 'revoked' }
  ])(
    'reports a $outcome boot as session_bootstrap with outcome and origin only',
    async ({ state, outcome }) => {
      const tracked: WebSessionTelemetryEvent[] = []
      const endpoint = createFakeWebSessionEndpoint({ state })
      const identity = createWebSessionIdentity({
        session: {
          apiBaseUrl: 'https://cloud.example/api',
          fetchImpl: endpoint.fetch
        },
        principal: {
          kind: 'account',
          rememberedLogin: {
            currentUserId: async () => null,
            getProof: async () => null,
            signOutLocally: async () => undefined
          }
        },
        origin: ORIGIN,
        ...webSessionTelemetryHooks((event) => tracked.push(event))
      })

      identity.boot()
      await settle()
      identity.dispose()

      expect(tracked).toEqual([
        { name: 'session_bootstrap', properties: { outcome, origin: ORIGIN } }
      ])
    }
  )

  it('reports a remote sign-out as session_signed_out_remotely with the origin', () => {
    const tracked: WebSessionTelemetryEvent[] = []

    webSessionTelemetryHooks((event) =>
      tracked.push(event)
    ).onSignedOutRemotely?.({ origin: ORIGIN })

    expect(tracked).toEqual([
      { name: 'session_signed_out_remotely', properties: { origin: ORIGIN } }
    ])
  })
})
