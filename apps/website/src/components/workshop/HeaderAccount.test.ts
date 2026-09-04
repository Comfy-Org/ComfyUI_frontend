// @vitest-environment happy-dom
import { render, screen } from '@testing-library/vue'
import { beforeEach, describe, expect, it, vi } from 'vitest'

import HeaderAccount from './HeaderAccount.vue'

const h = vi.hoisted(() => ({
  flag: undefined as { value: boolean } | undefined,
  user: undefined as { value: unknown } | undefined,
  session: undefined as { value: unknown } | undefined,
  balance: undefined as { value: unknown } | undefined
}))

vi.mock('../../scripts/posthog', async () => {
  const { ref } = await import('vue')
  const flag = ref(true)
  h.flag = flag
  return { useWorkshopAuthFlag: () => flag }
})

vi.mock('../../config/workshop-session-state', async () => {
  const { ref } = await import('vue')
  const user = ref<unknown>(null)
  const session = ref<unknown>(undefined)
  h.user = user
  h.session = session
  return {
    useWorkshopSession: () => ({
      user,
      session,
      ensureFresh: vi.fn(),
      signOut: vi.fn()
    })
  }
})

vi.mock('../../config/workshop-credits', async () => {
  const { ref } = await import('vue')
  const balance = ref<unknown>({ status: 'unknown' })
  h.balance = balance
  return { useWorkshopCredits: () => ({ balance }) }
})

const workspace = { id: 'ws', name: 'Personal', type: 'personal' as const }

beforeEach(() => {
  h.flag!.value = true
  h.user!.value = null
  h.session!.value = undefined
  h.balance!.value = { status: 'unknown' }
})

describe('HeaderAccount', () => {
  it('renders nothing while the flag is off', () => {
    h.flag!.value = false
    render(HeaderAccount)
    expect(screen.queryByRole('link', { name: /sign in/i })).toBeNull()
    expect(screen.queryByRole('button')).toBeNull()
  })

  it('shows a sign-in link when signed out', () => {
    render(HeaderAccount)
    expect(screen.getByRole('link', { name: /sign in/i })).toBeTruthy()
  })

  it('shows a session-retry control when a user has no workspace session', () => {
    h.user!.value = { email: 'a@b.co', displayName: null }
    h.session!.value = undefined
    render(HeaderAccount)
    expect(screen.getByRole('button', { name: /session error/i })).toBeTruthy()
  })

  it('shows the account control with the credits chip when signed in', () => {
    h.user!.value = { email: 'a@b.co', displayName: 'Ada' }
    h.session!.value = { token: 'jwt', uid: 'user-1', workspace, role: 'owner' }
    h.balance!.value = { status: 'ok', credits: 1234 }
    render(HeaderAccount)

    expect(screen.getByRole('button', { name: /account/i })).toBeTruthy()
    expect(screen.getByText(/1,234/)).toBeTruthy()
  })

  it('speaks the balance in the account button name, not just on screen', () => {
    h.user!.value = { email: 'a@b.co', displayName: 'Ada' }
    h.session!.value = { token: 'jwt', uid: 'user-1', workspace, role: 'owner' }
    h.balance!.value = { status: 'ok', credits: 1234 }
    render(HeaderAccount)

    // A bare aria-label="Account" would win over the child text and leave the
    // balance unspoken; the accessible name must carry it.
    expect(screen.getByRole('button', { name: /1,234 credits/i })).toBeTruthy()
  })

  it('omits the credits number when the balance is in error', () => {
    h.user!.value = { email: 'a@b.co', displayName: 'Ada' }
    h.session!.value = { token: 'jwt', uid: 'user-1', workspace, role: 'owner' }
    h.balance!.value = { status: 'error' }
    render(HeaderAccount)

    expect(screen.getByRole('button', { name: /account/i })).toBeTruthy()
    expect(screen.queryByText(/credits/i)).toBeNull()
  })
})
