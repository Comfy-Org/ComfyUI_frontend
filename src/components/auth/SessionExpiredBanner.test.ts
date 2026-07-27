import { render, screen } from '@testing-library/vue'
import userEvent from '@testing-library/user-event'
import { beforeEach, describe, expect, it, vi } from 'vitest'

import SessionExpiredBanner from '@/components/auth/SessionExpiredBanner.vue'

// vi.hoisted runs before `vue` is importable, so the refs are created inside
// the mock factories below and handed back here for the tests to drive.
const mocks = vi.hoisted(() => ({
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

beforeEach(() => {
  vi.clearAllMocks()
  mocks.suspended.value = false
  mocks.isReauthenticating.value = false
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

  it('re-authenticates in place when the action is used', async () => {
    mocks.suspended.value = true
    render(SessionExpiredBanner)

    await userEvent.click(screen.getByRole('button'))

    expect(mocks.reauthenticate).toHaveBeenCalledTimes(1)
  })

  it('announces itself assertively, since it blocks all cloud work', () => {
    mocks.suspended.value = true

    render(SessionExpiredBanner)

    const banner = screen.getByTestId('session-expired-banner')
    expect(banner.getAttribute('role')).toBe('alert')
    expect(banner.getAttribute('aria-live')).toBe('assertive')
  })
})
