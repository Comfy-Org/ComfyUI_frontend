// @vitest-environment happy-dom
import { render, screen, waitFor } from '@testing-library/vue'
import userEvent from '@testing-library/user-event'
import { beforeEach, describe, expect, it, vi } from 'vitest'

import AuthSignIn from './AuthSignIn.vue'

const handles = vi.hoisted(() => ({
  flag: undefined as { value: boolean } | undefined,
  onUserChanged: vi.fn(),
  signOut: vi.fn(),
  google: vi.fn(),
  github: vi.fn(),
  isProvisioningError: vi.fn(),
  emitUser: undefined as ((user: unknown) => void) | undefined,
  chunkFails: false,
  captureAuthFailed: vi.fn(),
  captureSignupOpened: vi.fn(),
  embedded: false
}))

vi.mock('../../scripts/posthog', async () => {
  const { ref } = await import('vue')
  const flag = ref(true)
  handles.flag = flag
  return {
    useWorkshopAuthFlag: () => flag,
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
    onWorkshopUserChanged: (cb: (user: unknown) => void) => {
      handles.emitUser = cb
      handles.onUserChanged()
      return () => {}
    }
  }
})

beforeEach(() => {
  handles.flag!.value = true
  handles.onUserChanged.mockClear()
  handles.signOut.mockReset().mockResolvedValue(undefined)
  handles.google.mockReset()
  handles.github.mockReset()
  handles.isProvisioningError.mockReset().mockReturnValue(false)
  handles.emitUser = undefined
  handles.captureAuthFailed.mockClear()
  handles.captureSignupOpened.mockClear()
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
