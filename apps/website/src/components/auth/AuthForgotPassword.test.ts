// @vitest-environment happy-dom
import userEvent from '@testing-library/user-event'
import { render, screen, waitFor } from '@testing-library/vue'
import { beforeEach, describe, expect, it, vi } from 'vitest'

import { removeAllToasts, useAuthToasts } from '../../config/auth-toast-state'
import AuthForgotPassword from './AuthForgotPassword.vue'

const h = vi.hoisted(() => ({
  flag: undefined as { value: boolean } | undefined,
  settled: undefined as { value: boolean } | undefined,
  sendReset: vi.fn(),
  captureAuthFailed: vi.fn()
}))

vi.mock('../../scripts/posthog', async () => {
  const { ref } = await import('vue')
  const flag = ref(true)
  const settled = ref(true)
  h.flag = flag
  h.settled = settled
  return {
    useWorkshopAuthFlag: () => flag,
    useWorkshopAuthFlagSettled: () => settled,
    captureAuthFailed: h.captureAuthFailed
  }
})

vi.mock('../../config/workshop-firebase', () => ({
  sendWorkshopPasswordReset: h.sendReset
}))

const { messages: toasts } = useAuthToasts()
const assign = vi.fn<(url: string | URL) => void>()

const typeEmail = (value: string) =>
  userEvent.setup().type(screen.getByLabelText(/email/i), value)
const clickSend = () =>
  userEvent
    .setup()
    .click(screen.getByRole('button', { name: /send reset link/i }))

beforeEach(() => {
  h.flag!.value = true
  h.settled!.value = true
  h.sendReset.mockReset().mockResolvedValue(undefined)
  h.captureAuthFailed.mockClear()
  removeAllToasts()
  window.history.replaceState({}, '', '/')
  assign.mockReset()
  vi.spyOn(window.location, 'assign').mockImplementation(assign)
})

describe('AuthForgotPassword', () => {
  it('renders nothing while the flag is off', () => {
    h.flag!.value = false
    render(AuthForgotPassword)
    expect(screen.queryByRole('heading')).toBeNull()
  })

  it('keeps the send button disabled until an email is typed', async () => {
    render(AuthForgotPassword)
    const button = screen.getByRole('button', {
      name: /send reset link/i
    }) as HTMLButtonElement

    expect(button.disabled).toBe(true)
    await typeEmail('user@example.com')
    expect(button.disabled).toBe(false)
  })

  it('confirms inline, toasts for five seconds, and returns to login after three', async () => {
    render(AuthForgotPassword)
    await typeEmail('user@example.com')
    await clickSend()

    expect((await screen.findByRole('alert')).textContent).toContain(
      'Password reset sent'
    )
    expect(h.sendReset).toHaveBeenCalledWith('user@example.com')
    expect(toasts.value).toEqual([
      expect.objectContaining({
        severity: 'success',
        summary: 'Password reset email sent',
        life: 5000
      })
    ])

    expect(
      assign,
      'the confirmation shows before the return'
    ).not.toHaveBeenCalled()
    await vi.advanceTimersByTimeAsync(3000)
    expect(assign).toHaveBeenCalledWith('/login/')
  })

  it('carries the return destination into the post-send redirect', async () => {
    window.history.replaceState(
      {},
      '',
      '/forgot-password/?returnTo=%2Fworkshop%2Fmodels%2Fexample%2F'
    )
    render(AuthForgotPassword)
    await typeEmail('user@example.com')
    await clickSend()
    await screen.findByRole('alert')

    await vi.advanceTimersByTimeAsync(3000)
    expect(assign).toHaveBeenCalledWith(
      '/login/?returnTo=%2Fworkshop%2Fmodels%2Fexample%2F'
    )
  })

  it("toasts the cloud app's line for an unregistered email, then still confirms and returns to login", async () => {
    h.sendReset.mockRejectedValue({
      code: 'auth/user-not-found',
      message: 'x'
    })
    render(AuthForgotPassword)
    await typeEmail('ghost@example.com')
    await clickSend()

    expect(
      (await screen.findByRole('alert')).textContent,
      'the cloud page shows its inline confirmation even after a failed send'
    ).toContain('Password reset sent')
    expect(toasts.value.map((toast) => toast.severity)).toEqual([
      'error',
      'success'
    ])
    expect(toasts.value[0].detail).toContain('No account found with this email')
    expect(h.captureAuthFailed).toHaveBeenCalledWith({
      error_code: 'auth/user-not-found',
      auth_action: 'password_reset'
    })
    await vi.advanceTimersByTimeAsync(3000)
    expect(assign).toHaveBeenCalledWith('/login/')
  })

  it('toasts a transport failure the same way and still returns to login', async () => {
    h.sendReset.mockRejectedValue({
      code: 'auth/network-request-failed',
      message: 'x'
    })
    render(AuthForgotPassword)
    await typeEmail('user@example.com')
    await clickSend()

    await screen.findByRole('alert')
    expect(toasts.value[0]).toMatchObject({
      severity: 'error',
      detail: expect.stringContaining('Network error')
    })
    await vi.advanceTimersByTimeAsync(3000)
    expect(assign).toHaveBeenCalledWith('/login/')
  })

  it("shows the cloud app's timeout copy when the flag never answers", async () => {
    h.flag!.value = false
    h.settled!.value = false
    render(AuthForgotPassword)

    await vi.advanceTimersByTimeAsync(16_000)

    expect((await screen.findByRole('alert')).textContent).toContain(
      'Connection Taking Too Long'
    )
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

  it('carries a safe return destination back to login on click', async () => {
    window.history.replaceState(
      {},
      '',
      '/forgot-password/?returnTo=%2Fworkshop%2Fmodels%2Fexample%2F'
    )
    render(AuthForgotPassword)

    await userEvent
      .setup()
      .click(screen.getByRole('link', { name: /back to login/i }))

    expect(assign).toHaveBeenCalledWith(
      '/login/?returnTo=%2Fworkshop%2Fmodels%2Fexample%2F'
    )
  })

  it('keeps the plain href in markup so a pre-hydration click still reaches login', () => {
    window.history.replaceState(
      {},
      '',
      '/forgot-password/?returnTo=%2Fworkshop%2Fmodels%2Fexample%2F'
    )
    render(AuthForgotPassword)

    expect(
      screen.getByRole('link', { name: /back to login/i }).getAttribute('href'),
      'hydration never repairs a server-rendered href, so the destination is added at click time instead'
    ).toBe('/login/')
  })

  it('drops an unsafe cross-origin return destination', async () => {
    window.history.replaceState(
      {},
      '',
      '/forgot-password/?returnTo=https%3A%2F%2Fevil.example'
    )
    render(AuthForgotPassword)

    await userEvent
      .setup()
      .click(screen.getByRole('link', { name: /back to login/i }))

    expect(
      assign,
      'a cross-origin destination maps to the safe Workshop-home fallback, never the raw value'
    ).toHaveBeenCalledWith('/login/?returnTo=%2Fworkshop%2F')
  })
})
