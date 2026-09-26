import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import type { MockInstance } from 'vitest'
import { shallowRef } from 'vue'

import type { User } from 'firebase/auth'

import type { AccountCredential } from '@comfyorg/account-core/session'
import { COMFY_CLIENT } from '@comfyorg/account-core/requestAuth'
import type { WebSession } from '@comfyorg/account-core/webSession'

import { createBalanceReader } from './workshop-balance'
import { WORKSHOP_CLOUD_BASE_URL } from './workshop-env'
import {
  SESSION_BALANCE_URL,
  readSessionBalance
} from './workshop-session-balance'

const BALANCE_URL = `${WORKSHOP_CLOUD_BASE_URL}/api/billing/balance`

const SESSION: WebSession = {
  user: { id: 'uid-1', email: 'ada@example.com', emailVerified: true },
  csrfToken: 'csrf-1',
  expiresAt: Date.now() + 60_000,
  absoluteExpiresAt: Date.now() + 60_000
}

const CREDENTIAL: AccountCredential = {
  token: 'jwt-1',
  uid: 'uid-1',
  expiresAt: Date.now() + 60_000,
  workspace: { id: 'ws-1', name: 'Personal', type: 'personal' },
  role: 'owner',
  permissions: []
}

const firebaseSession = {
  getSnapshot: () =>
    ({
      phase: 'authenticated',
      user: { uid: 'uid-1' } as Partial<User> as User,
      session: CREDENTIAL,
      settled: true
    }) as const,
  remint: vi.fn(async () => undefined)
}

function answer(status: number, body: unknown): Response {
  return new Response(JSON.stringify(body), { status })
}

const BALANCE_BODY = {
  amount_micros: 211,
  currency: 'usd',
  effective_balance_micros: 211
}

interface Sent {
  readonly url: string
  readonly headers: Record<string, string>
  readonly credentials?: RequestCredentials
}

function recordingFetch(response: () => Response) {
  const sent: Sent[] = []
  const fetchImpl = vi.fn<typeof fetch>(async (input, init = {}) => {
    sent.push({
      url: String(input),
      headers: Object.fromEntries(
        [...new Headers(init.headers)].map(([name, value]) => [
          name.toLowerCase(),
          value
        ])
      ),
      ...(init.credentials ? { credentials: init.credentials } : {})
    })
    return response()
  })
  return { sent, fetchImpl }
}

describe('balance read requests', () => {
  it.for([
    {
      source: 'firebase (flag off): main’s Bearer read, no cookie',
      read: async (fetchImpl: typeof fetch) =>
        createBalanceReader(firebaseSession, BALANCE_URL, fetchImpl).refresh(),
      sent: [{ url: BALANCE_URL, headers: { authorization: 'Bearer jwt-1' } }]
    },
    {
      source: 'session: cookie and client header, personal workspace, no token',
      read: async (fetchImpl: typeof fetch) =>
        readSessionBalance(SESSION, fetchImpl),
      sent: [
        {
          url: SESSION_BALANCE_URL,
          headers: { 'x-comfy-client': COMFY_CLIENT },
          credentials: 'include'
        }
      ]
    }
  ])('$source', async ({ read, sent: expected }) => {
    const { sent, fetchImpl } = recordingFetch(() => answer(200, BALANCE_BODY))

    await read(fetchImpl)

    expect(sent).toEqual(expected)
  })
})

describe('readSessionBalance', () => {
  it.for([
    {
      case: '200',
      response: () => answer(200, BALANCE_BODY),
      state: { status: 'ok', credits: 445 }
    },
    {
      case: '401 session gone',
      response: () => answer(401, { code: 'session_revoked' }),
      state: { status: 'session_ended' }
    },
    ...[
      [403, 'origin_not_allowed'],
      [403, 'workspace_access_denied'],
      [403, 'csrf_invalid'],
      [403, 'cross_site_request'],
      [400, 'workspace_id_invalid'],
      [500, 'internal']
    ].map(([status, code]) => ({
      case: `${status} ${code}`,
      response: () => answer(Number(status), { code, message: code }),
      state: { status: 'unavailable' }
    })),
    {
      case: 'unreadable body',
      response: () => answer(200, { currency: 'usd' }),
      state: { status: 'unavailable' }
    },
    {
      case: 'network failure',
      response: () => {
        throw new TypeError('Failed to fetch')
      },
      state: { status: 'unavailable' }
    }
  ])('$case reads as $state.status', async ({ response, state }) => {
    const { fetchImpl } = recordingFetch(response)

    expect(await readSessionBalance(SESSION, fetchImpl)).toEqual(state)
  })
})

describe('useWorkshopSessionBalance', () => {
  let listen: MockInstance<typeof window.addEventListener>

  beforeEach(() => {
    vi.resetModules()
    listen = vi.spyOn(window, 'addEventListener')
  })

  afterEach(() => {
    for (const [type, listener] of listen.mock.calls)
      window.removeEventListener(type, listener)
  })

  async function mountWith(response: () => Response) {
    const { sent, fetchImpl } = recordingFetch(response)
    vi.stubGlobal('fetch', fetchImpl)
    const { useWorkshopSessionBalance } =
      await import('./workshop-session-balance')
    const balance = useWorkshopSessionBalance(shallowRef(SESSION))
    useWorkshopSessionBalance(shallowRef(SESSION))
    await vi.waitFor(() => expect(balance.value.status).not.toBe('unknown'))
    return { sent, balance }
  }

  it('reads once for every mount and again on refocus', async () => {
    const { sent, balance } = await mountWith(() => answer(200, BALANCE_BODY))
    expect(sent).toHaveLength(1)
    expect(balance.value).toEqual({ status: 'ok', credits: 445 })

    window.dispatchEvent(new Event('focus'))
    await vi.waitFor(() => expect(sent).toHaveLength(2))
  })

  it('stops reading once the session is gone', async () => {
    const { sent, balance } = await mountWith(() =>
      answer(401, { code: 'session_expired' })
    )
    expect(balance.value).toEqual({ status: 'session_ended' })

    window.dispatchEvent(new Event('focus'))
    window.dispatchEvent(new Event('focus'))
    await new Promise((resolve) => setTimeout(resolve))
    expect(sent).toHaveLength(1)
  })

  it('reads again on refocus after a refusal', async () => {
    const { sent, balance } = await mountWith(() =>
      answer(403, { code: 'workspace_access_denied' })
    )
    expect(balance.value).toEqual({ status: 'unavailable' })

    window.dispatchEvent(new Event('focus'))
    await vi.waitFor(() => expect(sent).toHaveLength(2))
  })
})
