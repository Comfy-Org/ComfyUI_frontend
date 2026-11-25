import { useTelemetry } from '@comfyorg/telemetry'
import { fetchRequests, respondToFetch } from '@comfyorg/test-utils/fetch'
import { fromPartial } from '@total-typescript/shoehorn'
import { FirebaseError } from 'firebase/app'
import { AuthErrorCodes } from 'firebase/auth'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import { useToast } from '@/components/ui/toast/toastStore'
import { useAuthDialogs } from '@/composables/auth/useAuthDialogs'
import { getComfyCloudBaseUrl } from '@/config/comfyApi'
import type {
  DesktopHostAuthBridge,
  DesktopHostAuthState,
  DesktopHostBillingHandoff
} from '@/platform/auth/desktopHost/desktopHostAuthBridge'
import {
  startDesktopHostSession,
  stopDesktopHostSession
} from '@/platform/auth/desktopHost/desktopHostSession'
import {
  issueLocalBillingHandoff,
  openPlatformBillingHandoff,
  reserveBillingHandoffTab
} from '@/platform/billing/localBillingHandoff'
import { registerRefreshOnReturn } from '@/platform/billing/refreshOnReturn'
import { useTeamWorkspaceStore } from '@/platform/workspace/stores/teamWorkspaceStore'
import { signInFirebaseUser } from '@/utils/__tests__/stubAccountIdentityPort'

vi.mock(import('firebase/auth'))
vi.mock(import('@/i18n'))
vi.mock(import('@comfyorg/telemetry'))
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

async function signIn(
  issueBillingHandoff?: DesktopHostAuthBridge['issueBillingHandoff']
) {
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
    },
    issueBillingHandoff
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
const TAGGED_ENTRY_URL =
  'https://billing.comfy.org/handoff?intent=top-up&amount_cents=2500&utm_source=comfyui&utm_medium=app#token=abc'
const TOP_UP = { intent: 'top-up', amountCents: 2500 } as const
const live = new AbortController().signal

