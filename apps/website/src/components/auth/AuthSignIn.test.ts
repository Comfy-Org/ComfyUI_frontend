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
  user: undefined as { value: unknown } | undefined,
  session: undefined as { value: unknown } | undefined,
  chunkFails: false,
  ensureFresh: vi.fn(),
  google: vi.fn(),
  github: vi.fn(),
  emailSignIn: vi.fn(),
  emailSignUp: vi.fn(),
  turnstileReset: vi.fn(),
  isProvisioningError: vi.fn()
}))

vi.mock('../../scripts/posthog', async () => {
  const { ref } = await import('vue')
  const flag = ref(true)
  handles.flag = flag
  return {
    useWorkshopAuthFlag: () => flag,
    useWorkshopTurnstileMode: () => ref('shadow')
  }
})

vi.mock('@comfyorg/account/TurnstileWidget.vue', async () => {
  const { defineComponent, h, onMounted } = await import('vue')
  return {
    default: defineComponent({
      emits: ['update:token', 'update:unavailable'],
      setup(_, { emit, expose }) {
        expose({ reset: handles.turnstileReset })
        onMounted(() => emit('update:token', 'cf-token'))
        return () => h('div', { 'data-testid': 'turnstile' })
      }
    })
  }
})

vi.mock('../../config/workshop-firebase', () => {
  if (handles.chunkFails) {
    throw new TypeError('Failed to fetch dynamically imported module')
  }
  return {
    signInWorkshopWithGoogle: handles.google,
    signInWorkshopWithGitHub: handles.github,
    signInWorkshopWithEmail: handles.emailSignIn,
    signUpWorkshopWithEmail: handles.emailSignUp,
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
      ensureFresh: handles.ensureFresh
    })
  }
})

const { messages: toasts } = useAuthToasts()
const replace = vi.fn<(url: string | URL) => void>()
const assign = vi.fn<(url: string | URL) => void>()

beforeEach(() => {
  handles.flag!.value = true
  handles.user!.value = null
  handles.session!.value = undefined
  handles.chunkFails = false
  handles.ensureFresh.mockReset().mockResolvedValue({
    status: 'ok',
    session: { token: 'workspace-jwt' }
  })
  handles.google.mockReset()
  handles.github.mockReset()
  handles.emailSignIn.mockReset()
  handles.emailSignUp.mockReset()
  handles.turnstileReset.mockReset()
  handles.isProvisioningError.mockReset().mockReturnValue(false)
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

  it('sends an already-signed-in visitor away without a panel, minting without the readonly proxy', async () => {
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
    expect(screen.queryByText(/a@b\.co/)).toBeNull()
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
  })

  it('raises one sticky error toast with the collapsed credential copy when an email sign-in fails', async () => {
    handles.emailSignIn.mockRejectedValue({
      code: 'auth/user-not-found',
      message: 'x'
    })
    render(AuthSignIn)
    render(AuthToast)
    const user = userEvent.setup()

    await user.type(screen.getByLabelText('Email'), 'user@example.com')
    await user.type(screen.getByLabelText('Password'), 'Password1!')
    await user.click(
      screen.getByRole('button', { name: /sign in with email/i })
    )

    const alert = await screen.findByRole('alert')
    expect(alert.getAttribute('data-severity')).toBe('error')
    expect(
      alert.textContent,
      'an unknown address must read exactly like a wrong password'
    ).toContain(AUTH_ERROR_MESSAGES['auth/invalid-credential'])
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

    await user.type(screen.getByLabelText('Email'), 'user@example.com')
    await user.type(screen.getByLabelText('Password'), 'Password1!')
    await user.type(screen.getByLabelText('Confirm password'), 'Password1!')
    await user.click(screen.getByRole('button', { name: /create account/i }))

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

    await user.type(screen.getByLabelText('Email'), 'user@example.com')
    await user.type(screen.getByLabelText('Password'), 'Password1!')
    await user.click(
      screen.getByRole('button', { name: /sign in with email/i })
    )

    await waitFor(() => expect(handles.emailSignIn).toHaveBeenCalledOnce())
    expect(
      screen.queryByText(/pop-up window/i),
      'no pop-up exists in the email flow; the copy must not tell users to look for one'
    ).toBeNull()
    expect(screen.getByText(/signing you in/i)).toBeTruthy()
  })

  it('carries a safe return destination into the forgot-password flow on click', async () => {
    window.history.replaceState(
      {},
      '',
      '/login/?returnTo=%2Fworkshop%2Fmodels%2Fexample%2F'
    )
    render(AuthSignIn)

    await userEvent
      .setup()
      .click(await screen.findByRole('link', { name: /forgot password/i }))

    expect(assign).toHaveBeenCalledWith(
      '/forgot-password/?returnTo=%2Fworkshop%2Fmodels%2Fexample%2F'
    )
  })

  it('keeps the plain href in markup so a pre-hydration click still reaches the page', () => {
    window.history.replaceState(
      {},
      '',
      '/login/?returnTo=%2Fworkshop%2Fmodels%2Fexample%2F'
    )
    render(AuthSignIn)

    expect(
      screen
        .getByRole('link', { name: /forgot password/i })
        .getAttribute('href'),
      'hydration never repairs a server-rendered href, so the destination is added at click time instead'
    ).toBe('/forgot-password/')
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
