// @vitest-environment happy-dom
import userEvent from '@testing-library/user-event'
import { render, screen, waitFor } from '@testing-library/vue'
import { beforeEach, describe, expect, it, vi } from 'vitest'

import AuthSignIn from './AuthSignIn.vue'

const handles = vi.hoisted(() => ({
  flag: undefined as { value: boolean } | undefined,
  user: undefined as { value: unknown } | undefined,
  signOut: vi.fn(),
  ensureFresh: vi.fn()
}))

vi.mock('../../scripts/posthog', async () => {
  const { ref } = await import('vue')
  const flag = ref(true)
  handles.flag = flag
  return { useWorkshopAuthFlag: () => flag }
})

vi.mock('../../config/workshop-session-state', async () => {
  const { ref } = await import('vue')
  const user = ref<unknown>(null)
  handles.user = user
  return {
    useWorkshopSession: () => ({
      user,
      ensureFresh: handles.ensureFresh,
      signOut: handles.signOut
    })
  }
})

vi.mock('../../config/workshop-firebase', () => ({
  signInWorkshopWithGoogle: vi.fn(),
  signInWorkshopWithGitHub: vi.fn(),
  warmWorkshopAuth: vi.fn().mockResolvedValue(undefined)
}))

beforeEach(() => {
  handles.flag!.value = true
  handles.user!.value = null
  handles.signOut.mockReset().mockResolvedValue(undefined)
  handles.ensureFresh.mockReset().mockResolvedValue({ status: 'ok' })
})

describe('AuthSignIn', () => {
  it('renders nothing when the auth flag is off', () => {
    handles.flag!.value = false
    render(AuthSignIn)

    expect(screen.queryByRole('heading')).toBeNull()
  })

  it('stays on the session-error surface when a sign-out retry fails, not a crash or false idle', async () => {
    handles.ensureFresh.mockResolvedValue({ status: 'error', reason: 'http' })
    handles.signOut.mockRejectedValue(new Error('network'))
    handles.user!.value = { email: 'a@b.co', displayName: null }
    render(AuthSignIn)

    const signOutButton = await screen.findByRole('button', {
      name: 'Sign out'
    })
    await userEvent.setup().click(signOutButton)

    await waitFor(() => expect(handles.signOut).toHaveBeenCalled())
    expect(screen.getByRole('button', { name: 'Sign out' })).toBeTruthy()
  })
})
