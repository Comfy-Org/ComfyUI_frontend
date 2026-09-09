// @vitest-environment happy-dom
import { render, screen, waitFor } from '@testing-library/vue'
import userEvent from '@testing-library/user-event'
import { beforeEach, describe, expect, it, vi } from 'vitest'

import AuthSignIn from './AuthSignIn.vue'

const handles = vi.hoisted(() => ({
  flag: undefined as { value: boolean } | undefined,
  user: undefined as { value: unknown } | undefined,
  session: undefined as { value: unknown } | undefined,
  chunkFails: false,
  ensureFresh: vi.fn(),
  signOut: vi.fn(),
  google: vi.fn(),
  github: vi.fn(),
  isProvisioningError: vi.fn()
}))

vi.mock('../../scripts/posthog', async () => {
  const { ref } = await import('vue')
  const flag = ref(true)
  handles.flag = flag
  return { useWorkshopAuthFlag: () => flag }
})

vi.mock('../../config/workshop-firebase', () => {
  if (handles.chunkFails) {
    throw new TypeError('Failed to fetch dynamically imported module')
  }
  return {
    signInWorkshopWithGoogle: handles.google,
    signInWorkshopWithGitHub: handles.github,
    signOutWorkshop: handles.signOut,
    isWorkshopProvisioningError: handles.isProvisioningError
  }
})

vi.mock('../../config/workshop-session-state', async () => {
  const { ref } = await import('vue')
  const user = ref(null)
  const session = ref(undefined)
  handles.user = user
  handles.session = session
  return {
    useWorkshopSession: () => ({
      user,
      session,
      ensureFresh: handles.ensureFresh,
      signOut: handles.signOut
    })
  }
})

beforeEach(() => {
  handles.flag!.value = true
  handles.user!.value = null
  handles.session!.value = undefined
  handles.chunkFails = false
  handles.ensureFresh.mockReset().mockResolvedValue({
    status: 'ok',
    session: { token: 'workspace-jwt' }
  })
  handles.signOut.mockReset().mockResolvedValue(undefined)
  handles.google.mockReset()
  handles.github.mockReset()
  handles.isProvisioningError.mockReset().mockReturnValue(false)
  window.history.replaceState({}, '', '/')
})

