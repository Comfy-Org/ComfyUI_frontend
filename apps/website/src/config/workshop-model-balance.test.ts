/**
 * Where the model page's balance comes from, per rollout state: the cookie
 * balance the header already reads when the web session knows the visitor,
 * the Firebase balance otherwise.
 */
import { render, screen } from '@testing-library/vue'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { computed, readonly, ref } from 'vue'

import { COMFY_CLIENT } from '@comfyorg/account-core/requestAuth'
import { centsToCredits } from '@comfyorg/shared-frontend-utils/creditsUtil'

import { ACCOUNT_SOURCE_CAP_MS } from './workshop-account-source'
import { WORKSHOP_CLOUD_BASE_URL } from './workshop-env'
import type { WorkshopSession } from './workshop-session-state'

const firebaseEvaluated = vi.hoisted(() => vi.fn())

vi.mock(import('../scripts/posthog'))
vi.mock(import('./workshop-session-state'))
vi.mock(import('./workshop-credits'))
vi.mock(import('./workshop-billing-sdk'))
vi.mock(import('./workshop-features'))
vi.mock(import('./workshop-firebase'), async () => {
  firebaseEvaluated()
  return import('./__mocks__/workshop-firebase')
})

const FEATURES = `${WORKSHOP_CLOUD_BASE_URL}/api/features`
const SESSION = `${WORKSHOP_CLOUD_BASE_URL}/api/auth/session`
const BALANCE = `${WORKSHOP_CLOUD_BASE_URL}/api/billing/balance`
const TOKEN = `${WORKSHOP_CLOUD_BASE_URL}/api/auth/token`

interface SentRequest {
  readonly method: string
  readonly url: string
  readonly credentials?: RequestCredentials
  readonly authorization?: string
  readonly workspace?: string
  readonly client?: string
}

const SESSION_BALANCE_READ: SentRequest = {
  method: 'GET',
  url: BALANCE,
  credentials: 'include',
  client: COMFY_CLIENT
}

const LIVE_SESSION = {
  status: 200,
  body: {
    absolute_expires_at: '2099-01-01T00:00:00Z',
    expires_at: '2099-01-01T00:00:00Z',
    csrf_token: 'csrf',
    user: {
      id: 'uid-1',
      email: 'ada@example.com',
      email_verified: true,
      name: 'Ada Lovelace'
    }
  }
}

const SESSION_FLAGS = {
  anonymous: { web_session_probe: true },
  perUser: { unified_web_session: true },
  session: LIVE_SESSION
}

const BALANCE_211 = {
  status: 200,
  body: { amount_micros: 211, currency: 'usd', effective_balance_micros: 211 }
}

function refusal(status: number, code: string) {
  return { status, body: { code, message: code } }
}

interface CloudAnswers {
  readonly anonymous: Record<string, unknown>
  readonly perUser?: Record<string, unknown>
  readonly session?: { readonly status: number; readonly body: unknown }
  readonly balance?: { readonly status: number; readonly body: unknown }
  readonly answered?: Promise<void>
}

function recordRequest(url: string, init: RequestInit = {}): SentRequest {
  const { credentials } = init
  const headers = new Headers(init.headers)
  const authorization = headers.get('Authorization')
  const workspace = headers.get('X-Comfy-Workspace-ID')
  const client = headers.get('X-Comfy-Client')
  return {
    method: init.method ?? 'GET',
    url,
    ...(credentials ? { credentials } : {}),
    ...(authorization ? { authorization } : {}),
    ...(workspace ? { workspace } : {}),
    ...(client ? { client } : {})
  }
}

function stubCloud({
  anonymous,
  perUser = {},
  session = refusal(401, 'no_session'),
  balance = BALANCE_211,
  answered
}: CloudAnswers) {
  const sent: SentRequest[] = []
  const byUrl: Record<string, CloudAnswers['session']> = {
    [SESSION]: session,
    [BALANCE]: balance
  }
  vi.stubGlobal(
    'fetch',
    vi.fn<typeof fetch>(async (input, init) => {
      const url = String(input)
      sent.push(recordRequest(url, init))
      await answered
      const answer = byUrl[url] ?? {
        status: 200,
        body: init?.credentials === 'include' ? perUser : anonymous
      }
      return new Response(JSON.stringify(answer.body), {
        status: answer.status
      })
    })
  )
  return sent
}

function credential(type: 'personal' | 'team'): WorkshopSession {
  return {
    token: 'workspace-jwt',
    expiresAt: Date.now() + 60_000,
    uid: 'uid-1',
    workspace: { id: 'workspace-1', name: 'Workspace', type },
    role: 'owner',
    permissions: []
  }
}

