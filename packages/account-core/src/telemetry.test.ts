import { describe, expect, it } from 'vitest'

import { createWebSessionIdentity } from './core/webSessionIdentity.js'
import type { SsoErrorCode } from './sso.js'
import type {
  SsoSignInFailureReason,
  WebSessionTelemetryEvent
} from './telemetry.js'
import {
  createSsoFlowStore,
  ssoFailureReason,
  webSessionTelemetryHooks
} from './telemetry.js'
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

function memoryStorage(): Storage {
  const items = new Map<string, string>()
  return {
    get length() {
      return items.size
    },
    clear: () => items.clear(),
    getItem: (key) => items.get(key) ?? null,
    key: (index) => [...items.keys()][index] ?? null,
    removeItem: (key) => {
      items.delete(key)
    },
    setItem: (key, value) => {
      items.set(key, value)
    }
  }
}

function brokenStorage(): Storage {
  const fail = () => {
    throw new DOMException('denied', 'SecurityError')
  }
  return {
    length: 0,
    clear: fail,
    getItem: fail,
    key: fail,
    removeItem: fail,
    setItem: fail
  }
}

describe('createSsoFlowStore', () => {
  it('carries an attempt across the redirect until it finishes', () => {
    const storage = memoryStorage()
    const started = createSsoFlowStore(() => storage).start('cloud_login')

    const afterRedirect = createSsoFlowStore(() => storage)

    expect(afterRedirect.current()).toEqual(started)
    expect(afterRedirect.finish()).toEqual(started)
    expect(createSsoFlowStore(() => storage).current()).toBeUndefined()
  })

  it('gives every attempt its own flow id', () => {
    const flows = createSsoFlowStore(memoryStorage)

    expect(flows.start('cloud_app').flowId).not.toBe(
      flows.start('cloud_app').flowId
    )
  })

  it('keeps the attempt for this page when storage throws', () => {
    const flows = createSsoFlowStore(brokenStorage)

    const started = flows.start('billing_web')

    expect(flows.current()).toEqual(started)
    expect(flows.finish()).toEqual(started)
    expect(flows.current()).toBeUndefined()
  })

  it('ignores a stored value it cannot read as a flow', () => {
    const storage = memoryStorage()
    storage.setItem('Comfy.Sso.TelemetryFlow', '{"flowId":"x","surface":"?"}')

    expect(createSsoFlowStore(() => storage).current()).toBeUndefined()
  })
})

describe('ssoFailureReason', () => {
  it.for<{ code: SsoErrorCode; reason: SsoSignInFailureReason }>([
    { code: 'SSO_INVALID_STATE', reason: 'state_mismatch' },
    { code: 'SSO_CONFIRM_EXPIRED', reason: 'state_mismatch' },
    { code: 'SSO_ORG_NOT_ATTACHED', reason: 'org_not_attached' },
    { code: 'SSO_ORG_MISMATCH', reason: 'org_not_attached' },
    { code: 'SSO_IDP_ERROR', reason: 'server_error' },
    { code: 'INTERNAL_ERROR', reason: 'server_error' }
  ])('reports $code as $reason', ({ code, reason }) => {
    expect(ssoFailureReason(code)).toBe(reason)
  })
})
