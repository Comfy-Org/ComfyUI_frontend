// @vitest-environment jsdom
import { render, screen, waitFor } from '@testing-library/vue'
import userEvent from '@testing-library/user-event'
import { beforeEach, describe, expect, it, onTestFinished, vi } from 'vitest'

import { platformTopUpHref } from '../../lib/workshop/buy-credits'
import HeaderAccount from './HeaderAccount.vue'

const h = vi.hoisted(() => ({
  flag: undefined as { value: boolean } | undefined,
  user: undefined as { value: unknown } | undefined,
  session: undefined as { value: unknown } | undefined,
  sessionFailure: undefined as { value: unknown } | undefined,
  balance: undefined as { value: unknown } | undefined,
  ensureFresh: vi.fn(),
  remint: vi.fn(),
  signOut: vi.fn()
}))

vi.mock<unknown>(import('../../scripts/posthog'), async () => {
  const { ref } = await import('vue')
  const flag = ref(true)
  h.flag = flag
  return { useWorkshopAuthFlag: () => flag }
})

vi.mock<unknown>(import('../../config/workshop-session-state'), async () => {
  const { ref } = await import('vue')
  const user = ref<unknown>(null)
  const session = ref<unknown>(undefined)
  const sessionFailure = ref<unknown>(undefined)
  h.user = user
  h.session = session
  h.sessionFailure = sessionFailure
  return {
    useWorkshopSession: () => ({
      user,
      session,
      sessionFailure,
      ensureFresh: h.ensureFresh,
      remint: h.remint,
      signOut: h.signOut
    })
  }
})

vi.mock<unknown>(import('../../config/workshop-credits'), async () => {
  const { ref } = await import('vue')
  const balance = ref<unknown>({ status: 'unknown' })
  h.balance = balance
  return {
    useWorkshopCredits: () => ({ balance }),
    refreshWorkshopCredits: vi.fn().mockResolvedValue(undefined)
  }
})

const workspace = { id: 'ws', name: 'Personal', type: 'personal' as const }

beforeEach(() => {
  h.remint.mockReset()
  h.flag!.value = true
  h.user!.value = null
  h.session!.value = undefined
  h.sessionFailure!.value = undefined
  h.balance!.value = { status: 'unknown' }
  h.ensureFresh.mockReset().mockResolvedValue({ status: 'error' })
  h.signOut.mockReset().mockResolvedValue(undefined)
})

