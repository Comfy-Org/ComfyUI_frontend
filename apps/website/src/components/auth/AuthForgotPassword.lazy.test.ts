import userEvent from '@testing-library/user-event'
import { render, screen, waitFor } from '@testing-library/vue'
import { beforeEach, describe, expect, it, vi } from 'vitest'

import { sendWorkshopPasswordReset } from '../../config/__mocks__/workshop-firebase'
import AuthForgotPassword from './AuthForgotPassword.vue'

const firebaseEvaluated = vi.hoisted(() => vi.fn())

vi.mock(import('../../scripts/posthog'))

vi.mock(import('../../config/workshop-firebase'), async () => {
  firebaseEvaluated()
  return import('../../config/__mocks__/workshop-firebase')
})

beforeEach(() => {
  vi.spyOn(window.location, 'assign').mockImplementation(() => {})
})

describe('AuthForgotPassword lazy-load boundary', () => {
  it('loads workshop-firebase only when a reset is sent, never on render', async () => {
    render(AuthForgotPassword)
    const user = userEvent.setup()
    await waitFor(() => expect(screen.getByLabelText(/email/i)).toBeEnabled())
    await user.type(screen.getByLabelText(/email/i), 'user@example.com')

    expect(
      firebaseEvaluated,
      'a render-time import ships firebase/app+auth to every visitor of /forgot-password'
    ).not.toHaveBeenCalled()

    await user.click(screen.getByRole('button', { name: /send reset link/i }))

    await waitFor(() => expect(firebaseEvaluated).toHaveBeenCalledOnce())
    await waitFor(() =>
      expect(sendWorkshopPasswordReset).toHaveBeenCalledWith('user@example.com')
    )
  })
})
