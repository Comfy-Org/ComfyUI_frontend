// @vitest-environment happy-dom
import { render, screen, waitFor } from '@testing-library/vue'
import userEvent from '@testing-library/user-event'
import { beforeEach, describe, expect, it, vi } from 'vitest'

import { AUTH_ERROR_MESSAGES } from '@comfyorg/account/firebaseAuthError'

import { removeAllToasts, useAuthToasts } from '../../config/auth-toast-state'
import AuthSignIn from './AuthSignIn.vue'
import AuthToast from './AuthToast.vue'

const handles = vi.hoisted(() => ({
  flag: undefined as { value: boolean } | undefined,
  settled: undefined as { value: boolean } | undefined,
  user: undefined as { value: unknown } | undefined,
  session: undefined as { value: unknown } | undefined,
  chunkFails: false,
  ensureFresh: vi.fn(),
  google: vi.fn(),
  github: vi.fn(),
  isProvisioningError: vi.fn(),
  isNewUser: vi.fn(),
  captureAuthCompleted: vi.fn(),
  captureAuthFailed: vi.fn(),
  captureSignupOpened: vi.fn(),
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
    isWorkshopProvisioningError: handles.isProvisioningError,
    isNewWorkshopUser: handles.isNewUser
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
      ensureFresh: handles.ensureFresh
    })
  }
})

const { messages: toasts } = useAuthToasts()
const replace = vi.fn<(url: string | URL) => void>()

beforeEach(() => {
  handles.flag!.value = true
  handles.settled!.value = true
  handles.user!.value = null
  handles.session!.value = undefined
  handles.chunkFails = false
  handles.ensureFresh.mockReset().mockResolvedValue({
    status: 'ok',
    session: { token: 'workspace-jwt' }
  })
  handles.google.mockReset()
  handles.github.mockReset()
  handles.isProvisioningError.mockReset().mockReturnValue(false)
  handles.isNewUser.mockReset().mockReturnValue(false)
  handles.captureAuthCompleted.mockClear()
  handles.captureAuthFailed.mockClear()
  handles.captureSignupOpened.mockClear()
  handles.embedded = false
  removeAllToasts()
  window.history.replaceState({}, '', '/')
  replace.mockReset()
  vi.spyOn(window.location, 'replace').mockImplementation(replace)
})

