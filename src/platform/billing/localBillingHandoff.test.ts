import { fetchRequests, respondToFetch } from '@comfyorg/test-utils/fetch'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import { useAuthDialogs } from '@/composables/auth/useAuthDialogs'
import { getComfyCloudBaseUrl } from '@/config/comfyApi'
import type {
  DesktopHostAuthBridge,
  DesktopHostAuthState
} from '@/platform/auth/desktopHost/desktopHostAuthBridge'
import {
  startDesktopHostSession,
  stopDesktopHostSession
} from '@/platform/auth/desktopHost/desktopHostSession'
import { issueLocalBillingHandoff } from '@/platform/billing/localBillingHandoff'
import { registerRefreshOnReturn } from '@/platform/billing/refreshOnReturn'
import { useTeamWorkspaceStore } from '@/platform/workspace/stores/teamWorkspaceStore'

vi.mock(import('firebase/auth'))
vi.mock(import('@/i18n'))
vi.mock(import('@/composables/auth/useAuthDialogs'))
vi.mock(import('@/platform/billing/composables/useBillingCapabilities'))
vi.mock(import('@/platform/billing/refreshOnReturn'), () => ({
  registerRefreshOnReturn: vi.fn(() => () => {})
}))
vi.mock(import('@/platform/billing/billingRefresh'), () => ({
  refreshBilling: vi.fn(async () => undefined)
}))
vi.mock(import('@/platform/distribution/types'), () => ({
  DISTRIBUTION: 'localhost' as const,
  isNightly: false,
  isCloud: false,
  isDesktop: false
}))

function signedIn(workspaceId: string): DesktopHostAuthState {
  return { status: 'signed_in', userId: 'user-1', workspaceId }
}

async function signIn() {
  const listeners = new Set<(state: DesktopHostAuthState) => void>()
  let state = signedIn('ws-1')
  const bridge = {
    getState: async () => state,
    getWorkspaceToken: async (workspaceId: string) => `token-${workspaceId}`,
    requestSignIn: async () => state,
    signOut: async (): Promise<DesktopHostAuthState> => ({
      status: 'signed_out'
    }),
    onChanged: (callback: (next: DesktopHostAuthState) => void) => {
      listeners.add(callback)
      return () => listeners.delete(callback)
    }
  } satisfies DesktopHostAuthBridge
  await startDesktopHostSession(bridge)
  return {
    switchWorkspace: (workspaceId: string) => {
      state = signedIn(workspaceId)
      listeners.forEach((listener) => listener(state))
    }
  }
}

const HANDOFFS = /\/api\/auth\/handoffs$/
const ENTRY_URL =
  'https://billing.comfy.org/handoff?intent=top-up&amount_cents=2500#token=abc'
const TOP_UP = { intent: 'top-up', amountCents: 2500 } as const
const live = new AbortController().signal

function issued() {
  return Response.json(
    {
      entry_url: ENTRY_URL,
      expires_at: '2026-11-11T00:01:00Z',
      request_id: 'req-1'
    },
    { status: 201 }
  )
}

