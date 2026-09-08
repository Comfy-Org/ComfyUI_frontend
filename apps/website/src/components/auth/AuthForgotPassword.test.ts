// @vitest-environment happy-dom
import userEvent from '@testing-library/user-event'
import { render, screen, waitFor } from '@testing-library/vue'
import { beforeEach, describe, expect, it, vi } from 'vitest'

import { removeAllToasts, useAuthToasts } from '../../config/auth-toast-state'
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
  h.sendReset.mockReset().mockResolvedValue(undefined)
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

  it('shows the same confirmation for an unregistered email, not an error oracle', async () => {
    h.sendReset.mockRejectedValue({
      code: 'auth/user-not-found',
      message: 'x'
    })
    render(AuthForgotPassword)
    await typeEmail('ghost@example.com')
    await clickSend()

    expect(
      (await screen.findByRole('alert')).textContent,
      'an unregistered email must look identical to a registered one'
    ).toContain('Password reset sent')
    expect(toasts.value).toHaveLength(1)
    expect(screen.queryByText(/failed to send/i)).toBeNull()
  })

  it('surfaces a real transport failure inline with no toast and no redirect', async () => {
    h.sendReset.mockRejectedValue({
      code: 'auth/network-request-failed',
      message: 'x'
    })
    render(AuthForgotPassword)
    await typeEmail('user@example.com')
    await clickSend()

    expect((await screen.findByRole('alert')).textContent).toContain(
      'Failed to send password reset email'
    )
    expect(toasts.value).toHaveLength(0)
    await vi.advanceTimersByTimeAsync(3000)
    expect(assign).not.toHaveBeenCalled()
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

describe('AuthForgotPassword lazy-load boundary', () => {
  it('loads workshop-firebase only inside submit, never at module scope', () => {
    const rawSources = import.meta.glob<string>('./AuthForgotPassword.vue', {
      query: '?raw',
      import: 'default',
      eager: true
    })
    const source = rawSources['./AuthForgotPassword.vue']

    expect(
      /^import[^(]*from '\.\.\/\.\.\/config\/workshop-firebase'/m.test(source),
      'a static import ships firebase/app+auth to every flag-off visitor of /forgot-password'
    ).toBe(false)
    expect(source).toContain("import('../../config/workshop-firebase')")
  })
})
