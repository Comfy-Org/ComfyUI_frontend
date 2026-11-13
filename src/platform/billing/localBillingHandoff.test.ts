import { fetchRequests, respondToFetch } from '@comfyorg/test-utils/fetch'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import { useToast } from '@/components/ui/toast/toastStore'
import { useAuthDialogs } from '@/composables/auth/useAuthDialogs'
import { getComfyCloudBaseUrl } from '@/config/comfyApi'
import { t } from '@/i18n'
import type {
  DesktopHostAuthBridge,
  DesktopHostAuthState
} from '@/platform/auth/desktopHost/desktopHostAuthBridge'
import {
  startDesktopHostSession,
  stopDesktopHostSession
} from '@/platform/auth/desktopHost/desktopHostSession'
import { launchLocalBillingHandoff } from '@/platform/billing/localBillingHandoff'
import { useTeamWorkspaceStore } from '@/platform/workspace/stores/teamWorkspaceStore'

vi.mock(import('firebase/auth'))
vi.mock(import('@/i18n'))
vi.mock(import('@/composables/auth/useAuthDialogs'))
vi.mock(import('@/platform/billing/composables/useBillingCapabilities'))
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
const ENTRY_URL = 'https://billing.comfy.org/handoff#token=abc'

interface FakeTab {
  document: Document
  location: { href: string }
  opener: unknown
  closed: boolean
  close(): void
}

function fakeTab(): FakeTab {
  const tab: FakeTab = {
    document: document.implementation.createHTMLDocument(''),
    location: { href: '' },
    opener: window,
    closed: false,
    close: () => {
      tab.closed = true
    }
  }
  return tab
}

function openTabs(...tabs: (FakeTab | null)[]) {
  const open = vi.spyOn(window, 'open')
  for (const tab of tabs) open.mockReturnValueOnce(tab as unknown as Window)
  return open
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

describe('launchLocalBillingHandoff', () => {
  let session: Awaited<ReturnType<typeof signIn>>
  const retry = vi.fn()

  beforeEach(async () => {
    vi.mocked(useTeamWorkspaceStore().initialize).mockResolvedValue()
    session = await signIn()
  })

  afterEach(() => stopDesktopHostSession())

  it('sends the tab opened on click to the issued entry URL', async () => {
    const tab = fakeTab()
    openTabs(tab)
    respondToFetch(HANDOFFS, issued)

    await expect(launchLocalBillingHandoff('top-up', retry)).resolves.toBe(
      'opened'
    )

    expect(tab.document.title).toBe(t('billingHandoff.opening'))
    expect(tab.location.href).toBe(ENTRY_URL)
    expect(tab.closed).toBe(false)
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
      intent: 'top-up'
    })
  })

  it.for([
    {
      name: 'a refusal shows the server message',
      response: () =>
        Response.json(
          { code: 'BILLING_FORBIDDEN', message: 'Only the owner can pay' },
          { status: 403 }
        ),
      outcome: 'refused',
      toast: 'Only the owner can pay',
      signIn: 0
    },
    {
      name: 'an unreadable answer shows the generic error',
      response: () => Response.json({ entry_url: 1 }, { status: 201 }),
      outcome: 'refused',
      toast: 'billingHandoff.failed',
      signIn: 0
    },
    {
      name: 'a lost response shows the generic error',
      response: () => Promise.reject(new TypeError('network')),
      outcome: 'refused',
      toast: 'billingHandoff.failed',
      signIn: 0
    },
    {
      name: 'an ended sign-in asks to sign in again',
      response: () =>
        Response.json(
          { code: 'INVALID_CREDENTIAL', message: 'ended' },
          { status: 401 }
        ),
      outcome: 'sign_in_again',
      toast: 'billingHandoff.signInAgain',
      signIn: 1
    }
  ])(
    '$name and closes the tab',
    async ({ response, outcome, toast, signIn }) => {
      const tab = fakeTab()
      openTabs(tab)
      respondToFetch(HANDOFFS, response)

      await expect(launchLocalBillingHandoff('top-up', retry)).resolves.toBe(
        outcome
      )

      expect(tab.closed).toBe(true)
      expect(tab.location.href).toBe('')
      expect(useToast().toasts.map(({ title }) => title)).toEqual([toast])
      expect(useAuthDialogs().showSignInDialog).toHaveBeenCalledTimes(signIn)
    }
  )

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
    'drops the result and closes the tab when the user $name while issuing',
    async ({ moves, answer }) => {
      const tab = fakeTab()
      openTabs(tab)
      respondToFetch(HANDOFFS, () => {
        moves.forEach((workspaceId) => session.switchWorkspace(workspaceId))
        return answer()
      })

      await expect(launchLocalBillingHandoff('top-up', retry)).resolves.toBe(
        'superseded'
      )

      expect(tab.closed).toBe(true)
      expect(tab.location.href).toBe('')
      expect(useToast().toasts.map(({ title }) => title)).toEqual([
        'billingHandoff.superseded'
      ])
      expect(useAuthDialogs().showSignInDialog).not.toHaveBeenCalled()
    }
  )

  it('issues once for a double click', async () => {
    const first = fakeTab()
    const open = openTabs(first, fakeTab())
    respondToFetch(HANDOFFS, issued)

    const launches = [
      launchLocalBillingHandoff('top-up', retry),
      launchLocalBillingHandoff('top-up', retry)
    ]

    await expect(Promise.all(launches)).resolves.toEqual(['opened', 'busy'])
    expect(open).toHaveBeenCalledOnce()
    expect(fetchRequests(HANDOFFS)).toHaveLength(1)
  })

  it('offers to try again when the browser blocks the tab, without issuing', async () => {
    openTabs(null)

    await expect(launchLocalBillingHandoff('top-up', retry)).resolves.toBe(
      'blocked'
    )

    expect(fetchRequests(HANDOFFS)).toHaveLength(0)
    const [toast] = useToast().toasts
    expect(toast.title).toBe('billingHandoff.popupBlocked')
    expect(toast.actions.map(({ label }) => label)).toEqual([
      'billingHandoff.openBilling'
    ])
    toast.actions[0].onClick()
    expect(retry).toHaveBeenCalledOnce()
  })

  it('asks to sign in again without issuing when no account is signed in', async () => {
    stopDesktopHostSession()
    const tab = fakeTab()
    openTabs(tab)

    await expect(launchLocalBillingHandoff('top-up', retry)).resolves.toBe(
      'sign_in_again'
    )

    expect(tab.closed).toBe(true)
    expect(fetchRequests(HANDOFFS)).toHaveLength(0)
  })
})
