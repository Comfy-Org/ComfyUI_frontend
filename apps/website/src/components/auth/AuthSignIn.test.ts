// @vitest-environment happy-dom
import { render, screen, waitFor } from '@testing-library/vue'
import userEvent from '@testing-library/user-event'
import { beforeEach, describe, expect, it, vi } from 'vitest'

import AuthSignIn from './AuthSignIn.vue'

const handles = vi.hoisted(() => ({
  flag: undefined as { value: boolean } | undefined,
  user: undefined as { value: unknown } | undefined,
  ensureFresh: vi.fn(),
  signOut: vi.fn(),
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

vi.mock('@comfyorg/auth-core/TurnstileWidget.vue', async () => {
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

vi.mock('../../config/workshop-firebase', () => ({
  signInWorkshopWithGoogle: handles.google,
  signInWorkshopWithGitHub: handles.github,
  signInWorkshopWithEmail: handles.emailSignIn,
  signUpWorkshopWithEmail: handles.emailSignUp,
  signOutWorkshop: handles.signOut,
  isWorkshopProvisioningError: handles.isProvisioningError
}))

vi.mock('../../config/workshop-session-state', async () => {
  const { ref } = await import('vue')
  const user = ref(null)
  handles.user = user
  return {
    useWorkshopSession: () => ({
      user,
      ensureFresh: handles.ensureFresh,
      signOut: handles.signOut
    })
  }
})

beforeEach(() => {
  handles.flag!.value = true
  handles.user!.value = null
  handles.ensureFresh.mockReset().mockResolvedValue({
    status: 'ok',
    session: { token: 'workspace-jwt' }
  })
  handles.signOut.mockReset().mockResolvedValue(undefined)
  handles.google.mockReset()
  handles.github.mockReset()
  handles.emailSignIn.mockReset()
  handles.emailSignUp.mockReset()
  handles.turnstileReset.mockReset()
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

  it('keeps a safe return destination through the forgot-password flow', async () => {
    window.history.replaceState(
      {},
      '',
      '/login/?returnTo=%2Fworkshop%2Fmodels%2Fexample%2F'
    )
    render(AuthSignIn)

    const link = await screen.findByRole('link', { name: /forgot password/i })
    expect(link.getAttribute('href')).toBe(
      '/forgot-password/?returnTo=%2Fworkshop%2Fmodels%2Fexample%2F'
    )
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
})
