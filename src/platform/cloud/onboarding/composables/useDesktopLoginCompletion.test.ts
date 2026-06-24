import { beforeEach, describe, expect, it, vi } from 'vitest'

import { useDesktopLoginCompletion } from './useDesktopLoginCompletion'

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
    const { completeDesktopLoginForExistingSession } =
      useDesktopLoginCompletion()

    await completeDesktopLoginForExistingSession({}, onAuthSuccess)

    expect(onAuthSuccess).not.toHaveBeenCalled()
  })

  it('does nothing when the desktop login request has no existing user', async () => {
    const onAuthSuccess = vi.fn()
    const { completeDesktopLoginForExistingSession } =
      useDesktopLoginCompletion()

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
    const { completeDesktopLoginForExistingSession } =
      useDesktopLoginCompletion()

    await completeDesktopLoginForExistingSession(
      {
        desktop_login_callback: 'http://localhost:9876/callback',
        desktop_login_state: 'state-123'
      },
      onAuthSuccess
    )

    expect(onAuthSuccess).toHaveBeenCalledOnce()
  })

  it('dedupes concurrent completions for the same desktop login request', async () => {
    hoisted.authStore.currentUser = { uid: 'user-123' }
    const firstOnAuthSuccess = vi.fn().mockResolvedValue(undefined)
    const latestOnAuthSuccess = vi.fn().mockResolvedValue(undefined)
    const { completeDesktopLoginForExistingSession } =
      useDesktopLoginCompletion()
    const query = {
      desktop_login_callback: 'http://localhost:9876/callback',
      desktop_login_state: 'state-123'
    }

    await Promise.all([
      completeDesktopLoginForExistingSession(query, firstOnAuthSuccess),
      completeDesktopLoginForExistingSession(query, latestOnAuthSuccess)
    ])

    expect(firstOnAuthSuccess).not.toHaveBeenCalled()
    expect(latestOnAuthSuccess).toHaveBeenCalledOnce()
  })
})
