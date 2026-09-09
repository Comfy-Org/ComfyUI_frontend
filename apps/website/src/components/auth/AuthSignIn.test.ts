// @vitest-environment happy-dom
import { render, screen, waitFor } from '@testing-library/vue'
import userEvent from '@testing-library/user-event'
import { beforeEach, describe, expect, it, vi } from 'vitest'

import AuthSignIn from './AuthSignIn.vue'

const handles = vi.hoisted(() => ({
  flag: undefined as { value: boolean } | undefined,
  settled: undefined as { value: boolean } | undefined,
  onUserChanged: vi.fn(),
  signOut: vi.fn(),
  google: vi.fn(),
  github: vi.fn(),
  isProvisioningError: vi.fn(),
  emitUser: undefined as ((user: unknown) => void) | undefined,
  chunkFails: false,
  captureAuthCompleted: vi.fn(),
  captureAuthFailed: vi.fn(),
  captureSignupOpened: vi.fn(),
  isNewUser: vi.fn(),
  embedded: false
}))

vi.mock('../../scripts/posthog', async () => {
  const { ref } = await import('vue')
  const flag = ref(true)
  const settled = ref(true)
  handles.flag = flag
  handles.settled = settled
  return {
    useWorkshopAuthFlag: () => flag,
    useWorkshopAuthFlagSettled: () => settled,
    captureAuthCompleted: handles.captureAuthCompleted,
    captureAuthFailed: handles.captureAuthFailed,
    captureSignupOpened: handles.captureSignupOpened
  }
})

vi.mock('@comfyorg/account/webviewDetection', () => ({
  isEmbeddedWebView: () => handles.embedded
}))

vi.mock('../../config/workshop-firebase', () => {
  if (handles.chunkFails) {
    throw new TypeError('Failed to fetch dynamically imported module')
  }
  return {
    signInWorkshopWithGoogle: handles.google,
    signInWorkshopWithGitHub: handles.github,
    signOutWorkshop: handles.signOut,
    isWorkshopProvisioningError: handles.isProvisioningError,
    isNewWorkshopUser: handles.isNewUser,
    onWorkshopUserChanged: (cb: (user: unknown) => void) => {
      handles.emitUser = cb
      handles.onUserChanged()
      return () => {}
    }
  }
})

beforeEach(() => {
  handles.flag!.value = true
  handles.settled!.value = true
  handles.onUserChanged.mockClear()
  handles.signOut.mockReset().mockResolvedValue(undefined)
  handles.google.mockReset()
  handles.github.mockReset()
  handles.isProvisioningError.mockReset().mockReturnValue(false)
  handles.emitUser = undefined
  handles.captureAuthCompleted.mockClear()
  handles.captureAuthFailed.mockClear()
  handles.captureSignupOpened.mockClear()
  handles.isNewUser.mockReset().mockReturnValue(false)
  handles.embedded = false
})