describe('HeaderAccount', () => {
  it('renders nothing while the flag is off', () => {
    h.flag!.value = false
    render(HeaderAccount)
    expect(screen.queryByRole('link', { name: /sign in/i })).toBeNull()
    expect(screen.queryByRole('button')).toBeNull()
  })

  it('shows a sign-in link when signed out', () => {
    render(HeaderAccount)
    expect(screen.getByRole('link', { name: /sign in/i })).toBeTruthy()
  })

  it('appears when the flag turns on after mount', async () => {
    h.flag!.value = false
    render(HeaderAccount)
    expect(screen.queryByRole('link', { name: /sign in/i })).toBeNull()

    h.flag!.value = true

    await waitFor(() => {
      expect(
        screen.getByRole('link', { name: /sign in/i }),
        'PostHog answers after mount; a one-shot flag read never shows the control'
      ).toBeTruthy()
    })
  })

  it('shows a session-retry control when the last mint attempt failed', () => {
    h.user!.value = { email: 'a@b.co', displayName: null }
    h.session!.value = undefined
    h.sessionFailure!.value = { status: 'error', code: 'TOKEN_EXCHANGE_FAILED' }
    render(HeaderAccount)
    expect(screen.getByRole('button', { name: /session error/i })).toBeTruthy()
  })

  it('shows a neutral signing-in state while the mint is legitimately in flight', () => {
    h.user!.value = { email: 'a@b.co', displayName: null }
    h.session!.value = undefined
    h.sessionFailure!.value = undefined
    render(HeaderAccount)

    expect(
      screen.queryByRole('button', { name: /session error/i }),
      'normal sign-in latency is not an error and must not flash error styling'
    ).toBeNull()
    expect(screen.getByRole('status')).toBeTruthy()
  })

  it('shows the account control with the credits chip when signed in', () => {
    h.user!.value = { email: 'a@b.co', displayName: 'Ada' }
    h.session!.value = { token: 'jwt', uid: 'user-1', workspace, role: 'owner' }
    h.balance!.value = { status: 'ok', credits: 1234 }
    render(HeaderAccount)

    expect(screen.getByRole('button', { name: /account/i })).toBeTruthy()
    expect(screen.getByText(/1,234/)).toBeTruthy()
  })

  it.for([0, 1234])(
    'offers billing from the account menu with %s credits',
    async (credits) => {
      h.user!.value = { email: 'a@b.co', displayName: 'Ada' }
      h.session!.value = {
        token: 'jwt',
        uid: 'user-1',
        workspace,
        role: 'owner'
      }
      h.balance!.value = { status: 'ok', credits }
      render(HeaderAccount)

      await userEvent
        .setup()
        .click(screen.getByRole('button', { name: /account/i }))
      const buy = await screen.findByRole('menuitem', {
        name: /add credits/i
      })
      expect(buy.getAttribute('href')).toBe(platformTopUpHref(workspace.id))
      expect(buy.getAttribute('target')).toBe('_blank')
      expect(screen.getByRole('menuitem', { name: /log out/i })).toBeTruthy()
    }
  )

  it('speaks the balance in the account button name, not just on screen', () => {
    h.user!.value = { email: 'a@b.co', displayName: 'Ada' }
    h.session!.value = { token: 'jwt', uid: 'user-1', workspace, role: 'owner' }
    h.balance!.value = { status: 'ok', credits: 1234 }
    render(HeaderAccount)

    // A bare aria-label="Account" would win over the child text and leave the
    // balance unspoken; the accessible name must carry it.
    expect(screen.getByRole('button', { name: /1,234 credits/i })).toBeTruthy()
  })

  it('uses the singular label for one credit', () => {
    h.user!.value = { email: 'a@b.co', displayName: 'Ada' }
    h.session!.value = { token: 'jwt', uid: 'user-1', workspace, role: 'owner' }
    h.balance!.value = { status: 'ok', credits: 1 }
    render(HeaderAccount)

    expect(screen.getByRole('button', { name: /1 credit$/i })).toBeTruthy()
  })

  it('shows progress while retrying a failed session', async () => {
    let release!: () => void
    h.ensureFresh.mockImplementation(
      () => new Promise<void>((resolve) => (release = resolve))
    )
    h.user!.value = { email: 'a@b.co', displayName: null }
    h.sessionFailure!.value = { status: 'error', code: 'TOKEN_EXCHANGE_FAILED' }
    render(HeaderAccount)

    await userEvent
      .setup()
      .click(screen.getByRole('button', { name: /session error/i }))

    const pending = screen.getByRole('button', { name: /retrying session/i })
    expect(pending.getAttribute('aria-busy')).toBe('true')
    expect(pending.hasAttribute('disabled')).toBe(true)
    release()
    expect(
      await screen.findByRole('button', { name: /session error/i })
    ).toBeTruthy()
  })

  it('omits the credits number when the balance is in error', () => {
    h.user!.value = { email: 'a@b.co', displayName: 'Ada' }
    h.session!.value = { token: 'jwt', uid: 'user-1', workspace, role: 'owner' }
    h.balance!.value = { status: 'error' }
    render(HeaderAccount)

    expect(screen.getByRole('button', { name: /account/i })).toBeTruthy()
    expect(screen.queryByText(/credits/i)).toBeNull()
  })
})