describe('issueLocalBillingHandoff', () => {
  let session: Awaited<ReturnType<typeof signIn>>

  beforeEach(async () => {
    vi.mocked(useTeamWorkspaceStore().initialize).mockResolvedValue()
    session = await signIn()
  })

  afterEach(() => stopDesktopHostSession())

  it('issues a handoff for the flow and amount the user picked', async () => {
    respondToFetch(HANDOFFS, issued)

    await expect(issueLocalBillingHandoff(TOP_UP, live)).resolves.toEqual({
      status: 'ok',
      url: ENTRY_URL
    })

    const [request] = fetchRequests(HANDOFFS)
    expect(request.url).toBe(
      new URL('/api/auth/handoffs', getComfyCloudBaseUrl()).href
    )
    expect(request.method).toBe('POST')
    expect(request.headers.get('Authorization')).toBe('Bearer token-ws-1')
    expect(JSON.parse(String(request.body))).toMatchObject({
      workspace_id: 'ws-1',
      receiver: 'billing_web',
      surface: 'local_web',
      intent: 'top-up',
      amount_cents: 2500
    })
    expect(registerRefreshOnReturn).toHaveBeenCalledOnce()
  })

  it('sends no amount for a subscription', async () => {
    respondToFetch(HANDOFFS, issued)

    await issueLocalBillingHandoff({ intent: 'subscription' }, live)

    const body = JSON.parse(String(fetchRequests(HANDOFFS)[0].body))
    expect(body.intent).toBe('subscription')
    expect(body).not.toHaveProperty('amount_cents')
  })

  it.for([
    {
      name: 'a refusal carries the server message',
      response: () =>
        Response.json(
          { code: 'BILLING_FORBIDDEN', message: 'Only the owner can pay' },
          { status: 403 }
        ),
      message: 'Only the owner can pay',
      signIn: 0
    },
    {
      name: 'an unreadable answer carries no message',
      response: () => Response.json({ entry_url: 1 }, { status: 201 }),
      message: undefined,
      signIn: 0
    },
    {
      name: 'a lost response carries no message',
      response: () => Promise.reject(new TypeError('network')),
      message: undefined,
      signIn: 0
    },
    {
      name: 'an ended sign-in asks to sign in again',
      response: () =>
        Response.json(
          { code: 'INVALID_CREDENTIAL', message: 'ended' },
          { status: 401 }
        ),
      message: 'billingHandoff.signInAgain',
      signIn: 1
    }
  ])('$name', async ({ response, message, signIn }) => {
    respondToFetch(HANDOFFS, response)

    await expect(issueLocalBillingHandoff(TOP_UP, live)).resolves.toEqual({
      status: 'error',
      message
    })
    expect(useAuthDialogs().showSignInDialog).toHaveBeenCalledTimes(signIn)
  })

  it.for([
    { name: 'switches to another workspace', moves: ['ws-2'], answer: issued },
    {
      name: 'switches away and back',
      moves: ['ws-2', 'ws-1'],
      answer: issued
    },
    {
      name: 'switches workspace before a refusal arrives',
      moves: ['ws-2'],
      answer: () =>
        Response.json(
          { code: 'INVALID_CREDENTIAL', message: 'ended' },
          { status: 401 }
        )
    }
  ])(
    'drops the result when the user $name while issuing',
    async ({ moves, answer }) => {
      respondToFetch(HANDOFFS, () => {
        moves.forEach((workspaceId) => session.switchWorkspace(workspaceId))
        return answer()
      })

      await expect(issueLocalBillingHandoff(TOP_UP, live)).resolves.toEqual({
        status: 'error',
        message: 'billingHandoff.superseded'
      })
      expect(useAuthDialogs().showSignInDialog).not.toHaveBeenCalled()
    }
  )

  it('issues once while a handoff is in flight', async () => {
    respondToFetch(HANDOFFS, issued)

    const issues = [
      issueLocalBillingHandoff(TOP_UP, live),
      issueLocalBillingHandoff(TOP_UP, live)
    ]

    await expect(Promise.all(issues)).resolves.toEqual([
      { status: 'ok', url: ENTRY_URL },
      { status: 'error', message: undefined }
    ])
    expect(fetchRequests(HANDOFFS)).toHaveLength(1)
  })

  it('asks to sign in again without issuing when no account is signed in', async () => {
    stopDesktopHostSession()

    await expect(issueLocalBillingHandoff(TOP_UP, live)).resolves.toEqual({
      status: 'error',
      message: 'billingHandoff.signInAgain'
    })
    expect(fetchRequests(HANDOFFS)).toHaveLength(0)
    expect(useAuthDialogs().showSignInDialog).toHaveBeenCalledOnce()
  })

  it('drops a handoff the caller abandons mid-issue and frees the next one', async () => {
    const abandoned = new AbortController()
    respondToFetch(HANDOFFS, () => {
      abandoned.abort()
      return issued()
    })

    await expect(
      issueLocalBillingHandoff(TOP_UP, abandoned.signal)
    ).resolves.toEqual({ status: 'error', message: undefined })
    expect(registerRefreshOnReturn).not.toHaveBeenCalled()
    expect(useAuthDialogs().showSignInDialog).not.toHaveBeenCalled()

    respondToFetch(HANDOFFS, issued)
    await expect(issueLocalBillingHandoff(TOP_UP, live)).resolves.toEqual({
      status: 'ok',
      url: ENTRY_URL
    })
  })
})
