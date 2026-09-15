import userEvent from '@testing-library/user-event'
import { render, screen, waitFor } from '@testing-library/vue'
import { beforeEach, describe, expect, it, vi } from 'vitest'

import { removeAllToasts, useAuthToasts } from '../../config/auth-toast-state'
import AuthForgotPassword from './AuthForgotPassword.vue'

// A forgot-password form must answer an unregistered address exactly as it
// answers a registered one, or it becomes an oracle for which addresses hold
// accounts. These live in their own file because the main spec deliberately
// abandons sends in flight, and a confirmation left over from one of those
// would let these pass without submitting anything.

const h = vi.hoisted(() => ({
  flag: undefined as { value: boolean } | undefined,
  sendReset: vi.fn(),
  captureAuthFailed: vi.fn()
}))

vi.mock<unknown>(import('../../scripts/posthog'), async () => {
  const { ref } = await import('vue')
  const flag = ref(true)
  h.flag = flag
  return {
    useWorkshopAuthFlag: () => flag,
    captureAuthFailed: h.captureAuthFailed
  }
})

vi.mock<unknown>(import('../../config/workshop-firebase'), () => ({
  sendWorkshopPasswordReset: h.sendReset
}))

const { messages: toasts } = useAuthToasts()
const assign = vi.fn<(url: string | URL) => void>()

beforeEach(() => {
  h.flag!.value = true
  h.sendReset.mockReset().mockResolvedValue(undefined)
  h.captureAuthFailed.mockClear()
  removeAllToasts()
  window.history.replaceState({}, '', '/')
  assign.mockReset()
  vi.spyOn(window.location, 'assign').mockImplementation(assign)
})

async function submitAddress(address: string) {
  const user = userEvent.setup()
  const input = screen.getByLabelText(/email/i)
  await waitFor(() => expect(input).toBeEnabled())
  await user.type(input, address)
  await user.click(screen.getByRole('button', { name: /send reset link/i }))
}

describe('AuthForgotPassword account enumeration', () => {
  it.for([
    ['an address Firebase accepts silently', undefined],
    ['an address Firebase says does not exist', 'auth/user-not-found']
  ] as const)('confirms %s like a registered one', async ([, code]) => {
    if (code) {
      h.sendReset.mockRejectedValue({ code, message: 'no user record' })
    }
    render(AuthForgotPassword)

    await submitAddress('nobody@example.com')

    // Precondition: this render really submitted, so nothing below can pass
    // on a confirmation someone else put on screen.
    await waitFor(() =>
      expect(h.sendReset).toHaveBeenCalledWith('nobody@example.com')
    )
    expect((await screen.findByRole('alert')).textContent).toContain(
      'Password reset sent'
    )
    expect(toasts.value).toEqual([
      expect.objectContaining({
        severity: 'success',
        summary: 'Password reset email sent'
      })
    ])
    expect(
      h.captureAuthFailed,
      'reporting a failure would leak the fact the screen is hiding'
    ).not.toHaveBeenCalled()
  })
})
