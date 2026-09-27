import userEvent from '@testing-library/user-event'
import { render, screen, waitFor } from '@testing-library/vue'
import { expect, it, vi } from 'vitest'
import { nextTick } from 'vue'

import AuthForgotPassword from './AuthForgotPassword.vue'

vi.mock(import('../../scripts/posthog'))
vi.mock(
  import('../../config/workshop-firebase'),
  () => new Promise<never>(() => {})
)

it('re-enables the send after a stalled Firebase load so it stays retryable', async () => {
  render(AuthForgotPassword)
  const user = userEvent.setup()
  const input = screen.getByLabelText(/email/i)
  await waitFor(() => expect(input).toBeEnabled())
  await user.type(input, 'user@example.com')
  await user.click(screen.getByRole('button', { name: /send reset link/i }))

  const send = () => screen.getByRole('button', { name: /send/i })
  expect(send().hasAttribute('disabled')).toBe(true)

  await vi.advanceTimersByTimeAsync(16_000)
  await Promise.resolve()
  await nextTick()

  expect(
    send().hasAttribute('disabled'),
    'a Firebase load that never resolves must not leave the control disabled forever'
  ).toBe(false)
})