async function mountBalance({
  authEnabled = true
}: {
  authEnabled?: boolean
} = {}) {
  const posthog = await import('../scripts/posthog')
  vi.mocked(posthog.useWorkshopAuthFlag).mockReturnValue(
    readonly(ref(authEnabled))
  )
  vi.mocked(posthog.useWorkshopEnabled).mockReturnValue(readonly(ref(true)))
  const credits = await import('./workshop-credits')
  vi.mocked(credits.useWorkshopCredits).mockReturnValue({
    balance: computed(() => ({ status: 'ok', credits: 5 })),
    session: computed(() => undefined)
  })
  const { useWorkshopModelBalance } = await import('./workshop-model-balance')
  const session = ref<WorkshopSession>(credential('personal'))
  return { balance: useWorkshopModelBalance(session), session }
}

beforeEach(() => {
  vi.resetModules()
  firebaseEvaluated.mockClear()
})

describe('useWorkshopModelBalance', () => {
  it('flag on, live session, personal workspace: reads the cookie balance and never starts Firebase', async () => {
    const sent = stubCloud({ ...SESSION_FLAGS })
    const { balance } = await mountBalance()

    await vi.waitFor(() =>
      expect(balance.value).toEqual({
        status: 'ok',
        credits: centsToCredits(211)
      })
    )
    expect(
      sent.filter(({ url }) => url === BALANCE),
      'one read, on the cookie: no Authorization, no workspace header'
    ).toEqual([SESSION_BALANCE_READ])
    expect(sent.map(({ url }) => url)).not.toContain(TOKEN)
    expect(firebaseEvaluated).not.toHaveBeenCalled()
  })

  it('flag on, session balance 401: leaves ok and does not retry with a Bearer token', async () => {
    const sent = stubCloud({
      ...SESSION_FLAGS,
      balance: refusal(401, 'session_revoked')
    })
    const { balance } = await mountBalance()

    await vi.waitFor(() =>
      expect(balance.value).toEqual({ status: 'session_ended' })
    )
    expect(sent.filter(({ url }) => url === BALANCE)).toEqual([
      SESSION_BALANCE_READ
    ])
    expect(sent.some(({ authorization }) => authorization)).toBe(false)
  })

  it.for([
    {
      state: 'flag off (probe false)',
      answers: { anonymous: { web_session_probe: false } },
      requests: [FEATURES]
    },
    {
      state: 'flag on, session answers no_session',
      answers: {
        anonymous: { web_session_probe: true },
        perUser: { unified_web_session: true }
      },
      requests: [FEATURES, FEATURES, SESSION]
    }
  ])(
    '$state: follows the Firebase balance and reads no cookie balance',
    async ({ answers, requests }) => {
      const sent = stubCloud(answers)
      const { balance } = await mountBalance()

      await vi.waitFor(() =>
        expect(balance.value).toEqual({ status: 'ok', credits: 5 })
      )
      expect(sent.map(({ url }) => url)).toEqual(requests)
    }
  )

  it('probe hangs past the cap: follows the Firebase balance', async () => {
    vi.useFakeTimers({ shouldAdvanceTime: false })
    const cloud = Promise.withResolvers<void>()
    stubCloud({ ...SESSION_FLAGS, answered: cloud.promise })
    const { balance } = await mountBalance()

    await vi.advanceTimersByTimeAsync(ACCOUNT_SOURCE_CAP_MS - 1)
    expect(balance.value).toEqual({ status: 'unknown' })

    await vi.advanceTimersByTimeAsync(1)
    await vi.waitFor(() =>
      expect(balance.value).toEqual({ status: 'ok', credits: 5 })
    )
  })

  it('auth flag off: sends nothing and stays unknown', async () => {
    vi.useFakeTimers({ shouldAdvanceTime: false })
    const sent = stubCloud({ ...SESSION_FLAGS })
    const { balance } = await mountBalance({ authEnabled: false })

    await vi.advanceTimersByTimeAsync(ACCOUNT_SOURCE_CAP_MS)
    expect(sent).toEqual([])
    expect(balance.value).toEqual({ status: 'unknown' })
  })

  it('session source with a team workspace: unknown, not the personal balance', async () => {
    stubCloud({ ...SESSION_FLAGS })
    const { balance, session } = await mountBalance()
    await vi.waitFor(() =>
      expect(balance.value).toEqual({
        status: 'ok',
        credits: centsToCredits(211)
      })
    )

    session.value = credential('team')
    expect(balance.value).toEqual({ status: 'unknown' })
  })

  it('shares one balance request with the header on the same page', async () => {
    const sent = stubCloud({ ...SESSION_FLAGS })
    const { balance } = await mountBalance()
    const { default: HeaderMain } =
      await import('../components/common/HeaderMain/HeaderMain.vue')
    render(HeaderMain, { props: { workshopInBuild: true } })

    expect(await screen.findAllByTestId('header-session-credits')).toHaveLength(
      2
    )
    await vi.waitFor(() =>
      expect(balance.value).toEqual({
        status: 'ok',
        credits: centsToCredits(211)
      })
    )
    expect(sent.filter(({ url }) => url === BALANCE)).toEqual([
      SESSION_BALANCE_READ
    ])
  })
})