describe('AuthSignIn', () => {
  it('does not render sign-in controls when the auth flag is off', () => {
    handles.flag!.value = false
    render(AuthSignIn)

    expect(screen.queryByRole('button')).toBeNull()
  })

  it('renders sign-in controls when the flag turns on after mount', async () => {
    handles.flag!.value = false
    render(AuthSignIn)

    handles.flag!.value = true

    expect(
      await screen.findByRole('button', { name: /continue with google/i })
    ).toBeTruthy()
  })

  it('keeps a signed-in user on the signed-in screen when sign-out fails', async () => {
    handles.signOut.mockRejectedValue(new Error('network'))
    render(AuthSignIn)
    handles.user!.value = {
      uid: 'user-1',
      email: 'a@b.co',
      displayName: null
    }

    await screen.findByText(/a@b\.co/)
    await userEvent
      .setup()
      .click(screen.getByRole('button', { name: 'Sign out' }))

    await waitFor(() => expect(handles.signOut).toHaveBeenCalled())
    expect(
      screen.getByText(/a@b\.co/),
      'a failed sign-out keeps the user on the signed-in screen'
    ).toBeTruthy()
    expect(screen.queryByRole('alert')).toBeNull()
  })

  it('signs in through the Google button and shows the signed-in identity', async () => {
    handles.google.mockResolvedValue({
      user: { uid: 'user-1', email: 'user@example.com', displayName: null }
    })
    render(AuthSignIn)

    await userEvent
      .setup()
      .click(screen.getByRole('button', { name: /continue with google/i }))

    await waitFor(() => expect(handles.google).toHaveBeenCalledOnce())
    expect(handles.ensureFresh).toHaveBeenCalledWith(
      expect.objectContaining({ uid: 'user-1' })
    )
    expect(await screen.findByText(/user@example\.com/)).toBeTruthy()
  })

  it('surfaces an error when the GitHub sign-in fails', async () => {
    handles.github.mockRejectedValue({
      code: 'auth/popup-closed-by-user',
      message: 'x'
    })
    render(AuthSignIn)

    await userEvent
      .setup()
      .click(screen.getByRole('button', { name: /continue with github/i }))

    expect(await screen.findByRole('alert')).toBeTruthy()
  })

  it('keeps the signed-in identity visible when provisioning fails', async () => {
    const failure = {
      user: { email: 'user@example.com', displayName: null }
    }
    handles.isProvisioningError.mockImplementation((error) => error === failure)
    handles.google.mockRejectedValue(failure)
    render(AuthSignIn)

    await userEvent
      .setup()
      .click(screen.getByRole('button', { name: /continue with google/i }))

    expect(await screen.findByText(/user@example\.com/)).toBeTruthy()
    expect(screen.getByRole('alert').textContent).toContain(
      'account setup did not finish'
    )
  })

  it('keeps sign-out reachable and offers retry when session minting fails', async () => {
    handles.google.mockResolvedValue({
      user: { uid: 'user-1', email: 'user@example.com', displayName: null }
    })
    handles.ensureFresh.mockResolvedValueOnce({
      status: 'error',
      reason: 'network'
    })
    render(AuthSignIn)

    await userEvent
      .setup()
      .click(screen.getByRole('button', { name: /continue with google/i }))

    expect(await screen.findByText(/user@example\.com/)).toBeTruthy()
    expect(screen.getByRole('button', { name: 'Retry session' })).toBeTruthy()
    expect(screen.getByRole('button', { name: 'Sign out' })).toBeTruthy()
  })

  it('mints a restored visitor without handing over the readonly user proxy', async () => {
    render(AuthSignIn)
    handles.user!.value = {
      uid: 'user-1',
      email: 'a@b.co',
      displayName: null
    }

    await waitFor(() => expect(handles.ensureFresh).toHaveBeenCalledOnce())
    expect(
      handles.ensureFresh,
      'the session client already holds the raw current user; a readonly proxy would drop Firebase token writes'
    ).toHaveBeenCalledWith()
  })

  it('clears the session-failure banner once a later refresh recovers', async () => {
    handles.google.mockResolvedValue({
      user: { uid: 'user-1', email: 'user@example.com', displayName: null }
    })
    handles.ensureFresh.mockResolvedValueOnce({
      status: 'error',
      reason: 'network'
    })
    render(AuthSignIn)

    await userEvent
      .setup()
      .click(screen.getByRole('button', { name: /continue with google/i }))
    await screen.findByRole('button', { name: 'Retry session' })

    handles.session!.value = { token: 'workspace-jwt' }

    await waitFor(() =>
      expect(screen.queryByRole('button', { name: 'Retry session' })).toBeNull()
    )
    expect(screen.queryByRole('alert')).toBeNull()
  })

  it('leaves the buttons usable when the Firebase chunk fails to load on a click', async () => {
    const staticFlag = handles.flag
    handles.chunkFails = true
    vi.resetModules()
    const { default: FreshAuthSignIn } = await import('./AuthSignIn.vue')
    handles.flag!.value = true
    try {
      render(FreshAuthSignIn)
      const button = screen.getByRole('button', {
        name: /continue with google/i
      }) as HTMLButtonElement
      await userEvent.setup().click(button)

      await waitFor(() =>
        expect(screen.getByRole('alert').textContent).toMatch(
          /something went wrong/i
        )
      )
      expect(
        button.disabled,
        'a failed chunk load must not strand the page in pending'
      ).toBe(false)
    } finally {
      handles.chunkFails = false
      vi.resetModules()
      handles.flag = staticFlag
    }
  })
})