function reservedTab() {
  const tab = {
    opener: window,
    document: document.implementation.createHTMLDocument(''),
    location: { href: '' },
    close: vi.fn()
  }
  const open = vi.spyOn(window, 'open').mockReturnValue(tab as never)
  return { tab, open }
}

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
    expect(useTelemetry()?.trackBillingEvent).toHaveBeenCalledExactlyOnceWith({
      operation: 'local_handoff',
      stage: 'launched',
      outcome: 'pending',
      surface: 'local_web',
      result: 'opened'
    })
  })

  it.for([
    {
      name: 'the auto top-up the user ticked',
      autoTopUp: {
        threshold_credits: 1000,
        target_credits: 11_550,
        monthly_budget_cents: 5000
      }
    },
    { name: 'no auto top-up when none was ticked', autoTopUp: undefined }
  ])('sends $name with the top-up', async ({ autoTopUp }) => {
    respondToFetch(HANDOFFS, issued)

    await issueLocalBillingHandoff({ ...TOP_UP, autoTopUp }, live)

    const body = JSON.parse(String(fetchRequests(HANDOFFS)[0].body))
    expect(body.amount_cents).toBe(2500)
    expect(body.auto_top_up).toEqual(autoTopUp)
  })

  it('sends no amount for a subscription', async () => {
    respondToFetch(HANDOFFS, issued)

    await issueLocalBillingHandoff({ intent: 'subscription' }, live)

    const body = JSON.parse(String(fetchRequests(HANDOFFS)[0].body))
    expect(body.intent).toBe('subscription')
    expect(body).not.toHaveProperty('amount_cents')
  })

  it('issues a Platform handoff with no intent or amount', async () => {
    respondToFetch(HANDOFFS, issued)

    await expect(
      issueLocalBillingHandoff({ receiver: 'platform' }, live)
    ).resolves.toEqual({ status: 'ok', url: ENTRY_URL })

    const body = JSON.parse(String(fetchRequests(HANDOFFS)[0].body))
    expect(body).toMatchObject({
      workspace_id: 'ws-1',
      receiver: 'platform',
      surface: 'local_web'
    })
    expect(body).not.toHaveProperty('intent')
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

  describe('opening Platform billing', () => {
    it('reserves a tab in the click, issues for Platform, then navigates the tab', async () => {
      const { tab, open } = reservedTab()
      respondToFetch(HANDOFFS, issued)

      const opening = openPlatformBillingHandoff()
      expect(open).toHaveBeenCalledExactlyOnceWith('', '_blank')
      expect(tab.location.href).toBe('')
      await opening

      expect(tab.location.href).toBe(TAGGED_ENTRY_URL)
      expect(tab.close).not.toHaveBeenCalled()
      const [request] = fetchRequests(HANDOFFS)
      const body = JSON.parse(String(request.body))
      expect(body.receiver).toBe('platform')
      expect(body).not.toHaveProperty('intent')
      expect(useToast().error).not.toHaveBeenCalled()
    })

    it('opens the Platform page a view names, with the token still in the fragment', async () => {
      const { tab } = reservedTab()
      respondToFetch(HANDOFFS, issued)

      await openPlatformBillingHandoff('plans')

      const opened = new URL(tab.location.href)
      expect(opened.searchParams.get('view')).toBe('plans')
      expect(opened.hash).toBe('#token=abc')
      const [request] = fetchRequests(HANDOFFS)
      const body = JSON.parse(String(request.body))
      expect(body.receiver).toBe('platform')
      expect(body).not.toHaveProperty('intent')
    })

    it('closes the tab and shows the generic message when the issued URL cannot carry the view', async () => {
      const { tab } = reservedTab()
      respondToFetch(HANDOFFS, () =>
        Response.json(
          {
            entry_url: 'https://',
            expires_at: '2026-11-11T00:01:00Z',
            request_id: 'req-1'
          },
          { status: 201 }
        )
      )

      await openPlatformBillingHandoff('plans')

      expect(tab.close).toHaveBeenCalledOnce()
      expect(tab.location.href).toBe('')
      expect(useToast().error).toHaveBeenCalledExactlyOnceWith(
        'subscription.billingPortalUnavailable'
      )
    })

    it.for([
      {
        name: 'the server message when Cloud explained the refusal',
        respond: () =>
          Response.json(
            { code: 'BILLING_FORBIDDEN', message: 'Owners only' },
            { status: 403 }
          ),
        message: 'Owners only'
      },
      {
        name: 'a generic message when the refusal is unexplained',
        respond: () => new Response(null, { status: 503 }),
        message: 'subscription.billingPortalUnavailable'
      }
    ])('closes the tab and shows $name', async ({ respond, message }) => {
      const { tab } = reservedTab()
      respondToFetch(HANDOFFS, respond)

      await openPlatformBillingHandoff()

      expect(tab.close).toHaveBeenCalledOnce()
      expect(tab.location.href).toBe('')
      expect(useToast().error).toHaveBeenCalledExactlyOnceWith(message)
    })

    it('ignores a second click while the first is still opening', async () => {
      const { tab, open } = reservedTab()
      respondToFetch(HANDOFFS, issued)

      await Promise.all([
        openPlatformBillingHandoff(),
        openPlatformBillingHandoff()
      ])

      expect(open).toHaveBeenCalledOnce()
      expect(fetchRequests(HANDOFFS)).toHaveLength(1)
      expect(tab.location.href).toBe(TAGGED_ENTRY_URL)
      expect(tab.close).not.toHaveBeenCalled()
      expect(useToast().error).not.toHaveBeenCalled()
    })

    it('issues nothing when the browser blocks the tab', async () => {
      vi.spyOn(window, 'open').mockReturnValue(null)

      await openPlatformBillingHandoff()

      expect(fetchRequests(HANDOFFS)).toHaveLength(0)
      expect(useToast().error).toHaveBeenCalledExactlyOnceWith(
        'subscription.billingTabBlocked'
      )
    })
  })

  describe('on Desktop', () => {
    const issue =
      vi.fn<NonNullable<DesktopHostAuthBridge['issueBillingHandoff']>>()

    beforeEach(async () => {
      vi.stubGlobal('__comfyDesktop2', {})
      stopDesktopHostSession()
      session = await signIn(issue)
    })

    it('asks Desktop to issue the picked flow and returns only its entry URL', async () => {
      issue.mockResolvedValue({ status: 'issued', entryUrl: ENTRY_URL })

      await expect(issueLocalBillingHandoff(TOP_UP, live)).resolves.toEqual({
        status: 'ok',
        url: ENTRY_URL
      })

      expect(issue).toHaveBeenCalledExactlyOnceWith(
        'ws-1',
        'billing_web',
        'top-up',
        TOP_UP.amountCents
      )
      expect(fetchRequests(HANDOFFS)).toHaveLength(0)
      expect(useTelemetry()?.trackBillingEvent).toHaveBeenCalledExactlyOnceWith(
        {
          operation: 'local_handoff',
          stage: 'launched',
          outcome: 'pending',
          surface: 'desktop',
          result: 'opened'
        }
      )
    })

    it('asks Desktop for a subscription handoff without an amount', async () => {
      issue.mockResolvedValue({ status: 'issued', entryUrl: ENTRY_URL })

      await issueLocalBillingHandoff({ intent: 'subscription' }, live)

      expect(issue).toHaveBeenCalledExactlyOnceWith(
        'ws-1',
        'billing_web',
        'subscription',
        undefined
      )
    })

    it('asks Desktop for a Platform handoff with no intent or amount', async () => {
      issue.mockResolvedValue({ status: 'issued', entryUrl: ENTRY_URL })

      await expect(
        issueLocalBillingHandoff({ receiver: 'platform' }, live)
      ).resolves.toEqual({ status: 'ok', url: ENTRY_URL })

      expect(issue).toHaveBeenCalledExactlyOnceWith(
        'ws-1',
        'platform',
        undefined,
        undefined
      )
      expect(fetchRequests(HANDOFFS)).toHaveLength(0)
    })

    it('opens Platform billing in the system browser only once Desktop issued it', async () => {
      const open = vi.spyOn(window, 'open').mockReturnValue(null)
      let answer: (issued: DesktopHostBillingHandoff) => void = () => {}
      issue.mockReturnValue(
        new Promise((resolve) => {
          answer = resolve
        })
      )

      const opening = openPlatformBillingHandoff()
      await vi.waitFor(() => expect(issue).toHaveBeenCalledOnce())
      expect(open).not.toHaveBeenCalled()
      answer({ status: 'issued', entryUrl: ENTRY_URL })
      await opening

      expect(issue).toHaveBeenCalledExactlyOnceWith(
        'ws-1',
        'platform',
        undefined,
        undefined
      )
      expect(open).toHaveBeenCalledExactlyOnceWith(
        TAGGED_ENTRY_URL.replace('comfyui', 'comfy_desktop'),
        '_blank'
      )
      expect(fetchRequests(HANDOFFS)).toHaveLength(0)
    })

    it('opens the Platform page a view names in the system browser, through the same Platform handoff', async () => {
      const open = vi.spyOn(window, 'open').mockReturnValue(null)
      issue.mockResolvedValue({ status: 'issued', entryUrl: ENTRY_URL })

      await openPlatformBillingHandoff('plans')

      expect(issue).toHaveBeenCalledExactlyOnceWith(
        'ws-1',
        'platform',
        undefined,
        undefined
      )
      const [[url]] = open.mock.calls
      const opened = new URL(String(url))
      expect(opened.searchParams.get('view')).toBe('plans')
      expect(opened.hash).toBe('#token=abc')
    })

    it.for([
      {
        name: 'a refusal carries the server message',
        answer: {
          status: 'refused',
          code: 'HANDOFF_DISABLED',
          message: 'Billing is off'
        },
        message: 'Billing is off',
        signIn: 0
      },
      {
        name: 'an ended sign-in asks to sign in again',
        answer: { status: 'sign_in_again' },
        message: 'billingHandoff.signInAgain',
        signIn: 1
      },
      {
        name: 'an entry URL that is not https is refused',
        answer: {
          status: 'issued',
          entryUrl: 'http://billing.comfy.org/handoff'
        },
        message: undefined,
        signIn: 0
      },
      {
        name: 'a bridge that turned itself off is refused',
        answer: { status: 'disabled' },
        message: undefined,
        signIn: 0
      }
    ] as const)('$name', async ({ answer, message, signIn: prompts }) => {
      issue.mockResolvedValue(answer)

      await expect(issueLocalBillingHandoff(TOP_UP, live)).resolves.toEqual({
        status: 'error',
        message
      })
      expect(useAuthDialogs().showSignInDialog).toHaveBeenCalledTimes(prompts)
    })

    it('reports the code of a refusal Desktop explained', async () => {
      issue.mockResolvedValue({
        status: 'refused',
        code: 'HANDOFF_DISABLED',
        message: 'Billing is off'
      })

      await issueLocalBillingHandoff(TOP_UP, live)

      expect(useTelemetry()?.trackBillingEvent).toHaveBeenCalledExactlyOnceWith(
        {
          operation: 'local_handoff',
          stage: 'launched',
          outcome: 'failed',
          surface: 'desktop',
          result: 'refused',
          error_code: 'HANDOFF_DISABLED'
        }
      )
    })

    it('gives up on a bridge that never answers, so later clicks are not stuck', async () => {
      issue.mockReturnValue(new Promise(() => {}))

      const stuck = issueLocalBillingHandoff(TOP_UP, live)
      await vi.advanceTimersByTimeAsync(40_000)

      await expect(stuck).resolves.toEqual({
        status: 'error',
        message: undefined
      })
      issue.mockResolvedValue({ status: 'issued', entryUrl: ENTRY_URL })
      await expect(issueLocalBillingHandoff(TOP_UP, live)).resolves.toEqual({
        status: 'ok',
        url: ENTRY_URL
      })
    })

    it('frees the next handoff as soon as the caller abandons one Desktop has not answered', async () => {
      issue.mockReturnValueOnce(new Promise(() => {}))
      const abandoned = new AbortController()

      const dropped = issueLocalBillingHandoff(TOP_UP, abandoned.signal)
      abandoned.abort()

      await expect(dropped).resolves.toEqual({
        status: 'error',
        message: undefined
      })
      expect(useTelemetry()?.trackBillingEvent).not.toHaveBeenCalled()
      issue.mockResolvedValue({ status: 'issued', entryUrl: ENTRY_URL })
      await expect(issueLocalBillingHandoff(TOP_UP, live)).resolves.toEqual({
        status: 'ok',
        url: ENTRY_URL
      })
    })

    it.for([
      {
        name: 'switches to another workspace',
        leave: () => session.switchWorkspace('ws-2')
      },
      {
        name: 'switches away and back',
        leave: () => {
          session.switchWorkspace('ws-2')
          session.switchWorkspace('ws-1')
        }
      },
      { name: 'signs out', leave: () => stopDesktopHostSession() }
    ])(
      'drops the entry URL Desktop issues when the user $name while Desktop is issuing',
      async ({ leave }) => {
        issue.mockImplementation(async () => {
          leave()
          return { status: 'issued', entryUrl: ENTRY_URL }
        })

        await expect(issueLocalBillingHandoff(TOP_UP, live)).resolves.toEqual({
          status: 'error',
          message: 'billingHandoff.superseded'
        })
        expect(registerRefreshOnReturn).not.toHaveBeenCalled()
        expect(useAuthDialogs().showSignInDialog).not.toHaveBeenCalled()
      }
    )

    it('asks Desktop once while a handoff is in flight', async () => {
      issue.mockResolvedValue({ status: 'issued', entryUrl: ENTRY_URL })

      const issues = [
        issueLocalBillingHandoff(TOP_UP, live),
        issueLocalBillingHandoff(TOP_UP, live)
      ]

      await expect(Promise.all(issues)).resolves.toEqual([
        { status: 'ok', url: ENTRY_URL },
        { status: 'error', message: undefined }
      ])
      expect(issue).toHaveBeenCalledOnce()
    })

    it('keeps the next handoff when the abandoned one is answered late', async () => {
      let answerAbandoned: (answer: {
        status: 'sign_in_again'
      }) => void = () => {}
      issue.mockReturnValueOnce(
        new Promise((resolve) => {
          answerAbandoned = resolve
        })
      )
      const abandoned = new AbortController()
      const dropped = issueLocalBillingHandoff(TOP_UP, abandoned.signal)
      abandoned.abort()
      await dropped
      let answerNext: (answer: {
        status: 'issued'
        entryUrl: string
      }) => void = () => {}
      issue.mockReturnValueOnce(
        new Promise((resolve) => {
          answerNext = resolve
        })
      )

      const next = issueLocalBillingHandoff(TOP_UP, live)
      answerAbandoned({ status: 'sign_in_again' })
      await vi.advanceTimersByTimeAsync(0)
      const whileNextIsPending = issueLocalBillingHandoff(TOP_UP, live)
      answerNext({ status: 'issued', entryUrl: ENTRY_URL })

      await expect(whileNextIsPending).resolves.toEqual({
        status: 'error',
        message: undefined
      })
      await expect(next).resolves.toEqual({ status: 'ok', url: ENTRY_URL })
      expect(useAuthDialogs().showSignInDialog).not.toHaveBeenCalled()
      expect(useTelemetry()?.trackBillingEvent).toHaveBeenCalledExactlyOnceWith(
        expect.objectContaining({ result: 'opened' })
      )
    })

    it('does not ask Desktop for a handoff the caller already abandoned', async () => {
      const abandoned = new AbortController()
      abandoned.abort()

      await expect(
        issueLocalBillingHandoff(TOP_UP, abandoned.signal)
      ).resolves.toEqual({ status: 'error', message: undefined })
      expect(issue).not.toHaveBeenCalled()
    })

    it('stops listening to the caller once Desktop answers', async () => {
      issue.mockResolvedValue({ status: 'issued', entryUrl: ENTRY_URL })
      const caller = new AbortController()
      const listen = vi.spyOn(caller.signal, 'addEventListener')
      const unlisten = vi.spyOn(caller.signal, 'removeEventListener')

      await issueLocalBillingHandoff(TOP_UP, caller.signal)

      expect(listen).toHaveBeenCalledOnce()
      expect(unlisten).toHaveBeenCalledExactlyOnceWith(
        'abort',
        listen.mock.calls[0][1]
      )
    })

    it('asks to sign in again when Desktop ends its session over the handoff it refused', async () => {
      issue.mockImplementation(async () => {
        stopDesktopHostSession()
        return { status: 'sign_in_again' }
      })

      await expect(issueLocalBillingHandoff(TOP_UP, live)).resolves.toEqual({
        status: 'error',
        message: 'billingHandoff.signInAgain'
      })
      expect(useAuthDialogs().showSignInDialog).toHaveBeenCalledOnce()
      expect(useTelemetry()?.trackBillingEvent).toHaveBeenCalledExactlyOnceWith(
        expect.objectContaining({ result: 'sign_in_again' })
      )
    })

    it('drops a sign-in refusal that arrives after the user switched workspace', async () => {
      issue.mockImplementation(async () => {
        session.switchWorkspace('ws-2')
        return { status: 'sign_in_again' }
      })

      await expect(issueLocalBillingHandoff(TOP_UP, live)).resolves.toEqual({
        status: 'error',
        message: 'billingHandoff.superseded'
      })
      expect(useAuthDialogs().showSignInDialog).not.toHaveBeenCalled()
    })

    it.for<{ name: string; replace: () => Promise<void> }>([
      {
        name: 'switched workspace',
        replace: async () => session.switchWorkspace('ws-2')
      },
      {
        name: 'signed out and back in',
        replace: async () => {
          stopDesktopHostSession()
          session = await signIn(issue)
        }
      }
    ])(
      'keeps a refusal superseded when the user $name and then signed out',
      async ({ replace }) => {
        issue.mockImplementation(async () => {
          await replace()
          stopDesktopHostSession()
          return { status: 'sign_in_again' }
        })

        await expect(issueLocalBillingHandoff(TOP_UP, live)).resolves.toEqual({
          status: 'error',
          message: 'billingHandoff.superseded'
        })
        expect(useAuthDialogs().showSignInDialog).not.toHaveBeenCalled()
        expect(
          useTelemetry()?.trackBillingEvent
        ).toHaveBeenCalledExactlyOnceWith(
          expect.objectContaining({ result: 'superseded' })
        )
      }
    )

    it('treats a bridge that throws before answering as an unexplained refusal', async () => {
      issue.mockImplementation(() => {
        throw new Error('ipc boundary')
      })

      await expect(issueLocalBillingHandoff(TOP_UP, live)).resolves.toEqual({
        status: 'error',
        message: undefined
      })
    })

    it('treats a failed bridge call as an unexplained refusal', async () => {
      issue.mockRejectedValue(new Error('ipc closed'))

      await expect(issueLocalBillingHandoff(TOP_UP, live)).resolves.toEqual({
        status: 'error',
        message: undefined
      })
    })
  })
})

