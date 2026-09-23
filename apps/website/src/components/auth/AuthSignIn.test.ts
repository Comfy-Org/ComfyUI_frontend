import type {
  AccountCredential,
  SessionResult
} from '@comfyorg/account-core/session'
import type {
  TurnstileApi,
  TurnstileRenderOptions
} from '@comfyorg/account-core/turnstileScript'
import userEvent from '@testing-library/user-event'
import { render, screen, waitFor } from '@testing-library/vue'
import type { User, UserCredential } from 'firebase/auth'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { computed, readonly, ref } from 'vue'

import {
  testCredential,
  testFirebaseUser
} from '../../config/__fixtures__/workshopSessionFakes'
import { removeAllToasts, useAuthToasts } from '../../config/auth-toast-state'
import {
  isNewWorkshopUser,
  isWorkshopProvisioningError,
  provisionWorkshopCustomer,
  signInWorkshopWithEmail,
  signInWorkshopWithGitHub,
  signInWorkshopWithGoogle,
  signOutWorkshop,
  signUpWorkshopWithEmail
} from '../../config/workshop-firebase'
import { useWorkshopSession } from '../../config/workshop-session-state'
import { t } from '../../i18n/translations'
import {
  captureAuthCompleted,
  captureAuthFailed,
  captureSignupOpened,
  useWorkshopAuthFlag,
  useWorkshopTurnstileMode
} from '../../scripts/posthog'
import AuthSignIn from './AuthSignIn.vue'
import AuthToast from './AuthToast.vue'

const handles = vi.hoisted(() => ({
  turnstileReset: vi.fn(),
  embedded: false
}))

vi.mock(import('../../scripts/posthog'))
vi.mock(import('../../config/workshop-firebase'))
vi.mock(import('../../config/workshop-session-state'))

const authFlag = ref(true)
const authUser = ref<User | null>(null)
const session = ref<ReturnType<typeof useWorkshopSession>['session']['value']>()
const settled = ref(true)

const accountCredential: AccountCredential = {
  token: 'workspace-jwt',
  expiresAt: Date.now() + 60_000,
  uid: 'user-1',
  workspace: { id: 'workspace-1', name: 'Personal', type: 'personal' },
  role: 'owner',
  permissions: []
}
const okSession: SessionResult = { status: 'ok', session: accountCredential }

const turnstileApi = vi.hoisted(
  () =>
    ({
      render: vi.fn(),
      reset: handles.turnstileReset,
      remove: vi.fn()
    }) satisfies TurnstileApi
)

vi.mock(import('@comfyorg/account-core/turnstileScript'), () => ({
  loadTurnstile: () => Promise.resolve(turnstileApi)
}))

