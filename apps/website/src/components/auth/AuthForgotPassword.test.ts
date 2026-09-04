// @vitest-environment happy-dom
import userEvent from '@testing-library/user-event'
import { render, screen, waitFor } from '@testing-library/vue'
import { beforeEach, describe, expect, it, vi } from 'vitest'

import AuthForgotPassword from './AuthForgotPassword.vue'

const h = vi.hoisted(() => ({
  flag: undefined as { value: boolean } | undefined,
  sendReset: vi.fn()
}))

vi.mock('../../scripts/posthog', async () => {
  const { ref } = await import('vue')
  const flag = ref(true)
  h.flag = flag
  return { useWorkshopAuthFlag: () => flag }
})

vi.mock('../../config/workshop-firebase', () => ({
  sendWorkshopPasswordReset: h.sendReset
}))

const typeEmail = (value: string) =>
  userEvent.setup().type(screen.getByLabelText(/email/i), value)

beforeEach(() => {
  h.flag!.value = true
  h.sendReset.mockReset().mockResolvedValue(undefined)
})

describe('AuthForgotPassword', () => {
  it('renders nothing while the flag is off', () => {
    h.flag!.value = false
    render(AuthForgotPassword)
    expect(screen.queryByRole('heading')).toBeNull()
  })

  it('shows the sent confirmation after a successful send', async () => {
    render(AuthForgotPassword)
    await typeEmail('user@example.com')
    await userEvent
      .setup()
      .click(screen.getByRole('button', { name: /send reset link/i }))

    expect(await screen.findByRole('status')).toBeTruthy()
    expect(h.sendReset).toHaveBeenCalledWith('user@example.com')
  })

  it('validates the email before sending', async () => {
    render(AuthForgotPassword)
    await typeEmail('nope')
    await userEvent
      .setup()
      .click(screen.getByRole('button', { name: /send reset link/i }))

    expect(screen.getByRole('alert')).toBeTruthy()
    expect(h.sendReset).not.toHaveBeenCalled()
  })

  it('shows the same confirmation for an unregistered email, not an error oracle', async () => {
    h.sendReset.mockRejectedValue({
      code: 'auth/user-not-found',
      message: 'x'
    })
    render(AuthForgotPassword)
    await typeEmail('ghost@example.com')
    await userEvent
      .setup()
      .click(screen.getByRole('button', { name: /send reset link/i }))

    expect(
      await screen.findByRole('status'),
      'an unregistered email must look identical to a registered one'
    ).toBeTruthy()
    expect(screen.queryByText(/could not be sent/i)).toBeNull()
  })

  it('surfaces a real transport failure as an error', async () => {
    h.sendReset.mockRejectedValue({
      code: 'auth/network-request-failed',
      message: 'x'
    })
    render(AuthForgotPassword)
    await typeEmail('user@example.com')
    await userEvent
      .setup()
      .click(screen.getByRole('button', { name: /send reset link/i }))

    expect(await screen.findByText(/could not be sent/i)).toBeTruthy()
  })

  it('blocks a double submit while a send is in flight', async () => {
    let release!: () => void
    h.sendReset.mockImplementation(
      () => new Promise<void>((resolve) => (release = resolve))
    )
    render(AuthForgotPassword)
    await typeEmail('user@example.com')
    const button = screen.getByRole('button', { name: /send reset link/i })
    await userEvent.setup().click(button)
    await userEvent.setup().click(button)

    release()
    await waitFor(() => expect(h.sendReset).toHaveBeenCalledOnce())
  })
})