describe('reserveBillingHandoffTab', () => {
  it('gives the reserved tab its own title, apart from the heading', () => {
    const page = document.implementation.createHTMLDocument('')
    vi.spyOn(window, 'open').mockReturnValue(
      fromPartial<Window>({ opener: null, document: page })
    )

    reserveBillingHandoffTab()

    expect(page.title).toBe('billingHandoff.openingTabTitle')
    expect(page.body.textContent).toBe(
      'billingHandoff.openingbillingHandoff.openingDetail'
    )
  })
})

describe('issueLocalBillingHandoff for a Firebase sign-in', () => {
  function signIn(mint: () => Promise<string>) {
    signInFirebaseUser(mint)
    Object.assign(useTeamWorkspaceStore(), { activeWorkspaceId: 'ws-1' })
  }

  it.for([
    {
      name: 'a token minted for this handoff instead of the cached one',
      mint: async () => 'minted-token',
      sent: 'Bearer minted-token'
    },
    {
      name: 'the cached token when a new one cannot be minted',
      mint: () =>
        Promise.reject(
          new FirebaseError(AuthErrorCodes.NETWORK_REQUEST_FAILED, 'offline')
        ),
      sent: 'Bearer cached-token'
    }
  ])('issues with $name', async ({ mint, sent }) => {
    signIn(mint)
    respondToFetch(HANDOFFS, issued)

    await expect(issueLocalBillingHandoff(TOP_UP, live)).resolves.toEqual({
      status: 'ok',
      url: ENTRY_URL
    })

    expect(fetchRequests(HANDOFFS)[0].headers.get('Authorization')).toBe(sent)
  })

  it('frees the next handoff once the caller abandons one still minting its ID token, and issues nothing for the late token', async () => {
    let deliverLate: (token: string) => void = () => {}
    const mint = vi
      .fn<() => Promise<string>>()
      .mockReturnValueOnce(
        new Promise((resolve) => {
          deliverLate = resolve
        })
      )
      .mockResolvedValue('minted-token')
    signIn(mint)
    respondToFetch(HANDOFFS, issued)
    const abandoned = new AbortController()

    const dropped = issueLocalBillingHandoff(TOP_UP, abandoned.signal)
    abandoned.abort()
    await expect(dropped).resolves.toEqual({
      status: 'error',
      message: undefined
    })
    deliverLate('late-token')

    await expect(issueLocalBillingHandoff(TOP_UP, live)).resolves.toEqual({
      status: 'ok',
      url: ENTRY_URL
    })
    expect(
      fetchRequests(HANDOFFS).map((request) =>
        request.headers.get('Authorization')
      )
    ).toEqual(['Bearer minted-token'])
  })

  it('gives up on an ID token that never arrives, so later clicks are not stuck', async () => {
    const overdue = new AbortController()
    vi.spyOn(AbortSignal, 'timeout').mockReturnValueOnce(overdue.signal)
    const mint = vi
      .fn<() => Promise<string>>()
      .mockReturnValueOnce(new Promise(() => {}))
      .mockResolvedValue('minted-token')
    signIn(mint)
    respondToFetch(HANDOFFS, issued)

    const stuck = issueLocalBillingHandoff(TOP_UP, live)
    overdue.abort()

    await expect(stuck).resolves.toEqual({
      status: 'error',
      message: undefined
    })
    expect(AbortSignal.timeout).toHaveBeenCalledWith(15_000)
    await expect(issueLocalBillingHandoff(TOP_UP, live)).resolves.toEqual({
      status: 'ok',
      url: ENTRY_URL
    })
  })

  it('is not superseded by the ID token rotation it causes, nor is the next handoff', async () => {
    signIn(async () => 'minted-token')
    respondToFetch(HANDOFFS, issued)

    const duringRotation = await issueLocalBillingHandoff(TOP_UP, live)
    const afterRotation = await issueLocalBillingHandoff(TOP_UP, live)

    expect([duringRotation, afterRotation]).toEqual([
      { status: 'ok', url: ENTRY_URL },
      { status: 'ok', url: ENTRY_URL }
    ])
  })
})