const clickGoogle = () =>
  userEvent
    .setup()
    .click(screen.getByRole('button', { name: /continue with google/i }))

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

  it('leaves for the homepage once a fresh sign-in has a session', async () => {
    handles.google.mockResolvedValue({
      user: { uid: 'user-1', email: 'user@example.com', displayName: null }
    })
    render(AuthSignIn)

    await clickGoogle()

    await waitFor(() => expect(replace).toHaveBeenCalledWith('/'))
    expect(handles.ensureFresh).toHaveBeenCalledWith(
      expect.objectContaining({ uid: 'user-1' })
    )
  })

  it('returns to the requested page instead of the homepage', async () => {
    window.history.replaceState(
      {},
      '',
      '/login/?returnTo=%2Fworkshop%2Fmodels%2Fexample%2F'
    )
    handles.google.mockResolvedValue({
      user: { uid: 'user-1', email: 'user@example.com', displayName: null }
    })
    render(AuthSignIn)

    await clickGoogle()

    await waitFor(() =>
      expect(replace).toHaveBeenCalledWith('/workshop/models/example/')
    )
  })

  it('sends an already-signed-in visitor away without showing a panel, and without the readonly proxy', async () => {
    render(AuthSignIn)

    handles.user!.value = {
      uid: 'user-1',
      email: 'a@b.co',
      displayName: null
    }

    await waitFor(() => expect(replace).toHaveBeenCalledWith('/'))
    expect(
      handles.ensureFresh,
      'the session client already holds the raw current user; a readonly proxy would drop Firebase token writes'
    ).toHaveBeenCalledWith()
    expect(
      screen.queryByText(/a@b\.co/),
      'the cloud app never shows a signed-in state on its login page'
    ).toBeNull()
  })

  it('keeps a signed-in visitor on the page when they asked to switch accounts', async () => {
    window.history.replaceState({}, '', '/login/?switchAccount=1')
    render(AuthSignIn)

    handles.user!.value = {
      uid: 'user-1',
      email: 'a@b.co',
      displayName: null
    }

    expect(
      await screen.findByRole('button', { name: /continue with google/i })
    ).toBeTruthy()
    await new Promise((resolve) => setTimeout(resolve, 0))
    expect(
      replace,
      'the cloud guard skips the redirect on switchAccount'
    ).not.toHaveBeenCalled()
    expect(handles.ensureFresh).not.toHaveBeenCalled()
  })

  it('raises a warning toast when the visitor dismisses the pop-up', async () => {
    handles.github.mockRejectedValue({
      code: 'auth/popup-closed-by-user',
      message: 'x'
    })
    render(AuthSignIn)
    render(AuthToast)

    await userEvent
      .setup()
      .click(screen.getByRole('button', { name: /continue with github/i }))

    const alert = await screen.findByRole('alert')
    expect(alert.getAttribute('data-severity')).toBe('warn')
    expect(alert.textContent).toContain('Warning')
    expect(alert.textContent).toContain(
      AUTH_ERROR_MESSAGES['auth/popup-closed-by-user']
    )
    expect(toasts.value).toHaveLength(1)
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
    await clickGoogle()

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
      user: { uid: 'user-1', email: 'user@example.com', displayName: null }
    })
    handles.isNewUser.mockReturnValue(true)
    render(AuthSignIn)

    await clickGoogle()

    await waitFor(() =>
      expect(handles.captureAuthCompleted).toHaveBeenCalledWith({
        method: 'google',
        is_new_user: true,
        user_id: 'user-1',
        email: 'user@example.com'
      })
    )
  })

  it('reports a sign-up page completion as a new user regardless of the provider answer', async () => {
    handles.github.mockResolvedValue({
      user: { uid: 'user-2', email: null, displayName: 'Octo' }
    })
    render(AuthSignIn, { props: { mode: 'signUp' } })

    await userEvent
      .setup()
      .click(screen.getByRole('button', { name: /continue with github/i }))

    await waitFor(() =>
      expect(handles.captureAuthCompleted).toHaveBeenCalledWith({
        method: 'github',
        is_new_user: true,
        user_id: 'user-2',
        email: undefined
      })
    )
  })

  it('does not report a completion when provisioning fails after the popup', async () => {
    const failure = {
      user: { uid: 'user-1', email: 'a@b.co', displayName: null }
    }
    handles.isProvisioningError.mockImplementation((error) => error === failure)
    handles.google.mockRejectedValue(failure)
    render(AuthSignIn)

    await clickGoogle()

    await screen.findByRole('alert')
    expect(handles.captureAuthCompleted).not.toHaveBeenCalled()
  })

  it('toasts the signup-blocked copy when the popup reports the blocked token', async () => {
    handles.google.mockRejectedValue({
      code: 'auth/internal-error',
      message: 'Firebase: SIGNUP_BLOCKED (auth/internal-error).'
    })
    render(AuthSignIn, { props: { mode: 'signUp' } })
    render(AuthToast)

    await clickGoogle()

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
    await screen.findByRole('button', { name: /continue with google/i })

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
    await screen.findByRole('button', { name: /continue with google/i })

    expect(screen.queryByTestId('google-sso-in-app-browser-notice')).toBeNull()
  })

  it.for([
    [
      'auth/network-request-failed',
      AUTH_ERROR_MESSAGES['auth/network-request-failed']
    ],
    ['auth/some-new-code', AUTH_ERROR_MESSAGES.generic]
  ])('raises one sticky error toast for %s', async ([code, copy]) => {
    handles.google.mockRejectedValue({ code, message: 'x' })
    render(AuthSignIn)
    render(AuthToast)

    await clickGoogle()

    const alert = await screen.findByRole('alert')
    expect(alert.getAttribute('data-severity')).toBe('error')
    expect(alert.textContent).toContain('Error')
    expect(alert.textContent).toContain(copy)
    expect(toasts.value).toHaveLength(1)
    expect(toasts.value[0].life, 'errors stay until dismissed').toBeUndefined()
    expect(replace).not.toHaveBeenCalled()
  })

  it('names this host in the unauthorized-domain toast', async () => {
    handles.google.mockRejectedValue({
      code: 'auth/unauthorized-domain',
      message: 'x'
    })
    render(AuthSignIn)
    render(AuthToast)

    await clickGoogle()

    expect((await screen.findByRole('alert')).textContent).toContain(
      `Your domain ${window.location.hostname} is not authorized`
    )
  })

  it('stays on the page with an inline message when provisioning fails', async () => {
    const failure = {
      user: { email: 'user@example.com', displayName: null }
    }
    handles.isProvisioningError.mockImplementation((error) => error === failure)
    handles.google.mockRejectedValue(failure)
    render(AuthSignIn)

    await clickGoogle()

    expect((await screen.findByRole('alert')).textContent).toContain(
      'account setup did not finish'
    )
    expect(replace).not.toHaveBeenCalled()
    expect(toasts.value).toHaveLength(0)
  })

  it('offers a retry inline when session minting fails, then leaves once it succeeds', async () => {
    handles.google.mockResolvedValue({
      user: { uid: 'user-1', email: 'user@example.com', displayName: null }
    })
    handles.ensureFresh.mockResolvedValueOnce({
      status: 'error',
      reason: 'network'
    })
    render(AuthSignIn)

    await clickGoogle()

    const retry = await screen.findByRole('button', { name: 'Retry session' })
    expect(screen.getByRole('alert').textContent).toContain(
      'workspace session could not be started'
    )
    expect(replace).not.toHaveBeenCalled()

    await userEvent.setup().click(retry)

    await waitFor(() => expect(replace).toHaveBeenCalledWith('/'))
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

    await clickGoogle()
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
    const { useAuthToasts: useFreshToasts } =
      await import('../../config/auth-toast-state')
    const fresh = useFreshToasts().messages
    handles.flag!.value = true
    try {
      render(FreshAuthSignIn)
      const button = screen.getByRole('button', {
        name: /continue with google/i
      }) as HTMLButtonElement
      await userEvent.setup().click(button)

      await waitFor(() => expect(fresh.value).toHaveLength(1))
      expect(fresh.value[0].detail).toBe(AUTH_ERROR_MESSAGES.generic)
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