vi.mock(import('@comfyorg/account-core/webviewDetection'), () => ({
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
vi.mock(import('@comfyorg/account-ui/auth/regionProbe'), () => ({
  isInChina
}))

const { messages: toasts } = useAuthToasts()
const replace = vi.fn<(url: string | URL) => void>()
const assign = vi.fn<(url: string | URL) => void>()

beforeEach(() => {
  vi.mocked(useWorkshopAuthFlag).mockReturnValue(readonly(authFlag))
  vi.mocked(useWorkshopTurnstileMode).mockReturnValue(readonly(ref('shadow')))
  const state = useWorkshopSession()
  state.user = computed(() => authUser.value)
  state.session = computed(() => session.value)
  state.settled = computed(() => settled.value)
  authFlag.value = true
  authUser.value = null
  session.value = undefined
  settled.value = true
  vi.mocked(useWorkshopSession().ensureFresh).mockResolvedValue(okSession)
  handles.turnstileReset.mockReset()
  turnstileApi.render.mockImplementation(
    (_container: string | HTMLElement, options: TurnstileRenderOptions) => {
      options.callback?.('cf-token')
      return 'widget-id'
    }
  )
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
    .click(screen.getByRole('button', { name: /^sign in with google$/i }))

const openEmailForm = (user: ReturnType<typeof userEvent.setup>) =>
  user.click(screen.getByRole('button', { name: /use email instead/i }))

describe('AuthSignIn', () => {
  it('does not render sign-in controls when the auth flag is off', () => {
    authFlag.value = false
    render(AuthSignIn)

    expect(screen.queryByRole('button')).toBeNull()
  })

  it('renders sign-in controls when the flag turns on after mount', async () => {
    authFlag.value = false
    render(AuthSignIn)

    authFlag.value = true

    expect(
      await screen.findByRole('button', { name: /^sign in with google$/i })
    ).toBeTruthy()
  })

  it('holds the mode links while an attempt is pending, so an abandoned attempt cannot sign the visitor in', async () => {
    vi.mocked(signInWorkshopWithGoogle).mockReturnValue(new Promise(() => {}))
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
    vi.mocked(signInWorkshopWithGoogle).mockResolvedValue(
      testCredential(
        testFirebaseUser({
          uid: 'user-1',
          email: 'user@example.com',
          displayName: null
        })
      )
    )
    render(AuthSignIn)

    await clickGoogle()

    await waitFor(() => expect(replace).toHaveBeenCalledWith('/'))
    expect(vi.mocked(useWorkshopSession().ensureFresh)).toHaveBeenCalledWith(
      expect.objectContaining({ uid: 'user-1' })
    )
  })

  it('leaves once the session client publishes the credential, even before the mint promise settles', async () => {
    vi.mocked(signInWorkshopWithGoogle).mockResolvedValue(
      testCredential(
        testFirebaseUser({
          uid: 'user-1',
          email: 'user@example.com',
          displayName: null
        })
      )
    )
    // The real client publishes to subscribers first and resolves after.
    vi.mocked(useWorkshopSession().ensureFresh).mockImplementation(async () => {
      session.value = accountCredential
      await new Promise((resolve) => setTimeout(resolve, 0))
      return { status: 'ok', session: accountCredential }
    })
    render(AuthSignIn)

    await clickGoogle()

    await waitFor(() => expect(replace).toHaveBeenCalledWith('/'))
    expect(replace).toHaveBeenCalledOnce()
  })

  it('sends a returning visitor away when the session arrives through the client, not the mint promise', async () => {
    settled.value = false
    vi.mocked(useWorkshopSession().ensureFresh).mockImplementation(async () => {
      session.value = accountCredential
      await new Promise((resolve) => setTimeout(resolve, 0))
      return { status: 'ok', session: accountCredential }
    })
    render(AuthSignIn)

    authUser.value = testFirebaseUser({
      uid: 'user-1',
      email: 'a@b.co',
      displayName: null
    })
    settled.value = true

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
    vi.mocked(signInWorkshopWithGoogle).mockResolvedValue(
      testCredential(
        testFirebaseUser({
          uid: 'user-1',
          email: 'user@example.com',
          displayName: null
        })
      )
    )
    render(AuthSignIn)

    await clickGoogle()

    await waitFor(() =>
      expect(replace).toHaveBeenCalledWith('/workshop/models/example/')
    )
  })

  it('sends an already-signed-in visitor away without a panel', async () => {
    render(AuthSignIn)

    authUser.value = testFirebaseUser({
      uid: 'user-1',
      email: 'a@b.co',
      displayName: null
    })

    await waitFor(() => expect(replace).toHaveBeenCalledWith('/'))
    expect(
      screen.queryByText(/a@b\.co/),
      'the cloud app never shows a signed-in state on its login page'
    ).toBeNull()
  })

  it('keeps a signed-in visitor on the page when they asked to switch accounts', async () => {
    window.history.replaceState({}, '', '/login/?switchAccount=1')
    render(AuthSignIn)

    authUser.value = testFirebaseUser({
      uid: 'user-1',
      email: 'a@b.co',
      displayName: null
    })

    expect(
      await screen.findByRole('button', { name: /^sign in with google$/i })
    ).toBeTruthy()
    await new Promise((resolve) => setTimeout(resolve, 0))
    expect(
      replace,
      'the cloud guard skips the redirect on switchAccount'
    ).not.toHaveBeenCalled()
    expect(vi.mocked(useWorkshopSession().ensureFresh)).not.toHaveBeenCalled()
  })

  it('raises a warning toast when the visitor dismisses the pop-up', async () => {
    vi.mocked(signInWorkshopWithGitHub).mockRejectedValue({
      code: 'auth/popup-closed-by-user',
      message: 'x'
    })
    render(AuthSignIn)
    render(AuthToast)

    await userEvent
      .setup()
      .click(screen.getByRole('button', { name: /^sign in with github$/i }))

    const alert = await screen.findByRole('alert')
    expect(alert.getAttribute('data-severity')).toBe('warn')
    expect(alert.textContent).toContain('Warning')
    expect(alert.textContent).toContain(
      t('auth.errors.auth/popup-closed-by-user', 'en')
    )
    expect(toasts.value).toHaveLength(1)
    expect(
      captureAuthFailed,
      'the failure joins the cloud funnel under the same action vocabulary'
    ).toHaveBeenCalledWith({
      error_code: 'auth/popup-closed-by-user',
      auth_action: 'github_sign_in'
    })
  })

  it('reports a sign-up page open and names sign-up actions in failures', async () => {
    vi.mocked(signInWorkshopWithGoogle).mockRejectedValue(
      new Error('not a firebase error')
    )
    render(AuthSignIn, { props: { mode: 'signUp' } })

    await waitFor(() => expect(captureSignupOpened).toHaveBeenCalledOnce())
    await userEvent
      .setup()
      .click(screen.getByRole('button', { name: /sign up with google/i }))

    await waitFor(() =>
      expect(captureAuthFailed).toHaveBeenCalledWith({
        error_code: 'unknown',
        auth_action: 'google_sign_up'
      })
    )
  })

  it('reports the sign-up open only once the flag lets the page show', async () => {
    authFlag.value = false
    render(AuthSignIn, { props: { mode: 'signUp' } })
    await new Promise((resolve) => setTimeout(resolve, 0))

    expect(
      captureSignupOpened,
      'the cloud app reports the open when its page renders, not for a blank one'
    ).not.toHaveBeenCalled()

    authFlag.value = true
    await waitFor(() => expect(captureSignupOpened).toHaveBeenCalledOnce())
  })

  it("reports a completed social sign-in with the cloud app's metadata", async () => {
    vi.mocked(signInWorkshopWithGoogle).mockResolvedValue(
      testCredential(
        testFirebaseUser({
          uid: 'user-1',
          email: 'user@example.com',
          displayName: null
        })
      )
    )
    vi.mocked(isNewWorkshopUser).mockReturnValue(true)
    render(AuthSignIn)

    await clickGoogle()

    await waitFor(() =>
      expect(captureAuthCompleted).toHaveBeenCalledWith({
        method: 'google',
        is_new_user: true,
        user_id: 'user-1'
      })
    )
  })

  it('reports an email sign-in as an existing user and an email sign-up as a new one', async () => {
    vi.mocked(signInWorkshopWithEmail).mockResolvedValue(
      testCredential(
        testFirebaseUser({
          uid: 'user-1',
          email: 'user@example.com',
          displayName: null
        })
      )
    )
    render(AuthSignIn)
    const user = userEvent.setup()

    await openEmailForm(user)
    await user.type(screen.getByLabelText('Email'), 'user@example.com')
    await user.type(screen.getByLabelText('Password'), 'Password1!')
    await user.click(screen.getByRole('button', { name: /^sign in$/i }))

    await waitFor(() =>
      expect(captureAuthCompleted).toHaveBeenCalledWith({
        method: 'email',
        is_new_user: false,
        user_id: 'user-1'
      })
    )
    expect(
      vi.mocked(isNewWorkshopUser),
      'the cloud app hard-codes the answer for email; the provider is never asked'
    ).not.toHaveBeenCalled()
  })

  it('reports a sign-up page completion as a new user regardless of the provider answer', async () => {
    vi.mocked(signInWorkshopWithGitHub).mockResolvedValue(
      testCredential(
        testFirebaseUser({
          uid: 'user-2',
          email: null,
          displayName: 'Octo'
        })
      )
    )
    render(AuthSignIn, { props: { mode: 'signUp' } })

    await userEvent
      .setup()
      .click(screen.getByRole('button', { name: /sign up with github/i }))

    await waitFor(() =>
      expect(captureAuthCompleted).toHaveBeenCalledWith({
        method: 'github',
        is_new_user: true,
        user_id: 'user-2'
      })
    )
  })

  it('does not report a completion when provisioning fails after the popup', async () => {
    const failure = {
      user: testFirebaseUser({
        uid: 'user-1',
        email: 'a@b.co',
        displayName: null
      })
    }
    vi.mocked(isWorkshopProvisioningError).mockReturnValue(true)
    vi.mocked(signInWorkshopWithGoogle).mockResolvedValue(
      testCredential(failure.user)
    )
    vi.mocked(provisionWorkshopCustomer).mockRejectedValue(failure)
    render(AuthSignIn)

    await clickGoogle()

    await screen.findByRole('alert')
    expect(captureAuthCompleted).not.toHaveBeenCalled()
  })

  it('skips telemetry and the session mint when the flag turns off while sign-in is pending', async () => {
    let resolvePopup:
      | ((value: UserCredential | PromiseLike<UserCredential>) => void)
      | undefined
    vi.mocked(signInWorkshopWithGoogle).mockReturnValue(
      new Promise((resolve) => {
        resolvePopup = resolve
      })
    )
    render(AuthSignIn)

    await clickGoogle()
    await waitFor(() =>
      expect(vi.mocked(signInWorkshopWithGoogle)).toHaveBeenCalledOnce()
    )

    authFlag.value = false
    resolvePopup!(
      testCredential(
        testFirebaseUser({
          uid: 'uid-1',
          email: 'user@example.com',
          displayName: null
        })
      )
    )
    await new Promise((resolve) => setTimeout(resolve, 0))

    expect(
      captureAuthCompleted,
      'a flag disabled mid-flight must stop post-auth telemetry'
    ).not.toHaveBeenCalled()
    expect(
      vi.mocked(useWorkshopSession().ensureFresh),
      'and must not mint or persist a workspace session'
    ).not.toHaveBeenCalled()
  })

  it('does not provision when the flag turns off during the popup', async () => {
    let resolvePopup:
      | ((value: UserCredential | PromiseLike<UserCredential>) => void)
      | undefined
    vi.mocked(signInWorkshopWithGoogle).mockReturnValue(
      new Promise((resolve) => {
        resolvePopup = resolve
      })
    )
    render(AuthSignIn)

    await clickGoogle()
    await waitFor(() =>
      expect(vi.mocked(signInWorkshopWithGoogle)).toHaveBeenCalledOnce()
    )

    authFlag.value = false
    resolvePopup!(
      testCredential(
        testFirebaseUser({
          uid: 'uid-1',
          email: 'user@example.com',
          displayName: null
        })
      )
    )
    await new Promise((resolve) => setTimeout(resolve, 0))

    expect(
      vi.mocked(provisionWorkshopCustomer),
      'a disable during the popup must stop provisioning before it fires'
    ).not.toHaveBeenCalled()
    expect(captureAuthCompleted).not.toHaveBeenCalled()
  })

  it('abandons the attempt on an off->on flag flicker during the popup', async () => {
    let resolvePopup:
      | ((value: UserCredential | PromiseLike<UserCredential>) => void)
      | undefined
    vi.mocked(signInWorkshopWithGoogle).mockReturnValue(
      new Promise((resolve) => {
        resolvePopup = resolve
      })
    )
    render(AuthSignIn)

    await clickGoogle()
    await waitFor(() =>
      expect(vi.mocked(signInWorkshopWithGoogle)).toHaveBeenCalledOnce()
    )

    // A live boolean would pass (on at resolution); the generation must not.
    authFlag.value = false
    authFlag.value = true
    resolvePopup!(
      testCredential(
        testFirebaseUser({
          uid: 'uid-1',
          email: 'user@example.com',
          displayName: null
        })
      )
    )
    await new Promise((resolve) => setTimeout(resolve, 0))

    expect(
      vi.mocked(provisionWorkshopCustomer),
      'an off->on flicker must still abandon the attempt'
    ).not.toHaveBeenCalled()
    expect(captureAuthCompleted).not.toHaveBeenCalled()
  })

  it('keeps an email user signed in with the inline message when provisioning fails', async () => {
    const failure = {
      user: testFirebaseUser({
        uid: 'user-1',
        email: 'user@example.com',
        displayName: null
      })
    }
    vi.mocked(isWorkshopProvisioningError).mockReturnValue(true)
    vi.mocked(signInWorkshopWithEmail).mockResolvedValue(
      testCredential(failure.user)
    )
    vi.mocked(provisionWorkshopCustomer).mockRejectedValue(failure)
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
    vi.mocked(signInWorkshopWithEmail).mockImplementation(
      () => new Promise(() => {})
    )
    render(AuthSignIn)
    const user = userEvent.setup()

    await openEmailForm(user)
    await user.type(screen.getByLabelText('Email'), 'user@example.com')
    await user.type(screen.getByLabelText('Password'), 'Password1!')
    const submit = screen.getByRole('button', { name: /^sign in$/i })
    await user.click(submit)
    await user.click(submit)

    await waitFor(() =>
      expect(vi.mocked(signInWorkshopWithEmail)).toHaveBeenCalledOnce()
    )
  })

  it('recovers from an abandoned attempt so a later restore still signs in', async () => {
    let resolveProvision: (() => void) | undefined
    vi.mocked(signInWorkshopWithGoogle).mockResolvedValue(
      testCredential(
        testFirebaseUser({
          uid: 'user-1',
          email: 'user@example.com',
          displayName: null
        })
      )
    )
    vi.mocked(provisionWorkshopCustomer).mockReturnValue(
      new Promise<void>((resolve) => {
        resolveProvision = resolve
      })
    )
    render(AuthSignIn)

    await clickGoogle()
    await waitFor(() =>
      expect(vi.mocked(provisionWorkshopCustomer)).toHaveBeenCalledOnce()
    )

    authFlag.value = false
    resolveProvision!()
    await new Promise((resolve) => setTimeout(resolve, 0))
    expect(captureAuthCompleted).not.toHaveBeenCalled()

    authFlag.value = true
    authUser.value = testFirebaseUser({
      uid: 'user-1',
      email: 'user@example.com',
      displayName: null
    })

    // A stuck attempt would swallow the restore; recovery lets it mint away.
    await waitFor(() => expect(replace).toHaveBeenCalledWith('/'))
  })

  it('reports no failure and publishes no toast when provisioning rejects after the flag turned off', async () => {
    let rejectProvision: ((reason: unknown) => void) | undefined
    const failure = testCredential(
      testFirebaseUser({
        uid: 'user-1',
        email: 'a@b.co',
        displayName: null
      })
    )
    vi.mocked(isWorkshopProvisioningError).mockImplementation(
      (error) => error === failure
    )
    vi.mocked(signInWorkshopWithGoogle).mockResolvedValue(
      testCredential(
        testFirebaseUser({
          uid: 'user-1',
          email: 'a@b.co',
          displayName: null
        })
      )
    )
    vi.mocked(provisionWorkshopCustomer).mockReturnValue(
      new Promise<void>((_resolve, reject) => {
        rejectProvision = reject
      })
    )
    render(AuthSignIn)
    render(AuthToast)

    await clickGoogle()
    await waitFor(() =>
      expect(vi.mocked(provisionWorkshopCustomer)).toHaveBeenCalledOnce()
    )

    authFlag.value = false
    rejectProvision!(failure)
    await new Promise((resolve) => setTimeout(resolve, 0))

    expect(captureAuthFailed).not.toHaveBeenCalled()
    expect(toasts.value).toHaveLength(0)
  })

  it('toasts the signup-blocked copy when the popup reports the blocked token', async () => {
    vi.mocked(signInWorkshopWithGoogle).mockRejectedValue({
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
    settled.value = false
    render(AuthSignIn)

    expect(screen.getByTestId('auth-initializing')).toBeTruthy()
    expect(
      screen.queryByRole('button'),
      'painting the form before auth settles flashes it at a returning signed-in visitor'
    ).toBeNull()

    settled.value = true

    expect(
      await screen.findByRole('button', { name: /^sign in with google$/i })
    ).toBeTruthy()
    expect(screen.queryByTestId('auth-initializing')).toBeNull()
  })

  it('never paints the form for a returning signed-in visitor on the way out', async () => {
    settled.value = false
    render(AuthSignIn)

    authUser.value = testFirebaseUser({
      uid: 'user-1',
      email: 'a@b.co',
      displayName: null
    })
    settled.value = true

    await waitFor(() => expect(replace).toHaveBeenCalledWith('/'))
    expect(screen.queryByRole('button')).toBeNull()
  })

  it('shows the form with the session-failure banner when a returning visitor cannot mint', async () => {
    settled.value = false
    vi.mocked(useWorkshopSession().ensureFresh).mockResolvedValueOnce({
      status: 'error',
      code: 'TOKEN_EXCHANGE_FAILED'
    })
    render(AuthSignIn)

    authUser.value = testFirebaseUser({
      uid: 'user-1',
      email: 'a@b.co',
      displayName: null
    })
    settled.value = true

    expect(
      await screen.findByRole('button', { name: 'Retry session' })
    ).toBeTruthy()
    expect(replace).not.toHaveBeenCalled()
  })

  describe('when auth never initializes', () => {
    it('shows the same copy when Firebase never settles', async () => {
      settled.value = false
      render(AuthSignIn)

      await vi.advanceTimersByTimeAsync(16_000)

      expect((await screen.findByRole('alert')).textContent).toContain(
        'Connection Taking Too Long'
      )
      expect(screen.queryByTestId('auth-initializing')).toBeNull()
    })

    it('shows nothing when PostHog answered that the flag is off', async () => {
      authFlag.value = false
      render(AuthSignIn)

      await vi.advanceTimersByTimeAsync(16_000)
      expect(screen.queryByRole('alert')).toBeNull()
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
      await screen.findByRole('heading', { name: 'Sign in to your account' })
    ).toBeTruthy()
  })

  it('shows the pop-up progress line and holds every option while the pop-up is open', async () => {
    vi.mocked(signInWorkshopWithGoogle).mockImplementation(
      () => new Promise(() => {})
    )
    render(AuthSignIn)

    await clickGoogle()

    expect(
      await screen.findByText('Finish signing in from the pop-up window.')
    ).toBeTruthy()
    for (const name of [
      /^sign in with google$/i,
      /^sign in with github$/i,
      /use email instead/i
    ]) {
      expect(screen.getByRole('button', { name })).toHaveProperty(
        'disabled',
        true
      )
    }
  })

  it('says it is signing you in from the moment the pop-up closes until the page leaves', async () => {
    vi.mocked(signInWorkshopWithGoogle).mockResolvedValue(
      testCredential(
        testFirebaseUser({
          uid: 'user-1',
          email: 'user@example.com',
          displayName: null
        })
      )
    )
    vi.mocked(useWorkshopSession().ensureFresh).mockImplementation(
      () => new Promise(() => {})
    )
    render(AuthSignIn)

    await clickGoogle()

    expect(await screen.findByText('Signing you in…')).toBeTruthy()
    expect(replace).not.toHaveBeenCalled()
  })

  it('says it is creating the account on the sign-up page', async () => {
    vi.mocked(signInWorkshopWithGitHub).mockResolvedValue(
      testCredential(
        testFirebaseUser({
          uid: 'user-2',
          email: null,
          displayName: 'Octo'
        })
      )
    )
    vi.mocked(useWorkshopSession().ensureFresh).mockImplementation(
      () => new Promise(() => {})
    )
    render(AuthSignIn, { props: { mode: 'signUp' } })

    await userEvent
      .setup()
      .click(screen.getByRole('button', { name: /sign up with github/i }))

    expect(await screen.findByText('Creating your account…')).toBeTruthy()
  })

  it('does not report a sign-up open from the login page', async () => {
    render(AuthSignIn)
    await screen.findByRole('button', { name: /^sign in with google$/i })

    expect(captureSignupOpened).not.toHaveBeenCalled()
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
    await screen.findByRole('button', { name: /^sign in with google$/i })

    expect(screen.queryByTestId('google-sso-in-app-browser-notice')).toBeNull()
  })

  it("raises one sticky error toast with the cloud app's own line when an email sign-in fails", async () => {
    vi.mocked(signInWorkshopWithEmail).mockRejectedValue({
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
      'user-not-found collapses to the neutral invalid-credential line so the toast never confirms whether the email has an account'
    ).toContain(t('auth.errors.auth/invalid-credential', 'en'))
    expect(toasts.value[0].life).toBeUndefined()
    expect(replace).not.toHaveBeenCalled()
  })

  it('names this host in the unauthorized-domain toast', async () => {
    vi.mocked(signInWorkshopWithGoogle).mockRejectedValue({
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
    vi.mocked(signUpWorkshopWithEmail).mockRejectedValue({
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

    await waitFor(() =>
      expect(vi.mocked(signUpWorkshopWithEmail)).toHaveBeenCalledOnce()
    )
    expect(vi.mocked(signUpWorkshopWithEmail)).toHaveBeenCalledWith(
      'user@example.com',
      'Password1!',
      'cf-token'
    )
    expect(handles.turnstileReset).toHaveBeenCalledOnce()
  })

  it('shows email-appropriate progress copy while an email sign-in is pending', async () => {
    vi.mocked(signInWorkshopWithEmail).mockImplementation(
      () => new Promise(() => {})
    )
    render(AuthSignIn)
    const user = userEvent.setup()

    await openEmailForm(user)
    await user.type(screen.getByLabelText('Email'), 'user@example.com')
    await user.type(screen.getByLabelText('Password'), 'Password1!')
    await user.click(screen.getByRole('button', { name: /^sign in$/i }))

    await waitFor(() =>
      expect(vi.mocked(signInWorkshopWithEmail)).toHaveBeenCalledOnce()
    )
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
      screen.queryByRole('button', { name: /^sign in with google$/i })
    ).toBeNull()

    await user.click(
      screen.getByRole('button', {
        name: 'Sign in with Google or Github instead'
      })
    )
    expect(screen.queryByLabelText('Email')).toBeNull()
    expect(
      screen.getByRole('button', { name: /^sign in with google$/i })
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
    vi.mocked(isWorkshopProvisioningError).mockImplementation(
      (error) => error === failure
    )
    vi.mocked(signInWorkshopWithGoogle).mockRejectedValue(failure)
    render(AuthSignIn)

    await clickGoogle()

    expect((await screen.findByRole('alert')).textContent).toContain(
      'account setup did not finish'
    )
    expect(replace).not.toHaveBeenCalled()
    expect(toasts.value).toHaveLength(0)
  })

  it('offers a retry inline when session minting fails, then leaves once it succeeds', async () => {
    vi.mocked(signInWorkshopWithGoogle).mockResolvedValue(
      testCredential(
        testFirebaseUser({
          uid: 'user-1',
          email: 'user@example.com',
          displayName: null
        })
      )
    )
    vi.mocked(useWorkshopSession().ensureFresh).mockResolvedValueOnce({
      status: 'error',
      code: 'TOKEN_EXCHANGE_FAILED'
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
    vi.mocked(signInWorkshopWithGoogle).mockResolvedValue(
      testCredential(
        testFirebaseUser({
          uid: 'user-1',
          email: 'user@example.com',
          displayName: null
        })
      )
    )
    vi.mocked(useWorkshopSession().ensureFresh).mockResolvedValueOnce({
      status: 'error',
      code: 'TOKEN_EXCHANGE_FAILED'
    })
    render(AuthSignIn)

    await clickGoogle()
    await screen.findByRole('button', { name: 'Retry session' })

    session.value = accountCredential

    await waitFor(() =>
      expect(screen.queryByRole('button', { name: 'Retry session' })).toBeNull()
    )
    expect(screen.queryByRole('alert')).toBeNull()
  })
})

describe('AuthSignIn controller lifecycle', () => {
  const socialUser = testCredential(
    testFirebaseUser({
      uid: 'user-1',
      email: 'user@example.com',
      displayName: null
    })
  )
  const flush = () => vi.advanceTimersByTimeAsync(0)
  const googleButton = () =>
    screen.getByRole('button', { name: /^sign in with google$/i })

  it('does not leave the page when the flag turns off during the mint, even once the session client publishes the credential', async () => {
    let publishAndResolveMint: (() => void) | undefined
    vi.mocked(signInWorkshopWithGoogle).mockResolvedValue(socialUser)
    vi.mocked(useWorkshopSession().ensureFresh).mockImplementation(
      () =>
        new Promise((resolve) => {
          publishAndResolveMint = () => {
            session.value = accountCredential
            resolve({ status: 'ok', session: accountCredential })
          }
        })
    )
    render(AuthSignIn)

    await clickGoogle()
    await waitFor(() =>
      expect(vi.mocked(useWorkshopSession().ensureFresh)).toHaveBeenCalledOnce()
    )

    authFlag.value = false
    publishAndResolveMint!()
    await flush()

    expect(
      replace,
      'a flag disabled mid-mint must not redirect an abandoned attempt, even when the session client publishes the credential'
    ).not.toHaveBeenCalled()
  })

  it('reports no completion for an attempt abandoned during the mint', async () => {
    let resolveMint:
      | ((
          value:
            | SessionResult
            | PromiseLike<SessionResult | undefined>
            | undefined
        ) => void)
      | undefined
    vi.mocked(signInWorkshopWithGoogle).mockResolvedValue(socialUser)
    vi.mocked(useWorkshopSession().ensureFresh).mockImplementation(
      () => new Promise((resolve) => (resolveMint = resolve))
    )
    render(AuthSignIn)

    await clickGoogle()
    await waitFor(() =>
      expect(vi.mocked(useWorkshopSession().ensureFresh)).toHaveBeenCalledOnce()
    )

    authFlag.value = false
    resolveMint!({ status: 'ok', session: accountCredential })
    await flush()

    expect(
      captureAuthCompleted,
      'an attempt abandoned mid-mint must emit no auth_completed'
    ).not.toHaveBeenCalled()
  })

  it('does not mint or redirect after the component unmounts mid-mint', async () => {
    let resolveMint:
      | ((
          value:
            | SessionResult
            | PromiseLike<SessionResult | undefined>
            | undefined
        ) => void)
      | undefined
    vi.mocked(signInWorkshopWithGoogle).mockResolvedValue(socialUser)
    vi.mocked(useWorkshopSession().ensureFresh).mockImplementation(
      () => new Promise((resolve) => (resolveMint = resolve))
    )
    const { unmount } = render(AuthSignIn)

    await clickGoogle()
    await waitFor(() =>
      expect(vi.mocked(useWorkshopSession().ensureFresh)).toHaveBeenCalledOnce()
    )

    unmount()
    resolveMint!({ status: 'ok', session: accountCredential })
    await flush()

    expect(
      replace,
      'a mint resolving after teardown must not redirect'
    ).not.toHaveBeenCalled()
  })

  it('stops the flow after the component unmounts mid-provisioning', async () => {
    let resolveProvision: (() => void) | undefined
    vi.mocked(signInWorkshopWithGoogle).mockResolvedValue(socialUser)
    vi.mocked(provisionWorkshopCustomer).mockReturnValue(
      new Promise<void>((resolve) => (resolveProvision = resolve))
    )
    const { unmount } = render(AuthSignIn)

    await clickGoogle()
    await waitFor(() =>
      expect(vi.mocked(provisionWorkshopCustomer)).toHaveBeenCalledOnce()
    )

    unmount()
    resolveProvision!()
    await flush()

    expect(
      captureAuthCompleted,
      'provisioning completing after teardown must not continue the flow'
    ).not.toHaveBeenCalled()
    expect(
      vi.mocked(useWorkshopSession().ensureFresh),
      'and must not mint a session for a torn-down attempt'
    ).not.toHaveBeenCalled()
  })

  it('stops the flow after the component unmounts mid-popup', async () => {
    let resolvePopup:
      | ((value: UserCredential | PromiseLike<UserCredential>) => void)
      | undefined
    vi.mocked(signInWorkshopWithGoogle).mockReturnValue(
      new Promise((resolve) => (resolvePopup = resolve))
    )
    const { unmount } = render(AuthSignIn)

    await clickGoogle()
    await waitFor(() =>
      expect(vi.mocked(signInWorkshopWithGoogle)).toHaveBeenCalledOnce()
    )

    unmount()
    resolvePopup!(socialUser)
    await flush()

    expect(
      vi.mocked(provisionWorkshopCustomer),
      'a popup resolving after teardown must not provision'
    ).not.toHaveBeenCalled()
    expect(captureAuthCompleted).not.toHaveBeenCalled()
  })

  it('signs the Firebase identity out once when the flag turns off after authentication', async () => {
    let resolvePopup:
      | ((value: UserCredential | PromiseLike<UserCredential>) => void)
      | undefined
    vi.mocked(signInWorkshopWithGoogle).mockReturnValue(
      new Promise((resolve) => (resolvePopup = resolve))
    )
    render(AuthSignIn)

    await clickGoogle()
    await waitFor(() =>
      expect(vi.mocked(signInWorkshopWithGoogle)).toHaveBeenCalledOnce()
    )

    authFlag.value = false
    resolvePopup!(socialUser)
    await flush()

    expect(
      vi.mocked(signOutWorkshop),
      'abandoning after Firebase auth succeeded must roll the persisted identity back'
    ).toHaveBeenCalledOnce()
  })

  it('re-enables the controls when a non-interactive step hangs past its deadline', async () => {
    vi.mocked(signInWorkshopWithGoogle).mockResolvedValue(socialUser)
    vi.mocked(provisionWorkshopCustomer).mockReturnValue(
      new Promise<void>(() => {})
    )
    render(AuthSignIn)

    await clickGoogle()
    await waitFor(() =>
      expect(vi.mocked(provisionWorkshopCustomer)).toHaveBeenCalledOnce()
    )
    expect(googleButton()).toHaveProperty('disabled', true)

    await vi.advanceTimersByTimeAsync(16_000)

    expect(
      googleButton(),
      'a hung provider must not disable the controls forever'
    ).toHaveProperty('disabled', false)
  })

  it('keeps the identity and offers a retry when provisioning outruns its deadline, instead of signing out', async () => {
    vi.mocked(signInWorkshopWithGoogle).mockResolvedValue(socialUser)
    vi.mocked(provisionWorkshopCustomer).mockReturnValue(
      new Promise<void>(() => {})
    )
    render(AuthSignIn)

    await clickGoogle()
    await waitFor(() =>
      expect(vi.mocked(provisionWorkshopCustomer)).toHaveBeenCalledOnce()
    )

    await vi.advanceTimersByTimeAsync(16_000)

    expect(
      (await screen.findByRole('alert')).textContent,
      'a slow-but-valid provider keeps the user signed in and says setup did not finish'
    ).toContain('account setup did not finish')
    expect(
      vi.mocked(signOutWorkshop),
      'a provisioning timeout must not tear the fresh identity down like a full sign-out'
    ).not.toHaveBeenCalled()
    expect(replace).not.toHaveBeenCalled()
    expect(
      captureAuthCompleted,
      'a timeout is not a completion'
    ).not.toHaveBeenCalled()
    expect(
      googleButton(),
      'the controls recover so the user can retry'
    ).toHaveProperty('disabled', false)
  })

  it('frees the controls even when the post-authentication rollback sign-out rejects', async () => {
    let resolvePopup:
      | ((value: UserCredential | PromiseLike<UserCredential>) => void)
      | undefined
    vi.mocked(signInWorkshopWithGoogle).mockReturnValue(
      new Promise((resolve) => (resolvePopup = resolve))
    )
    vi.mocked(signOutWorkshop).mockRejectedValue(new Error('sign-out failed'))
    render(AuthSignIn)

    await clickGoogle()
    await waitFor(() =>
      expect(vi.mocked(signInWorkshopWithGoogle)).toHaveBeenCalledOnce()
    )

    authFlag.value = false
    resolvePopup!(socialUser)
    await flush()

    authFlag.value = true
    await flush()

    expect(
      vi.mocked(signOutWorkshop),
      'abandoning after auth rolls the persisted identity back once'
    ).toHaveBeenCalledOnce()
    expect(
      googleButton(),
      'a rejected best-effort sign-out must not strand the disabled controls'
    ).toHaveProperty('disabled', false)
  })

  it('discards a provisioning result that settles after the deadline', async () => {
    let resolveProvision: (() => void) | undefined
    vi.mocked(signInWorkshopWithGoogle).mockResolvedValue(socialUser)
    vi.mocked(provisionWorkshopCustomer).mockReturnValue(
      new Promise<void>((resolve) => (resolveProvision = resolve))
    )
    render(AuthSignIn)

    await clickGoogle()
    await waitFor(() =>
      expect(vi.mocked(provisionWorkshopCustomer)).toHaveBeenCalledOnce()
    )

    await vi.advanceTimersByTimeAsync(16_000)
    expect(
      googleButton(),
      'a provider past its deadline must recover the controls'
    ).toHaveProperty('disabled', false)

    resolveProvision!()
    await flush()

    expect(
      captureAuthCompleted,
      'a provisioning result settling after the deadline must not continue the flow'
    ).not.toHaveBeenCalled()
    expect(
      vi.mocked(useWorkshopSession().ensureFresh),
      'and must not mint a session for the abandoned attempt'
    ).not.toHaveBeenCalled()
    expect(
      replace,
      'and must not redirect an abandoned attempt'
    ).not.toHaveBeenCalled()
    expect(session.value).toBeUndefined()
  })

  it('recovers the controls with a message when a prior rollback sign-out never settles', async () => {
    const events: string[] = []
    let resolveMint:
      | ((
          value:
            | SessionResult
            | PromiseLike<SessionResult | undefined>
            | undefined
        ) => void)
      | undefined
    vi.mocked(signInWorkshopWithGoogle).mockImplementation(() => {
      events.push('authenticate')
      return Promise.resolve(socialUser)
    })
    vi.mocked(useWorkshopSession().ensureFresh).mockImplementationOnce(
      () => new Promise((resolve) => (resolveMint = resolve))
    )
    // The abandoned attempt's rollback sign-out hangs and never settles.
    vi.mocked(signOutWorkshop).mockReturnValue(new Promise<void>(() => {}))
    render(AuthSignIn)

    await clickGoogle()
    await waitFor(() =>
      expect(vi.mocked(useWorkshopSession().ensureFresh)).toHaveBeenCalledOnce()
    )

    authFlag.value = false
    resolveMint!({ status: 'ok', session: accountCredential })
    await flush()
    await waitFor(() =>
      expect(vi.mocked(signOutWorkshop)).toHaveBeenCalledOnce()
    )

    // The first attempt's own bounded rollback wait recovers its controls.
    authFlag.value = true
    await vi.advanceTimersByTimeAsync(16_000)
    await waitFor(() =>
      expect(googleButton()).toHaveProperty('disabled', false)
    )

    // The retry starts while that sign-out is still pending; the bounded wait
    // must free the controls at the deadline instead of hanging on it forever.
    await clickGoogle()
    await vi.advanceTimersByTimeAsync(16_000)
    await flush()

    expect(
      googleButton(),
      'a never-settling rollback sign-out must not pin the controls: the bounded wait recovers them'
    ).toHaveProperty('disabled', false)
    expect(
      toasts.value,
      'the timed-out retry surfaces the failure copy rather than going silently idle'
    ).toHaveLength(1)
    expect(
      events,
      'the retry must not authenticate into the still-live global sign-out'
    ).toEqual(['authenticate'])
    expect(replace).not.toHaveBeenCalled()
  })

  it('serializes a rollback sign-out that outran its deadline before the retry authenticates, so the stale sign-out cannot clear the new identity', async () => {
    const events: string[] = []
    let resolveSignOut: (() => void) | undefined
    let resolveMint:
      | ((
          value:
            | SessionResult
            | PromiseLike<SessionResult | undefined>
            | undefined
        ) => void)
      | undefined
    vi.mocked(signInWorkshopWithGoogle).mockImplementation(() => {
      events.push('authenticate')
      return Promise.resolve(socialUser)
    })
    // First attempt authenticates, then the flag flips off during the mint, so
    // it is abandoned after an identity was persisted; its rollback sign-out
    // then hangs past its own deadline.
    vi.mocked(useWorkshopSession().ensureFresh).mockImplementationOnce(
      () => new Promise((resolve) => (resolveMint = resolve))
    )
    vi.mocked(signOutWorkshop).mockReturnValue(
      new Promise<void>((resolve) => {
        resolveSignOut = () => {
          events.push('signOut:settled')
          resolve()
        }
      })
    )
    render(AuthSignIn)

    await clickGoogle()
    await waitFor(() =>
      expect(vi.mocked(useWorkshopSession().ensureFresh)).toHaveBeenCalledOnce()
    )

    authFlag.value = false
    resolveMint!({ status: 'ok', session: accountCredential })
    await flush()
    await waitFor(() =>
      expect(vi.mocked(signOutWorkshop)).toHaveBeenCalledOnce()
    )

    // The sign-out outruns its own deadline; the controls recover even though
    // the rollback is still in flight — the deadline's benefit is preserved.
    authFlag.value = true
    await vi.advanceTimersByTimeAsync(16_000)
    expect(
      googleButton(),
      'a hung rollback sign-out must still free the controls at its deadline'
    ).toHaveProperty('disabled', false)

    // The retry starts while the stale sign-out is still pending, but must not
    // authenticate into it.
    await clickGoogle()
    await flush()
    expect(
      events,
      'the retry must not authenticate while the stale sign-out is still clearing the global identity'
    ).toEqual(['authenticate'])
    expect(replace).not.toHaveBeenCalled()

    resolveSignOut!()
    await waitFor(() => expect(replace).toHaveBeenCalledWith('/'))

    expect(
      events,
      "the retry's authentication is ordered strictly after the stale sign-out settles, or that sign-out would clear the new attempt's identity"
    ).toEqual(['authenticate', 'signOut:settled', 'authenticate'])
    expect(
      vi.mocked(signOutWorkshop),
      'the new attempt must not be signed out by the abandoned attempt'
    ).toHaveBeenCalledOnce()
  })

  it('bounds a hung email sign-in and surfaces a message on recovery', async () => {
    vi.mocked(signInWorkshopWithEmail).mockImplementation(
      () => new Promise(() => {})
    )
    render(AuthSignIn)
    render(AuthToast)
    const user = userEvent.setup()

    await openEmailForm(user)
    await user.type(screen.getByLabelText('Email'), 'user@example.com')
    await user.type(screen.getByLabelText('Password'), 'Password1!')
    await user.click(screen.getByRole('button', { name: /^sign in$/i }))
    await waitFor(() =>
      expect(vi.mocked(signInWorkshopWithEmail)).toHaveBeenCalledOnce()
    )

    await vi.advanceTimersByTimeAsync(16_000)

    expect(
      toasts.value,
      'a hung email request recovers with a message rather than silently re-enabling'
    ).toHaveLength(1)
    expect(toasts.value[0].detail).toBe(t('auth.errors.generic', 'en'))
    expect(
      screen.getByRole('button', { name: /^sign in$/i }),
      'a bounded email request frees the controls at its deadline'
    ).toHaveProperty('disabled', false)
  })

  it('leaves the user-driven social popup wait unbounded past the operation deadline', async () => {
    vi.mocked(signInWorkshopWithGoogle).mockReturnValue(new Promise(() => {}))
    render(AuthSignIn)
    render(AuthToast)

    await clickGoogle()
    await waitFor(() =>
      expect(vi.mocked(signInWorkshopWithGoogle)).toHaveBeenCalledOnce()
    )

    await vi.advanceTimersByTimeAsync(16_000)

    expect(
      googleButton(),
      'the user-driven popup is never timed out'
    ).toHaveProperty('disabled', true)
    expect(
      toasts.value,
      'an unbounded popup wait surfaces no timeout message'
    ).toHaveLength(0)
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
    authFlag.value = false
    render(AuthSignIn, { props: { mode: 'signUp' } })
    await new Promise((resolve) => setTimeout(resolve, 0))

    expect(
      isInChina,
      "cloud's signup view is never mounted behind the router; a hidden page must not reach the geo edge"
    ).not.toHaveBeenCalled()

    authFlag.value = true
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
