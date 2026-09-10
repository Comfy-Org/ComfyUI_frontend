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
  identitySettled: undefined as { value: boolean } | undefined,
  chunkFails: false,
  ensureFresh: vi.fn(),
  google: vi.fn(),
  github: vi.fn(),
  emailSignIn: vi.fn(),
  emailSignUp: vi.fn(),
  provision: vi.fn(),
  turnstileReset: vi.fn(),
  isProvisioningError: vi.fn(),
  isNewUser: vi.fn(),
  captureAuthCompleted: vi.fn(),
  captureAuthFailed: vi.fn(),
  captureSignupOpened: vi.fn(),
  embedded: false
}))

vi.mock<unknown>(import('../../scripts/posthog'), async () => {
  const { ref } = await import('vue')
  const flag = ref(true)
  const settled = ref(true)
  handles.flag = flag
  handles.settled = settled
  return {
    useWorkshopAuthFlag: () => flag,
    useWorkshopAuthFlagSettled: () => settled,
    useWorkshopTurnstileMode: () => ref('shadow'),
    captureAuthCompleted: handles.captureAuthCompleted,
    captureAuthFailed: handles.captureAuthFailed,
    captureSignupOpened: handles.captureSignupOpened
  }
})

vi.mock<unknown>(import('@comfyorg/account/vue'), async (importOriginal) => {
  const { defineComponent, h, onMounted } = await import('vue')
  return {
    ...(await (importOriginal as () => Promise<object>)()),
    TurnstileWidget: defineComponent({
      emits: ['update:token', 'update:unavailable'],
      setup(_, { emit, expose }) {
        expose({ reset: handles.turnstileReset })
        onMounted(() => emit('update:token', 'cf-token'))
        return () => h('div', { 'data-testid': 'turnstile' })
      }
    })
  }
})

vi.mock<unknown>(import('@comfyorg/account/webviewDetection'), () => ({
  isEmbeddedWebView: () => handles.embedded
}))

const inChina = vi.hoisted(() => ({
  value: false,
  pending: undefined as Promise<boolean> | undefined,
  defer() {
    let settle!: (inChina: boolean) => void
    this.pending = new Promise<boolean>((resolve) => {
      settle = resolve
    })
    return settle
  },
  hang() {
    this.pending = new Promise<boolean>(() => {})
  },
  reject(error: Error) {
    this.pending = Promise.reject(error)
  }
}))
const isInChina = vi.hoisted(() => vi.fn())
vi.mock<unknown>(import('@comfyorg/shared-frontend-utils/networkUtil'), () => ({
  isInChina
}))

vi.mock<unknown>(import('../../config/workshop-firebase'), () => {
  if (handles.chunkFails) {
    throw new TypeError('Failed to fetch dynamically imported module')
  }
  return {
    signInWorkshopWithGoogle: handles.google,
    signInWorkshopWithGitHub: handles.github,
    signInWorkshopWithEmail: handles.emailSignIn,
    signUpWorkshopWithEmail: handles.emailSignUp,
    provisionWorkshopCustomer: handles.provision,
    isWorkshopProvisioningError: handles.isProvisioningError,
    isNewWorkshopUser: handles.isNewUser
  }
})

vi.mock<unknown>(import('../../config/workshop-session-state'), async () => {
  const { ref } = await import('vue')
  const user = ref(null)
  const session = ref(undefined)
  const settled = ref(true)
  handles.user = user
  handles.session = session
  handles.identitySettled = settled
  return {
    useWorkshopSession: () => ({
      user,
      session,
      settled,
      ensureFresh: handles.ensureFresh
    })
  }
})

const { messages: toasts } = useAuthToasts()
const replace = vi.fn<(url: string | URL) => void>()
const assign = vi.fn<(url: string | URL) => void>()