describe('HeaderAccount menu', () => {
  function signIn() {
    h.user!.value = { email: 'a@b.co', displayName: 'Ada' }
    h.session!.value = { token: 'jwt', uid: 'user-1', workspace, role: 'owner' }
    h.balance!.value = { status: 'ok', credits: 42 }
  }

  it('links Add credits to platform for this workspace and settings to Cloud', async () => {
    signIn()
    const user = userEvent.setup()
    render(HeaderAccount)

    await user.click(screen.getByTestId('header-account'))

    const topUp = await screen.findByTestId('account-add-credits')
    expect(topUp.getAttribute('href')).toBe(platformTopUpHref(workspace.id))
    expect(topUp.getAttribute('target')).toBe('_blank')
    expect(
      screen.getByTestId('account-workspace-settings').getAttribute('href')
    ).toBe('https://cloud.comfy.org')
  })

  it('hides the top-up row from a member', async () => {
    signIn()
    h.session!.value = {
      token: 'jwt',
      uid: 'user-1',
      workspace,
      role: 'member'
    }
    const user = userEvent.setup()
    render(HeaderAccount)

    await user.click(screen.getByTestId('header-account'))

    await screen.findByTestId('account-workspace-settings')
    expect(screen.queryByTestId('account-add-credits')).toBeNull()
  })

  it('closes on Escape and hands focus back to the trigger', async () => {
    signIn()
    const user = userEvent.setup()
    render(HeaderAccount)

    const trigger = screen.getByTestId('header-account')
    await user.click(trigger)
    await screen.findByRole('menu')

    await user.keyboard('{Escape}')
    await waitFor(() => expect(screen.queryByRole('menu')).toBeNull())
    // eslint-disable-next-line testing-library/no-node-access
    expect(document.activeElement).toBe(trigger)
  })
})

describe('HeaderAccount workspace switcher', () => {
  function signIn() {
    h.user!.value = { email: 'a@b.co', displayName: 'Ada' }
    h.session!.value = { token: 'jwt', uid: 'user-1', workspace, role: 'owner' }
    h.balance!.value = { status: 'ok', credits: 42 }
  }

  const listing = {
    workspaces: [
      {
        id: 'ws',
        name: 'Personal',
        role: 'owner',
        type: 'personal',
        subscription_tier: 'PRO',
        created_at: '2026-01-01T00:00:00Z',
        joined_at: '2026-01-01T00:00:00Z'
      },
      {
        id: 'team-1',
        name: 'Comfy team',
        role: 'member',
        type: 'team',
        created_at: '2026-02-01T00:00:00Z',
        joined_at: '2026-02-01T00:00:00Z'
      }
    ]
  }

  async function openSwitcher(user: ReturnType<typeof userEvent.setup>) {
    await user.click(screen.getByTestId('header-account'))
    await screen.findByTestId('account-workspace')
    await user.keyboard('{ArrowDown}')
    await user.keyboard('{Enter}')
  }

  it('lists the account workspaces with the current one checked', async () => {
    signIn()
    vi.stubGlobal(
      'fetch',
      vi
        .fn()
        .mockResolvedValue(
          new Response(JSON.stringify(listing), { status: 200 })
        )
    )
    onTestFinished(() => {
      vi.unstubAllGlobals()
    })
    const user = userEvent.setup()
    render(HeaderAccount)

    await openSwitcher(user)

    expect(await screen.findByTestId('account-workspace-team-1')).toBeTruthy()
    const current = screen.getByTestId('account-workspace-ws')
    expect(current.textContent).toContain('Personal')
    expect(current.textContent).toContain('PRO')
  })

  it('switches by reminting for the picked workspace', async () => {
    signIn()
    vi.stubGlobal(
      'fetch',
      vi
        .fn()
        .mockResolvedValue(
          new Response(JSON.stringify(listing), { status: 200 })
        )
    )
    onTestFinished(() => {
      vi.unstubAllGlobals()
    })
    h.remint.mockResolvedValue({ status: 'ok' })
    const user = userEvent.setup()
    render(HeaderAccount)

    await openSwitcher(user)
    await user.click(await screen.findByTestId('account-workspace-team-1'))

    await waitFor(() =>
      expect(h.remint).toHaveBeenCalledWith(undefined, {
        workspaceId: 'team-1'
      })
    )
    await waitFor(() => expect(screen.queryByRole('menu')).toBeNull())
  })

  it('shows the failure line when the list cannot load', async () => {
    signIn()
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue(new Response('', { status: 500 }))
    )
    onTestFinished(() => {
      vi.unstubAllGlobals()
    })
    const user = userEvent.setup()
    render(HeaderAccount)

    await openSwitcher(user)

    expect(await screen.findByText('Could not load workspaces.')).toBeTruthy()
  })
})
