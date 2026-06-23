import { beforeEach, describe, expect, it, vi } from 'vitest'

import { completeDesktopLoginForExistingSession } from './useDesktopLoginCompletion'

const hoisted = vi.hoisted(() => ({
  authStore: {
    isInitialized: true,
    currentUser: null as unknown
  }
}))

vi.mock('@/stores/authStore', () => ({
  useAuthStore: () => hoisted.authStore
}))

describe('completeDesktopLoginForExistingSession', () => {
  beforeEach(() => {
    hoisted.authStore.isInitialized = true
    hoisted.authStore.currentUser = null
  })

  it('does nothing without a desktop login request', async () => {
    const onAuthSuccess = vi.fn()

    await completeDesktopLoginForExistingSession({}, onAuthSuccess)

    expect(onAuthSuccess).not.toHaveBeenCalled()
  })

  it('does nothing when the desktop login request has no existing user', async () => {
    const onAuthSuccess = vi.fn()

    await completeDesktopLoginForExistingSession(
      {
        desktop_login_callback: 'http://localhost:9876/callback',
        desktop_login_state: 'state-123'
      },
      onAuthSuccess
    )

    expect(onAuthSuccess).not.toHaveBeenCalled()
  })

  it('completes the desktop login request for an existing user', async () => {
    hoisted.authStore.currentUser = { uid: 'user-123' }
    const onAuthSuccess = vi.fn().mockResolvedValue(undefined)

    await completeDesktopLoginForExistingSession(
      {
        desktop_login_callback: 'http://localhost:9876/callback',
        desktop_login_state: 'state-123'
      },
      onAuthSuccess
    )

    expect(onAuthSuccess).toHaveBeenCalledOnce()
  })
})