describe('AuthSignIn', () => {
  it('does not attach the Firebase listener when the auth flag is off', async () => {
    handles.flag!.value = false
    render(AuthSignIn)

    await vi.waitFor(() => expect(handles.flag!.value).toBe(false))
    await new Promise((resolve) => setTimeout(resolve, 0))
    expect(
      handles.onUserChanged,
      'a flag-off page must not load Firebase or attach its listener'
    ).not.toHaveBeenCalled()
  })

  describe('when the Firebase chunk fails to load', () => {
    async function renderWithFailingChunk() {
      const staticFlag = handles.flag
      handles.chunkFails = true
      vi.resetModules()
      const { default: FreshAuthSignIn } = await import('./AuthSignIn.vue')
      handles.flag!.value = true
      render(FreshAuthSignIn)
      return () => {
        handles.chunkFails = false
        vi.resetModules()
        handles.flag = staticFlag
      }
    }

    it('leaves the buttons usable after a click instead of stranding the page in pending', async () => {
      const restore = await renderWithFailingChunk()
      try {
        const button = screen.getByRole('button', {
          name: /continue with google/i
        }) as HTMLButtonElement
        await userEvent.setup().click(button)

        await waitFor(() =>
          expect(screen.getByRole('alert').textContent).toMatch(
            /something went wrong/i
          )
        )
        expect(button.disabled).toBe(false)
      } finally {
        restore()
      }
    })

    it('shows no failure before any click, since nothing was attempted', async () => {
      const restore = await renderWithFailingChunk()
      try {
        await new Promise((resolve) => setTimeout(resolve, 0))
        expect(screen.queryByRole('alert')).toBeNull()
        expect(
          screen.getByRole('button', { name: /continue with google/i })
        ).toBeTruthy()
      } finally {
        restore()
      }
    })
  })

  it('attaches the listener when the flag is on', async () => {
    render(AuthSignIn)
    await waitFor(() => expect(handles.onUserChanged).toHaveBeenCalledOnce())
  })

  it('attaches the listener when the flag turns on after mount', async () => {
    handles.flag!.value = false
    render(AuthSignIn)

    handles.flag!.value = true

    await waitFor(() => expect(handles.onUserChanged).toHaveBeenCalledOnce())
  })

  it('keeps a signed-in user on the signed-in screen when sign-out fails', async () => {
    handles.signOut.mockRejectedValue(new Error('network'))
    render(AuthSignIn)
    await waitFor(() => expect(handles.onUserChanged).toHaveBeenCalledOnce())
    handles.emitUser?.({ email: 'a@b.co', displayName: null })

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
      user: { email: 'user@example.com', displayName: null }
    })
    render(AuthSignIn)

    await userEvent
      .setup()
      .click(screen.getByRole('button', { name: /continue with google/i }))

    await waitFor(() => expect(handles.google).toHaveBeenCalledOnce())
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
    expect(
      handles.captureAuthFailed,
      'the failure joins the cloud funnel under the same action vocabulary'
    ).toHaveBeenCalledWith({
      error_code: 'auth/popup-closed-by-user',
      auth_action: 'github_sign_in'
    })
  })

  it('reports a sign-up page open and names sign-up actions in failures', async () => {
    handles.google.mockRejectedValue(new Error('not a firebase error'))
    render(AuthSignIn, { props: { mode: 'signUp' } })

    await waitFor(() =>
      expect(handles.captureSignupOpened).toHaveBeenCalledOnce()
    )
    await userEvent
      .setup()
      .click(screen.getByRole('button', { name: /continue with google/i }))

    await waitFor(() =>
      expect(handles.captureAuthFailed).toHaveBeenCalledWith({
        error_code: 'unknown',
        auth_action: 'google_sign_up'
      })
    )
  })

  it('reports the sign-up open only once the flag lets the page show', async () => {
    handles.flag!.value = false
    render(AuthSignIn, { props: { mode: 'signUp' } })
    await new Promise((resolve) => setTimeout(resolve, 0))

    expect(
      handles.captureSignupOpened,
      'the cloud app reports the open when its page renders, not for a blank one'
    ).not.toHaveBeenCalled()

    handles.flag!.value = true
    await waitFor(() =>
      expect(handles.captureSignupOpened).toHaveBeenCalledOnce()
    )
  })

  it("reports a completed sign-in with the cloud app's metadata", async () => {
    handles.google.mockResolvedValue({
      user: { uid: 'uid-1', email: 'user@example.com', displayName: null }
    })
    handles.isNewUser.mockReturnValue(true)
    render(AuthSignIn)

    await userEvent
      .setup()
      .click(screen.getByRole('button', { name: /continue with google/i }))

    await waitFor(() =>
      expect(handles.captureAuthCompleted).toHaveBeenCalledWith({
        method: 'google',
        is_new_user: true,
        user_id: 'uid-1',
        email: 'user@example.com'
      })
    )
  })

  it('reports a sign-up page completion as a new user regardless of the provider answer', async () => {
    handles.github.mockResolvedValue({
      user: { uid: 'uid-2', email: null, displayName: 'Octo' }
    })
    render(AuthSignIn, { props: { mode: 'signUp' } })

    await userEvent
      .setup()
      .click(screen.getByRole('button', { name: /continue with github/i }))

    await waitFor(() =>
      expect(handles.captureAuthCompleted).toHaveBeenCalledWith({
        method: 'github',
        is_new_user: true,
        user_id: 'uid-2',
        email: undefined
      })
    )
  })

  it('does not report a completion when provisioning fails after the popup', async () => {
    const failure = {
      user: { uid: 'uid-1', email: 'a@b.co', displayName: null }
    }
    handles.isProvisioningError.mockImplementation((error) => error === failure)
    handles.google.mockRejectedValue(failure)
    render(AuthSignIn)

    await userEvent
      .setup()
      .click(screen.getByRole('button', { name: /continue with google/i }))

    await screen.findByText(/a@b\.co/)
    expect(handles.captureAuthCompleted).not.toHaveBeenCalled()
  })

  it('shows the signup-blocked copy when the popup reports the blocked token', async () => {
    handles.google.mockRejectedValue({
      code: 'auth/internal-error',
      message: 'Firebase: SIGNUP_BLOCKED (auth/internal-error).'
    })
    render(AuthSignIn, { props: { mode: 'signUp' } })

    await userEvent
      .setup()
      .click(screen.getByRole('button', { name: /continue with google/i }))

    expect((await screen.findByRole('alert')).textContent).toContain(
      "couldn't create your account"
    )
  })

  describe('when the auth flag never answers', () => {
    it("shows the cloud app's timeout copy after its 16 s bound", async () => {
      handles.flag!.value = false
      handles.settled!.value = false
      render(AuthSignIn)

      await vi.advanceTimersByTimeAsync(15_999)
      expect(screen.queryByRole('alert')).toBeNull()

      await vi.advanceTimersByTimeAsync(1)
      expect((await screen.findByRole('alert')).textContent).toContain(
        'Connection Taking Too Long'
      )
      expect(
        screen.getByRole('link', { name: 'support' }).getAttribute('href')
      ).toBe('https://support.comfy.org')
    })

    it('shows nothing when PostHog answered that the flag is off', async () => {
      handles.flag!.value = false
      render(AuthSignIn)

      await vi.advanceTimersByTimeAsync(16_000)
      expect(screen.queryByRole('alert')).toBeNull()
    })

    it('gives way to the page once a late answer turns the flag on', async () => {
      handles.flag!.value = false
      handles.settled!.value = false
      render(AuthSignIn)
      await vi.advanceTimersByTimeAsync(16_000)
      await screen.findByRole('alert')

      handles.settled!.value = true
      handles.flag!.value = true

      expect(
        await screen.findByRole('button', { name: /continue with google/i })
      ).toBeTruthy()
      expect(screen.queryByText('Connection Taking Too Long')).toBeNull()
    })
  })

  it('does not report a sign-up open from the login page', async () => {
    render(AuthSignIn)
    await waitFor(() => expect(handles.onUserChanged).toHaveBeenCalledOnce())

    expect(handles.captureSignupOpened).not.toHaveBeenCalled()
  })

  it('warns about Google sign-in only inside an in-app browser', async () => {
    handles.embedded = true
    render(AuthSignIn)

    expect(
      await screen.findByTestId('google-sso-in-app-browser-notice')
    ).toBeTruthy()
  })

  it('shows no in-app browser notice in a regular browser', async () => {
    render(AuthSignIn)
    await waitFor(() => expect(handles.onUserChanged).toHaveBeenCalledOnce())

    expect(screen.queryByTestId('google-sso-in-app-browser-notice')).toBeNull()
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
})
