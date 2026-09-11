// @vitest-environment happy-dom
import { fireEvent, render, screen, waitFor } from '@testing-library/vue'
import userEvent from '@testing-library/user-event'
import { beforeEach, describe, expect, it, onTestFinished, vi } from 'vitest'

import { onBeforeSignInLeave } from '../../config/workshop-return'
import { WORKSHOP_CLOUD_BASE_URL } from '../../config/workshop-env'
import HeaderAccount from './HeaderAccount.vue'

const h = vi.hoisted(() => ({
  flag: undefined as { value: boolean } | undefined,
  user: undefined as { value: unknown } | undefined,
  session: undefined as { value: unknown } | undefined,
  sessionFailure: undefined as { value: unknown } | undefined,
  balance: undefined as { value: unknown } | undefined,
  ensureFresh: vi.fn(),
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
      signOut: h.signOut
    })
  }
})

vi.mock<unknown>(import('../../config/workshop-credits'), async () => {
  const { ref } = await import('vue')
  const balance = ref<unknown>({ status: 'unknown' })
  h.balance = balance
  return { useWorkshopCredits: () => ({ balance }) }
})

const workspace = { id: 'ws', name: 'Personal', type: 'personal' as const }

beforeEach(() => {
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
      const buy = screen.getByRole('menuitem', { name: 'Buy credits' })
      expect(buy.getAttribute('href')).toBe(
        `${WORKSHOP_CLOUD_BASE_URL}/?settings=plan-credits`
      )
      expect(buy.getAttribute('target')).toBe('_blank')
      expect(screen.getByRole('menuitem', { name: /sign out/i })).toBeTruthy()
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

describe('HeaderAccount sign-in link', () => {
  it('runs the registered stashes before leaving for sign-in', async () => {
    const assign = vi.fn()
    vi.spyOn(window.location, 'assign').mockImplementation(assign)
    const stash = vi.fn()
    const stop = onBeforeSignInLeave(stash)
    onTestFinished(stop)
    render(HeaderAccount)

    await userEvent
      .setup()
      .click(screen.getByRole('link', { name: /sign in/i }))

    expect(stash.mock.invocationCallOrder[0]).toBeLessThan(
      assign.mock.invocationCallOrder[0]
    )
  })

  it('sends the visitor to sign in with the current page as the return destination', async () => {
    const assign = vi.fn()
    vi.spyOn(window.location, 'assign').mockImplementation(assign)
    window.history.replaceState({}, '', '/workshop/models/example/?tab=api')
    render(HeaderAccount)

    await userEvent
      .setup()
      .click(screen.getByRole('link', { name: /sign in/i }))

    expect(assign).toHaveBeenCalledWith(
      '/login/?returnTo=%2Fworkshop%2Fmodels%2Fexample%2F%3Ftab%3Dapi'
    )
  })

  it('leaves a modified click to the browser with the return destination already on the link', async () => {
    const assign = vi.fn()
    vi.spyOn(window.location, 'assign').mockImplementation(assign)
    window.history.replaceState({}, '', '/workshop/models/example/?tab=api')
    render(HeaderAccount)

    const link = screen.getByRole('link', { name: /sign in/i })
    expect(
      link.getAttribute('href'),
      'the first render must match the server output'
    ).toBe('/login/')

    await fireEvent(link, new Event('pointerdown', { bubbles: true }))
    link.dispatchEvent(
      new MouseEvent('click', {
        bubbles: true,
        cancelable: true,
        metaKey: true
      })
    )

    expect(assign).not.toHaveBeenCalled()
    expect(
      link.getAttribute('href'),
      'open-in-new-tab must land on the model page after sign-in, not the Workshop home'
    ).toBe('/login/?returnTo=%2Fworkshop%2Fmodels%2Fexample%2F%3Ftab%3Dapi')
  })

  it('prepares the destination on focus, so a keyboard open-in-new-tab keeps it too', async () => {
    window.history.replaceState({}, '', '/workshop/models/example/')
    render(HeaderAccount)
    const link = screen.getByRole('link', { name: /sign in/i })

    await fireEvent.focus(link)

    expect(link.getAttribute('href')).toBe(
      '/login/?returnTo=%2Fworkshop%2Fmodels%2Fexample%2F'
    )
  })
})