beforeEach(() => {
  handles.flag!.value = true
  handles.settled!.value = true
  handles.user!.value = null
  handles.session!.value = undefined
  handles.identitySettled!.value = true
  handles.chunkFails = false
  handles.ensureFresh.mockReset().mockResolvedValue({
    status: 'ok',
    session: { token: 'workspace-jwt' }
  })
  handles.google.mockReset()
  handles.github.mockReset()
  handles.emailSignIn.mockReset()
  handles.emailSignUp.mockReset()
  handles.provision.mockReset().mockResolvedValue(undefined)
  handles.turnstileReset.mockReset()
  handles.isProvisioningError.mockReset().mockReturnValue(false)
  handles.isNewUser.mockReset().mockReturnValue(false)
  handles.captureAuthCompleted.mockClear()
  handles.captureAuthFailed.mockClear()
  handles.captureSignupOpened.mockClear()
  handles.embedded = false
  inChina.value = false
  inChina.pending = undefined
  isInChina
    .mockReset()
    .mockImplementation(() => inChina.pending ?? Promise.resolve(inChina.value))
  removeAllToasts()
  window.history.replaceState({}, '', '/')
  replace.mockReset()
  assign.mockReset()
  vi.spyOn(window.location, 'replace').mockImplementation(replace)
  vi.spyOn(window.location, 'assign').mockImplementation(assign)
})

const clickGoogle = () =>
  userEvent
    .setup()
    .click(screen.getByRole('button', { name: /log in with google/i }))

