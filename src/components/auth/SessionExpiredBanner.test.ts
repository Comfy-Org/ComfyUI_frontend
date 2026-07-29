import { render, screen } from '@testing-library/vue'
import userEvent from '@testing-library/user-event'
import { beforeEach, describe, expect, it, vi } from 'vitest'

import SessionExpiredBanner from '@/components/auth/SessionExpiredBanner.vue'

// vi.hoisted runs before `vue` is importable, so the refs are created inside
// the mock factories below and handed back here for the tests to drive.
const mocks = vi.hoisted(() => ({
  route: { name: 'GraphView', path: '/' } as { name: string; path: string },
  suspended: { value: false } as { value: boolean },
  reauthenticate: vi.fn(),
  isReauthenticating: { value: false } as { value: boolean }
}))

// The factory runs after imports resolve, so a real ref can be built here and
// driven from the plain holder above.
vi.mock('@/platform/auth/session/sessionExpiry', async () => {
  const { shallowRef } = await import('vue')
  mocks.suspended = shallowRef(false)
  return { sessionSuspended: mocks.suspended }
})

vi.mock('@/composables/auth/useSessionReauth', async () => {
  const { shallowRef } = await import('vue')
  mocks.isReauthenticating = shallowRef(false)
  return {
    useSessionReauth: () => ({
      reauthenticate: mocks.reauthenticate,
      isReauthenticating: mocks.isReauthenticating
    })
  }
})

vi.mock('vue-i18n', () => ({
  useI18n: () => ({ t: (key: string) => key })
}))

vi.mock('vue-router', () => ({
  useRoute: () => mocks.route
}))

beforeEach(() => {
  vi.clearAllMocks()
  mocks.suspended.value = false
  mocks.isReauthenticating.value = false
  mocks.route = { name: 'GraphView', path: '/' }
})

describe('SessionExpiredBanner', () => {
  it('stays out of the way while the session is healthy', () => {
    render(SessionExpiredBanner)

    expect(screen.queryByTestId('session-expired-banner')).toBeNull()
  })

  it('warns about unsaved work when the session is suspended', () => {
    mocks.suspended.value = true

    render(SessionExpiredBanner)

    expect(screen.getByTestId('session-expired-banner')).toBeTruthy()
    // The warning is the point: the user must know to export before acting.
    expect(screen.getByText('auth.sessionExpired.detail')).toBeTruthy()
  })

  it('stays away from signed-out routes, where there is nothing to export', () => {
    mocks.suspended.value = true
    mocks.route = { name: 'cloud-login', path: '/cloud/login' }

    render(SessionExpiredBanner)

    expect(screen.queryByTestId('session-expired-banner')).toBeNull()
  })

  it('re-authenticates in place when the action is used', async () => {
    mocks.suspended.value = true
    render(SessionExpiredBanner)

    await userEvent.click(screen.getByRole('button'))

    expect(mocks.reauthenticate).toHaveBeenCalledTimes(1)
  })

  it('disables its own action while the sign-in it started is still open', () => {
    mocks.suspended.value = true
    mocks.isReauthenticating.value = true

    render(SessionExpiredBanner)

    // The popup is the recovery step; leaving the button live invites a second
    // one on top of it.
    expect(screen.getByRole('button').hasAttribute('disabled')).toBe(true)
  })

  it('announces itself assertively, since it blocks all cloud work', () => {
    mocks.suspended.value = true

    render(SessionExpiredBanner)

    // The shared popup is a polite status by default; this one interrupts,
    // because the user has unsaved work and every cloud request is failing.
    const banner = screen.getByTestId('session-expired-banner')
    expect(banner.getAttribute('role')).toBe('alert')
    expect(banner.getAttribute('aria-live')).toBe('assertive')
  })
})
