// @vitest-environment happy-dom
import userEvent from '@testing-library/user-event'
import { render, screen, waitFor } from '@testing-library/vue'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { nextTick } from 'vue'

import { removeAllToasts, useAuthToasts } from '../../config/auth-toast-state'
import AuthForgotPassword from './AuthForgotPassword.vue'

const h = vi.hoisted(() => ({
  flag: undefined as { value: boolean } | undefined,
  settled: undefined as { value: boolean } | undefined,
  sendReset: vi.fn(),
  captureAuthFailed: vi.fn()
}))

vi.mock<unknown>(import('../../scripts/posthog'), async () => {
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

vi.mock<unknown>(import('../../config/workshop-firebase'), () => ({
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

// Fake timers are on, so a late resolve settles on the microtask queue rather
// than any real delay; drain the queue and let Vue react without a sleep.
const flushMicrotasks = async () => {
  await Promise.resolve()
  await nextTick()
}

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

  it.for([
    ['auth/too-many-requests', 'Too many login attempts'],
    ['auth/network-request-failed', 'Network error']
  ] as const)(
    'keeps %s an error: no confirmation, no redirect, and the send can be retried',
    async ([code, detail]) => {
      h.sendReset.mockRejectedValue({ code, message: 'x' })
      render(AuthForgotPassword)
      await typeEmail('user@example.com')
      await clickSend()

      await waitFor(() =>
        expect(toasts.value[0]).toMatchObject({
          severity: 'error',
          detail: expect.stringContaining(detail)
        })
      )
      expect(
        screen.queryByText('Password reset sent'),
        'nothing was sent, so nothing may claim it was'
      ).toBeNull()
      expect(h.captureAuthFailed).toHaveBeenCalledWith({
        error_code: code,
        auth_action: 'password_reset'
      })
      await vi.advanceTimersByTimeAsync(3000)
      expect(assign).not.toHaveBeenCalled()
      expect(
        screen.getByRole('button', { name: /send/i }).hasAttribute('disabled')
      ).toBe(false)
    }
  )

  it('rejects a malformed address before asking Firebase', async () => {
    render(AuthForgotPassword)
    await typeEmail('not-an-email')
    await clickSend()

    expect((await screen.findByRole('alert')).textContent).toContain(
      'valid email'
    )
    expect(h.sendReset).not.toHaveBeenCalled()
  })

  it('sends once: the button stays disabled after a confirmed send', async () => {
    render(AuthForgotPassword)
    await typeEmail('user@example.com')
    await clickSend()
    await screen.findByRole('alert')

    const send = screen.getByRole('button', { name: /send/i })
    expect(send.hasAttribute('disabled')).toBe(true)
    await clickSend()
    expect(h.sendReset).toHaveBeenCalledOnce()
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

  it('drops the timeout screen when a late answer says the flag is off', async () => {
    h.flag!.value = false
    h.settled!.value = false
    render(AuthForgotPassword)
    await vi.advanceTimersByTimeAsync(16_000)
    await screen.findByRole('alert')

    h.settled!.value = true

    await waitFor(() =>
      expect(
        screen.queryByText('Connection Taking Too Long'),
        'a flag that answered off renders nothing, not a troubleshooting screen'
      ).toBeNull()
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

  it('drops a send abandoned by the flag turning off: no success toast, no redirect', async () => {
    let release!: () => void
    h.sendReset.mockImplementation(
      () => new Promise<void>((resolve) => (release = resolve))
    )
    render(AuthForgotPassword)
    await typeEmail('user@example.com')
    await clickSend()

    h.flag!.value = false
    release()
    await flushMicrotasks()

    expect(
      toasts.value,
      'a request abandoned mid-flight must not toast success when it resolves late'
    ).toEqual([])
    await vi.advanceTimersByTimeAsync(3000)
    expect(
      assign,
      'and must not schedule a redirect back to login'
    ).not.toHaveBeenCalled()
  })

  it('drops a send abandoned by unmount: no success toast when it resolves late', async () => {
    let release!: () => void
    h.sendReset.mockImplementation(
      () => new Promise<void>((resolve) => (release = resolve))
    )
    const { unmount } = render(AuthForgotPassword)
    await typeEmail('user@example.com')
    await clickSend()

    unmount()
    release()
    await flushMicrotasks()

    expect(
      toasts.value,
      'an unmounted flow may not toast success when its request resolves late'
    ).toEqual([])
    await vi.advanceTimersByTimeAsync(3000)
    expect(
      assign,
      'an unmounted flow may not schedule a redirect when its request resolves late'
    ).not.toHaveBeenCalled()
  })

  it('drops a send abandoned by the flag turning off when it rejects late: no error toast', async () => {
    let reject!: (reason: unknown) => void
    h.sendReset.mockImplementation(
      () => new Promise<void>((_resolve, rejectFn) => (reject = rejectFn))
    )
    render(AuthForgotPassword)
    await typeEmail('user@example.com')
    await clickSend()

    h.flag!.value = false
    reject({ code: 'auth/network-request-failed', message: 'x' })
    await flushMicrotasks()

    expect(
      toasts.value,
      'a request abandoned mid-flight must not toast an error when it rejects late'
    ).toEqual([])
    expect(
      h.captureAuthFailed,
      'and must not report a failure for a request nobody is waiting on'
    ).not.toHaveBeenCalled()
  })

  it('drops a send abandoned by unmount when it rejects late: no error toast', async () => {
    let reject!: (reason: unknown) => void
    h.sendReset.mockImplementation(
      () => new Promise<void>((_resolve, rejectFn) => (reject = rejectFn))
    )
    const { unmount } = render(AuthForgotPassword)
    await typeEmail('user@example.com')
    await clickSend()

    unmount()
    reject({ code: 'auth/network-request-failed', message: 'x' })
    await flushMicrotasks()

    expect(
      toasts.value,
      'an unmounted flow may not toast an error when its request rejects late'
    ).toEqual([])
  })

  it('re-enables the send after a stalled reset so it stays retryable', async () => {
    h.sendReset.mockImplementation(() => new Promise<void>(() => {}))
    render(AuthForgotPassword)
    await typeEmail('user@example.com')
    await clickSend()

    const send = screen.getByRole('button', { name: /send/i })
    expect(send.hasAttribute('disabled')).toBe(true)

    await vi.advanceTimersByTimeAsync(16_000)

    expect(
      send.hasAttribute('disabled'),
      'a reset that never resolves must not leave the control disabled forever'
    ).toBe(false)
  })

  it('re-enables the send immediately when the flag flickers off then back on mid-send', async () => {
    h.sendReset.mockImplementation(() => new Promise<void>(() => {}))
    render(AuthForgotPassword)
    await typeEmail('user@example.com')
    await clickSend()

    const send = screen.getByRole('button', { name: /send/i })
    expect(send.hasAttribute('disabled')).toBe(true)

    h.flag!.value = false
    h.flag!.value = true
    await nextTick()

    expect(
      screen.getByRole('button', { name: /send/i }).hasAttribute('disabled'),
      'a flag that flickers back on before the bounding timeout must leave the form retryable, not stuck disabled'
    ).toBe(false)
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

  it('hydrates the validated return destination into the login link', async () => {
    window.history.replaceState(
      {},
      '',
      '/forgot-password/?returnTo=%2Fworkshop%2Fmodels%2Fexample%2F'
    )
    render(AuthForgotPassword)

    await waitFor(() =>
      expect(
        screen
          .getByRole('link', { name: /back to login/i })
          .getAttribute('href'),
        'the native link should preserve the destination after hydration'
      ).toBe('/login/?returnTo=%2Fworkshop%2Fmodels%2Fexample%2F')
    )
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
    ).toHaveBeenCalledWith('/login/?returnTo=%2Fmodels%2F')
  })
})