const openEmailForm = (user: ReturnType<typeof userEvent.setup>) =>
  user.click(screen.getByRole('button', { name: /use email instead/i }))

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
      await screen.findByRole('button', { name: /log in with google/i })
    ).toBeTruthy()
  })

  it('holds the mode links while an attempt is pending, so an abandoned attempt cannot sign the visitor in', async () => {
    handles.google.mockReturnValue(new Promise(() => {}))
    window.history.replaceState({}, '', '/login/')
    render(AuthSignIn)

    await clickGoogle()
    const signUpLink = await screen.findByRole('link', { name: /sign up/i })
    expect(signUpLink.getAttribute('aria-disabled')).toBe('true')

    signUpLink.dispatchEvent(
      new MouseEvent('click', { bubbles: true, cancelable: true })
    )

    expect(
      window.location.pathname,
      'switching mode remounts the panel and leaves the pending attempt free to finish'
    ).toBe('/login/')
    expect(
      screen.queryByRole('button', { name: /sign up with google/i })
    ).toBeNull()
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

  it('leaves once the session client publishes the credential, even before the mint promise settles', async () => {
    handles.google.mockResolvedValue({
      user: { uid: 'user-1', email: 'user@example.com', displayName: null }
    })
    // The real client publishes to subscribers first and resolves after.
    handles.ensureFresh.mockImplementation(async () => {
      handles.session!.value = { token: 'workspace-jwt' }
      await new Promise((resolve) => setTimeout(resolve, 0))
      return { status: 'ok', session: { token: 'workspace-jwt' } }
    })
    render(AuthSignIn)

    await clickGoogle()

    await waitFor(() => expect(replace).toHaveBeenCalledWith('/'))
    expect(replace).toHaveBeenCalledOnce()
  })

  it('sends a returning visitor away when the session arrives through the client, not the mint promise', async () => {
    handles.identitySettled!.value = false
    handles.ensureFresh.mockImplementation(async () => {
      handles.session!.value = { token: 'workspace-jwt' }
      await new Promise((resolve) => setTimeout(resolve, 0))
      return { status: 'ok', session: { token: 'workspace-jwt' } }
    })
    render(AuthSignIn)

    handles.user!.value = { uid: 'user-1', email: 'a@b.co', displayName: null }
    handles.identitySettled!.value = true

    await waitFor(() => expect(replace).toHaveBeenCalledWith('/'))
    expect(
      screen.queryByRole('button'),
      'the form must not paint on the way out'
    ).toBeNull()
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

  it('sends an already-signed-in visitor away without a panel', async () => {
    render(AuthSignIn)

    handles.user!.value = {
      uid: 'user-1',
      email: 'a@b.co',
      displayName: null
    }

    await waitFor(() => expect(replace).toHaveBeenCalledWith('/'))
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
      await screen.findByRole('button', { name: /log in with google/i })
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
      .click(screen.getByRole('button', { name: /log in with github/i }))

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
    await userEvent
      .setup()
      .click(screen.getByRole('button', { name: /sign up with google/i }))

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

  it("reports a completed social sign-in with the cloud app's metadata", async () => {
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
        user_id: 'user-1'
      })
    )
  })

  it('reports an email sign-in as an existing user and an email sign-up as a new one', async () => {
    handles.emailSignIn.mockResolvedValue({
      user: { uid: 'user-1', email: 'user@example.com', displayName: null }
    })
    render(AuthSignIn)
    const user = userEvent.setup()

    await openEmailForm(user)
    await user.type(screen.getByLabelText('Email'), 'user@example.com')
    await user.type(screen.getByLabelText('Password'), 'Password1!')
    await user.click(screen.getByRole('button', { name: /^sign in$/i }))

    await waitFor(() =>
      expect(handles.captureAuthCompleted).toHaveBeenCalledWith({
        method: 'email',
        is_new_user: false,
        user_id: 'user-1'
      })
    )
    expect(
      handles.isNewUser,
      'the cloud app hard-codes the answer for email; the provider is never asked'
    ).not.toHaveBeenCalled()
  })

  it('reports a sign-up page completion as a new user regardless of the provider answer', async () => {
    handles.github.mockResolvedValue({
      user: { uid: 'user-2', email: null, displayName: 'Octo' }
    })
    render(AuthSignIn, { props: { mode: 'signUp' } })

    await userEvent
      .setup()
      .click(screen.getByRole('button', { name: /sign up with github/i }))

    await waitFor(() =>
      expect(handles.captureAuthCompleted).toHaveBeenCalledWith({
        method: 'github',
        is_new_user: true,
        user_id: 'user-2'
      })
    )
  })

  it('does not report a completion when provisioning fails after the popup', async () => {
    const failure = {
      user: { uid: 'user-1', email: 'a@b.co', displayName: null }
    }
    handles.isProvisioningError.mockImplementation((error) => error === failure)
    handles.google.mockResolvedValue({ user: failure.user })
    handles.provision.mockRejectedValue(failure)
    render(AuthSignIn)

    await clickGoogle()

    await screen.findByRole('alert')
    expect(handles.captureAuthCompleted).not.toHaveBeenCalled()
  })

  it('skips telemetry and the session mint when the flag turns off while sign-in is pending', async () => {
    let resolvePopup: ((value: unknown) => void) | undefined
    handles.google.mockReturnValue(
      new Promise((resolve) => {
        resolvePopup = resolve
      })
    )
    render(AuthSignIn)

    await clickGoogle()
    await waitFor(() => expect(handles.google).toHaveBeenCalledOnce())

    handles.flag!.value = false
    resolvePopup!({
      user: { uid: 'uid-1', email: 'user@example.com', displayName: null }
    })
    await new Promise((resolve) => setTimeout(resolve, 0))

    expect(
      handles.captureAuthCompleted,
      'a flag disabled mid-flight must stop post-auth telemetry'
    ).not.toHaveBeenCalled()
    expect(
      handles.ensureFresh,
      'and must not mint or persist a workspace session'
    ).not.toHaveBeenCalled()
  })

  it('does not provision when the flag turns off during the popup', async () => {
    let resolvePopup: ((value: unknown) => void) | undefined
    handles.google.mockReturnValue(
      new Promise((resolve) => {
        resolvePopup = resolve
      })
    )
    render(AuthSignIn)

    await clickGoogle()
    await waitFor(() => expect(handles.google).toHaveBeenCalledOnce())

    handles.flag!.value = false
    resolvePopup!({
      user: { uid: 'uid-1', email: 'user@example.com', displayName: null }
    })
    await new Promise((resolve) => setTimeout(resolve, 0))

    expect(
      handles.provision,
      'a disable during the popup must stop provisioning before it fires'
    ).not.toHaveBeenCalled()
    expect(handles.captureAuthCompleted).not.toHaveBeenCalled()
  })

  it('abandons the attempt on an off->on flag flicker during the popup', async () => {
    let resolvePopup: ((value: unknown) => void) | undefined
    handles.google.mockReturnValue(
      new Promise((resolve) => {
        resolvePopup = resolve
      })
    )
    render(AuthSignIn)

    await clickGoogle()
    await waitFor(() => expect(handles.google).toHaveBeenCalledOnce())

    // A live boolean would pass (on at resolution); the generation must not.
    handles.flag!.value = false
    handles.flag!.value = true
    resolvePopup!({
      user: { uid: 'uid-1', email: 'user@example.com', displayName: null }
    })
    await new Promise((resolve) => setTimeout(resolve, 0))

    expect(
      handles.provision,
      'an off->on flicker must still abandon the attempt'
    ).not.toHaveBeenCalled()
    expect(handles.captureAuthCompleted).not.toHaveBeenCalled()
  })

  it('keeps an email user signed in with the inline message when provisioning fails', async () => {
    const failure = {
      user: { uid: 'user-1', email: 'user@example.com', displayName: null }
    }
    handles.isProvisioningError.mockImplementation((error) => error === failure)
    handles.emailSignIn.mockResolvedValue({ user: failure.user })
    handles.provision.mockRejectedValue(failure)
    render(AuthSignIn)
    render(AuthToast)
    const user = userEvent.setup()

    await openEmailForm(user)
    await user.type(screen.getByLabelText('Email'), 'user@example.com')
    await user.type(screen.getByLabelText('Password'), 'Password1!')
    await user.click(screen.getByRole('button', { name: /^sign in$/i }))

    expect(
      (await screen.findByRole('alert')).textContent,
      'the cloud app keeps the user signed in and says setup did not finish; the social path here already does'
    ).toContain('account setup did not finish')
    expect(toasts.value).toHaveLength(0)
    expect(replace).not.toHaveBeenCalled()
  })

  it('drops a second email submit while the first is still pending', async () => {
    handles.emailSignIn.mockImplementation(() => new Promise(() => {}))
    render(AuthSignIn)
    const user = userEvent.setup()

    await openEmailForm(user)
    await user.type(screen.getByLabelText('Email'), 'user@example.com')
    await user.type(screen.getByLabelText('Password'), 'Password1!')
    const submit = screen.getByRole('button', { name: /^sign in$/i })
    await user.click(submit)
    await user.click(submit)

    await waitFor(() => expect(handles.emailSignIn).toHaveBeenCalledOnce())
  })

  it('recovers from an abandoned attempt so a later restore still signs in', async () => {
    let resolveProvision: (() => void) | undefined
    handles.google.mockResolvedValue({
      user: { uid: 'user-1', email: 'user@example.com', displayName: null }
    })
    handles.provision.mockReturnValue(
      new Promise<void>((resolve) => {
        resolveProvision = resolve
      })
    )
    render(AuthSignIn)

    await clickGoogle()
    await waitFor(() => expect(handles.provision).toHaveBeenCalledOnce())

    handles.flag!.value = false
    resolveProvision!()
    await new Promise((resolve) => setTimeout(resolve, 0))
    expect(handles.captureAuthCompleted).not.toHaveBeenCalled()

    handles.flag!.value = true
    handles.user!.value = {
      uid: 'user-1',
      email: 'user@example.com',
      displayName: null
    }

    // A stuck attempt would swallow the restore; recovery lets it mint away.
    await waitFor(() => expect(replace).toHaveBeenCalledWith('/'))
  })

  it('reports no failure and publishes no toast when provisioning rejects after the flag turned off', async () => {
    let rejectProvision: ((reason: unknown) => void) | undefined
    const failure = {
      user: { uid: 'user-1', email: 'a@b.co', displayName: null }
    }
    handles.isProvisioningError.mockImplementation((error) => error === failure)
    handles.google.mockResolvedValue({
      user: { uid: 'user-1', email: 'a@b.co', displayName: null }
    })
    handles.provision.mockReturnValue(
      new Promise<void>((_resolve, reject) => {
        rejectProvision = reject
      })
    )
    render(AuthSignIn)
    render(AuthToast)

    await clickGoogle()
    await waitFor(() => expect(handles.provision).toHaveBeenCalledOnce())

    handles.flag!.value = false
    rejectProvision!(failure)
    await new Promise((resolve) => setTimeout(resolve, 0))

    expect(handles.captureAuthFailed).not.toHaveBeenCalled()
    expect(toasts.value).toHaveLength(0)
  })

  it('toasts the signup-blocked copy when the popup reports the blocked token', async () => {
    handles.google.mockRejectedValue({
      code: 'auth/internal-error',
      message: 'Firebase: SIGNUP_BLOCKED (auth/internal-error).'
    })
    render(AuthSignIn, { props: { mode: 'signUp' } })
    render(AuthToast)

    await userEvent
      .setup()
      .click(screen.getByRole('button', { name: /sign up with google/i }))

    expect((await screen.findByRole('alert')).textContent).toContain(
      "couldn't create your account"
    )
  })

  it('advertises the free runs on the login page, as the cloud app does', () => {
    render(AuthSignIn)

    expect(screen.getByText('to get 5 free runs.')).toBeTruthy()
  })

  it('holds the form until Firebase has settled, then shows it to a signed-out visitor', async () => {
    handles.identitySettled!.value = false
    render(AuthSignIn)

    expect(screen.getByTestId('auth-initializing')).toBeTruthy()
    expect(
      screen.queryByRole('button'),
      'painting the form before auth settles flashes it at a returning signed-in visitor'
    ).toBeNull()

    handles.identitySettled!.value = true

    expect(
      await screen.findByRole('button', { name: /log in with google/i })
    ).toBeTruthy()
    expect(screen.queryByTestId('auth-initializing')).toBeNull()
  })

  it('never paints the form for a returning signed-in visitor on the way out', async () => {
    handles.identitySettled!.value = false
    render(AuthSignIn)

    handles.user!.value = { uid: 'user-1', email: 'a@b.co', displayName: null }
    handles.identitySettled!.value = true

    await waitFor(() => expect(replace).toHaveBeenCalledWith('/'))
    expect(screen.queryByRole('button')).toBeNull()
  })

  it('shows the form with the session-failure banner when a returning visitor cannot mint', async () => {
    handles.identitySettled!.value = false
    handles.ensureFresh.mockResolvedValueOnce({
      status: 'error',
      reason: 'network'
    })
    render(AuthSignIn)

    handles.user!.value = { uid: 'user-1', email: 'a@b.co', displayName: null }
    handles.identitySettled!.value = true

    expect(
      await screen.findByRole('button', { name: 'Retry session' })
    ).toBeTruthy()
    expect(replace).not.toHaveBeenCalled()
  })

  describe('when auth never initializes', () => {
    it("shows the cloud app's timeout copy after its 16 s bound when the flag never answers", async () => {
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

    it('shows the same copy when Firebase never settles', async () => {
      handles.identitySettled!.value = false
      render(AuthSignIn)

      await vi.advanceTimersByTimeAsync(16_000)

      expect((await screen.findByRole('alert')).textContent).toContain(
        'Connection Taking Too Long'
      )
      expect(screen.queryByTestId('auth-initializing')).toBeNull()
    })

    it('shows nothing when PostHog answered that the flag is off', async () => {
      handles.flag!.value = false
      render(AuthSignIn)

      await vi.advanceTimersByTimeAsync(16_000)
      expect(screen.queryByRole('alert')).toBeNull()
    })

    it('drops the timeout screen when a late answer says the flag is off', async () => {
      handles.flag!.value = false
      handles.settled!.value = false
      render(AuthSignIn)
      await vi.advanceTimersByTimeAsync(16_000)
      await screen.findByRole('alert')

      handles.settled!.value = true

      await waitFor(() =>
        expect(
          screen.queryByText('Connection Taking Too Long'),
          'a flag that answered off renders nothing, not a troubleshooting screen'
        ).toBeNull()
      )
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
        await screen.findByRole('button', { name: /log in with google/i })
      ).toBeTruthy()
      expect(screen.queryByText('Connection Taking Too Long')).toBeNull()
    })
  })

  it('switches to sign-up in place, keeping the shell mounted', async () => {
    window.history.replaceState({}, '', '/login/?returnTo=%2Fworkshop%2F')
    render(AuthSignIn)

    await userEvent
      .setup()
      .click(screen.getByRole('link', { name: 'Sign up here' }))

    expect(
      await screen.findByRole('heading', { name: 'Create an account' })
    ).toBeTruthy()
    expect(
      assign,
      'a reload would restart the hero and the session'
    ).not.toHaveBeenCalled()
    expect(window.location.pathname + window.location.search).toBe(
      '/signup/?returnTo=%2Fworkshop%2F'
    )
    expect(document.title).toBe('Sign up - Comfy')
  })

  it('follows Back to the previous mode', async () => {
    render(AuthSignIn)
    await userEvent
      .setup()
      .click(screen.getByRole('link', { name: 'Sign up here' }))
    await screen.findByRole('heading', { name: 'Create an account' })

    window.history.replaceState({}, '', '/login/')
    window.dispatchEvent(new PopStateEvent('popstate'))

    expect(
      await screen.findByRole('heading', { name: 'Log in to your account' })
    ).toBeTruthy()
  })

  it('shows the pop-up progress line and holds every option while the pop-up is open', async () => {
    handles.google.mockImplementation(() => new Promise(() => {}))
    render(AuthSignIn)

    await clickGoogle()

    expect(
      await screen.findByText('Finish signing in from the pop-up window.')
    ).toBeTruthy()
    for (const name of [
      /log in with google/i,
      /log in with github/i,
      /use email instead/i
    ]) {
      expect(screen.getByRole('button', { name })).toHaveProperty(
        'disabled',
        true
      )
    }
  })

  it('says it is signing you in from the moment the pop-up closes until the page leaves', async () => {
    handles.google.mockResolvedValue({
      user: { uid: 'user-1', email: 'user@example.com', displayName: null }
    })
    handles.ensureFresh.mockImplementation(() => new Promise(() => {}))
    render(AuthSignIn)

    await clickGoogle()

    expect(await screen.findByText('Signing you in…')).toBeTruthy()
    expect(replace).not.toHaveBeenCalled()
  })

  it('says it is creating the account on the sign-up page', async () => {
    handles.github.mockResolvedValue({
      user: { uid: 'user-2', email: null, displayName: 'Octo' }
    })
    handles.ensureFresh.mockImplementation(() => new Promise(() => {}))
    render(AuthSignIn, { props: { mode: 'signUp' } })

    await userEvent
      .setup()
      .click(screen.getByRole('button', { name: /sign up with github/i }))

    expect(await screen.findByText('Creating your account…')).toBeTruthy()
  })

  it('does not report a sign-up open from the login page', async () => {
    render(AuthSignIn)
    await screen.findByRole('button', { name: /log in with google/i })

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
    await screen.findByRole('button', { name: /log in with google/i })

    expect(screen.queryByTestId('google-sso-in-app-browser-notice')).toBeNull()
  })

  it("raises one sticky error toast with the cloud app's own line when an email sign-in fails", async () => {
    handles.emailSignIn.mockRejectedValue({
      code: 'auth/user-not-found',
      message: 'x'
    })
    render(AuthSignIn)
    render(AuthToast)
    const user = userEvent.setup()

    await openEmailForm(user)
    await user.type(screen.getByLabelText('Email'), 'user@example.com')
    await user.type(screen.getByLabelText('Password'), 'Password1!')
    await user.click(screen.getByRole('button', { name: /^sign in$/i }))

    const alert = await screen.findByRole('alert')
    expect(alert.getAttribute('data-severity')).toBe('error')
    expect(
      alert.textContent,
      'the cloud app names the code; the website reads the same line'
    ).toContain(AUTH_ERROR_MESSAGES['auth/user-not-found'])
    expect(toasts.value[0].life).toBeUndefined()
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

  it('discards a spent Turnstile token when email signup fails', async () => {
    handles.emailSignUp.mockRejectedValue({
      code: 'auth/network-request-failed',
      message: 'x'
    })
    render(AuthSignIn, { props: { mode: 'signUp' } })
    const user = userEvent.setup()

    await openEmailForm(user)
    await user.type(screen.getByLabelText('Email'), 'user@example.com')
    await user.type(screen.getByLabelText('Password'), 'Password1!')
    await user.type(screen.getByLabelText('Confirm Password'), 'Password1!')
    await user.click(screen.getByRole('button', { name: /^sign up$/i }))

    await waitFor(() => expect(handles.emailSignUp).toHaveBeenCalledOnce())
    expect(handles.emailSignUp).toHaveBeenCalledWith(
      'user@example.com',
      'Password1!',
      'cf-token'
    )
    expect(handles.turnstileReset).toHaveBeenCalledOnce()
  })

  it('shows email-appropriate progress copy while an email sign-in is pending', async () => {
    handles.emailSignIn.mockImplementation(() => new Promise(() => {}))
    render(AuthSignIn)
    const user = userEvent.setup()

    await openEmailForm(user)
    await user.type(screen.getByLabelText('Email'), 'user@example.com')
    await user.type(screen.getByLabelText('Password'), 'Password1!')
    await user.click(screen.getByRole('button', { name: /^sign in$/i }))

    await waitFor(() => expect(handles.emailSignIn).toHaveBeenCalledOnce())
    expect(
      screen.queryByText(/pop-up window/i),
      'no pop-up exists in the email flow; the copy must not tell users to look for one'
    ).toBeNull()
    expect(screen.getByText(/signing you in/i)).toBeTruthy()
    expect(
      screen
        .getByRole('button', { name: /^sign in$/i })
        .getAttribute('aria-busy'),
      'the cloud form shows the spinner on the submit button while signing in'
    ).toBe('true')
  })

  it('carries a safe return destination into the forgot-password flow on click', async () => {
    window.history.replaceState(
      {},
      '',
      '/login/?returnTo=%2Fworkshop%2Fmodels%2Fexample%2F'
    )
    render(AuthSignIn)
    const user = userEvent.setup()

    await openEmailForm(user)
    await user.click(
      await screen.findByRole('link', { name: /forgot password/i })
    )

    expect(assign).toHaveBeenCalledWith(
      '/forgot-password/?returnTo=%2Fworkshop%2Fmodels%2Fexample%2F'
    )
  })

  it('keeps the plain href in markup so a pre-hydration click still reaches the page', async () => {
    window.history.replaceState(
      {},
      '',
      '/login/?returnTo=%2Fworkshop%2Fmodels%2Fexample%2F'
    )
    render(AuthSignIn)
    await openEmailForm(userEvent.setup())

    expect(
      screen
        .getByRole('link', { name: /forgot password/i })
        .getAttribute('href'),
      'hydration never repairs a server-rendered href, so the destination is added at click time instead'
    ).toBe('/forgot-password/')
  })

  it('shows either the social buttons or the email form, never both', async () => {
    render(AuthSignIn)
    const user = userEvent.setup()

    expect(screen.queryByLabelText('Email')).toBeNull()

    await openEmailForm(user)
    expect(screen.getByLabelText('Email')).toBeTruthy()
    expect(
      screen.queryByRole('button', { name: /log in with google/i })
    ).toBeNull()

    await user.click(
      screen.getByRole('button', {
        name: 'Sign in with Google or Github instead'
      })
    )
    expect(screen.queryByLabelText('Email')).toBeNull()
    expect(
      screen.getByRole('button', { name: /log in with google/i })
    ).toBeTruthy()
  })

  it('uses sign-up copy for the providers on the sign-up page', async () => {
    render(AuthSignIn, { props: { mode: 'signUp' } })

    expect(
      screen.getByRole('button', { name: 'Sign up with Google' })
    ).toBeTruthy()
    expect(screen.getByRole('link', { name: 'Sign in' })).toBeTruthy()

    await openEmailForm(userEvent.setup())
    expect(
      screen.getByRole('button', {
        name: 'Sign up with Google or Github instead'
      }),
      'the way back from the email form names the action the buttons perform'
    ).toBeTruthy()
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
        name: /log in with google/i
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

describe('AuthSignIn region gate', () => {
  const REGION_NOTICE = /temporarily unavailable to users located in China/

  it('replaces the sign-up form with the region notice inside China', async () => {
    inChina.value = true
    render(AuthSignIn, { props: { mode: 'signUp' } })

    await openEmailForm(userEvent.setup())

    expect((await screen.findByRole('alert')).textContent).toMatch(
      REGION_NOTICE
    )
    expect(screen.queryByLabelText('Email')).toBeNull()
  })

  it('renders the sign-up form outside China', async () => {
    render(AuthSignIn, { props: { mode: 'signUp' } })

    await openEmailForm(userEvent.setup())

    expect(await screen.findByLabelText('Email')).toBeTruthy()
    expect(screen.queryByRole('alert')).toBeNull()
  })

  it('withholds the sign-up form while region detection is still pending', async () => {
    const settle = inChina.defer()
    render(AuthSignIn, { props: { mode: 'signUp' } })

    await openEmailForm(userEvent.setup())

    expect(screen.getByTestId('region-check-pending')).toBeTruthy()
    expect(screen.queryByLabelText('Email')).toBeNull()

    settle(false)

    expect(await screen.findByLabelText('Email')).toBeTruthy()
  })

  it('releases the sign-up form when region detection fails', async () => {
    inChina.reject(new Error('probe failed'))
    render(AuthSignIn, { props: { mode: 'signUp' } })

    await openEmailForm(userEvent.setup())

    expect(await screen.findByLabelText('Email')).toBeTruthy()
  })

  it('keeps the form withheld however long detection takes', async () => {
    inChina.hang()
    render(AuthSignIn, { props: { mode: 'signUp' } })

    await openEmailForm(userEvent.setup())
    await vi.advanceTimersByTimeAsync(60_000)

    expect(
      screen.queryByLabelText('Email'),
      'a fallback deciding "not in China" on detection\'s behalf would reopen the submit race the gate exists to close'
    ).toBeNull()
    expect(screen.getByTestId('region-check-pending')).toBeTruthy()
  })

  it('never renders the sign-up form inside China, pending or settled', async () => {
    const settle = inChina.defer()
    render(AuthSignIn, { props: { mode: 'signUp' } })

    await openEmailForm(userEvent.setup())
    expect(screen.queryByLabelText('Email')).toBeNull()

    settle(true)

    expect((await screen.findByRole('alert')).textContent).toMatch(
      REGION_NOTICE
    )
    expect(screen.queryByLabelText('Email')).toBeNull()
  })

  it('does not probe the region while the flag keeps the page hidden', async () => {
    handles.flag!.value = false
    render(AuthSignIn, { props: { mode: 'signUp' } })
    await new Promise((resolve) => setTimeout(resolve, 0))

    expect(
      isInChina,
      "cloud's signup view is never mounted behind the router; a hidden page must not reach the geo edge"
    ).not.toHaveBeenCalled()

    handles.flag!.value = true
    await waitFor(() => expect(isInChina).toHaveBeenCalledOnce())
  })

  it('does not gate the login form on the region', async () => {
    inChina.hang()
    render(AuthSignIn)

    await openEmailForm(userEvent.setup())

    expect(screen.getByLabelText('Email')).toBeTruthy()
    expect(screen.queryByTestId('region-check-pending')).toBeNull()
  })
})

describe('AuthSignIn insecure context', () => {
  it('warns when the page is served without a secure context', async () => {
    const descriptor = Object.getOwnPropertyDescriptor(
      window,
      'isSecureContext'
    )
    Object.defineProperty(window, 'isSecureContext', {
      value: false,
      configurable: true
    })
    try {
      render(AuthSignIn)

      expect((await screen.findByRole('alert')).textContent).toMatch(
        /connection is insecure/i
      )
    } finally {
      if (descriptor)
        Object.defineProperty(window, 'isSecureContext', descriptor)
      else delete (window as { isSecureContext?: boolean }).isSecureContext
    }
  })
})
