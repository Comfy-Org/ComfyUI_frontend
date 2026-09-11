// @vitest-environment happy-dom
import userEvent from '@testing-library/user-event'
import { render, screen, waitFor } from '@testing-library/vue'
import { beforeEach, describe, expect, it, vi } from 'vitest'

import AuthForgotPassword from './AuthForgotPassword.vue'

const h = vi.hoisted(() => ({
  sendReset: vi.fn(),
  firebaseEvaluated: vi.fn()
}))

vi.mock<unknown>(import('../../scripts/posthog'), async () => {
  const { ref } = await import('vue')
  return {
    useWorkshopAuthFlag: () => ref(true),
    useWorkshopAuthFlagSettled: () => ref(true),
    captureAuthFailed: vi.fn()
  }
})

vi.mock<unknown>(import('../../config/workshop-firebase'), () => {
  h.firebaseEvaluated()
  return { sendWorkshopPasswordReset: h.sendReset }
})

beforeEach(() => {
  h.sendReset.mockReset().mockResolvedValue(undefined)
  vi.spyOn(window.location, 'assign').mockImplementation(() => {})
})

describe('AuthForgotPassword lazy-load boundary', () => {
  it('loads workshop-firebase only when a reset is sent, never on render', async () => {
    render(AuthForgotPassword)
    const user = userEvent.setup()
    await user.type(screen.getByLabelText(/email/i), 'user@example.com')

    expect(
      h.firebaseEvaluated,
      'a render-time import ships firebase/app+auth to every visitor of /forgot-password'
    ).not.toHaveBeenCalled()

    await user.click(screen.getByRole('button', { name: /send reset link/i }))

    await waitFor(() => expect(h.firebaseEvaluated).toHaveBeenCalledOnce())
    expect(h.sendReset).toHaveBeenCalledWith('user@example.com')
  })
})
