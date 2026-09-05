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
  emitUser: undefined as ((user: unknown) => void) | undefined
}))

vi.mock('../../scripts/posthog', async () => {
  const { ref } = await import('vue')
  const flag = ref(true)
  handles.flag = flag
  return { useWorkshopAuthFlag: () => flag }
})

vi.mock('../../config/workshop-firebase', () => ({
  signInWorkshopWithGoogle: handles.google,
  signInWorkshopWithGitHub: handles.github,
  signOutWorkshop: handles.signOut,
  isWorkshopProvisioningError: handles.isProvisioningError,
  onWorkshopUserChanged: (cb: (user: unknown) => void) => {
    handles.emitUser = cb
    handles.onUserChanged()
    return () => {}
  }
}))

beforeEach(() => {
  handles.flag!.value = true
  handles.onUserChanged.mockClear()
  handles.signOut.mockReset().mockResolvedValue(undefined)
  handles.google.mockReset()
  handles.github.mockReset()
  handles.isProvisioningError.mockReset().mockReturnValue(false)
  handles.emitUser = undefined
})

describe('AuthSignIn', () => {
  it('does not attach the Firebase listener when the auth flag is off', () => {
    handles.flag!.value = false
    render(AuthSignIn)

    expect(
      handles.onUserChanged,
      'a flag-off page must not load Firebase or attach its listener'
    ).not.toHaveBeenCalled()
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
