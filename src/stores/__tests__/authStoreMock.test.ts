import { describe, expect, it } from 'vitest'

import { createAuthStoreMock, mockAuthStoreModule } from './authStoreMock'

describe('authStoreMock', () => {
  it('creates a mock with reactive computed properties', () => {
    const { mock, controls } = createAuthStoreMock()

    expect(mock.isAuthenticated).toBe(false)
    expect(mock.userEmail).toBeNull()
    expect(mock.userId).toBeNull()

    controls.currentUser.value = { uid: 'u1', email: 'a@b.com' }

    expect(mock.isAuthenticated).toBe(true)
    expect(mock.userEmail).toBe('a@b.com')
    expect(mock.userId).toBe('u1')
  })

  it('starts with clean defaults', () => {
    const { controls } = createAuthStoreMock()
    expect(controls.currentUser.value).toBeNull()
    expect(controls.isInitialized.value).toBe(false)
    expect(controls.loading.value).toBe(false)
    expect(controls.balance.value).toBeNull()
    expect(controls.isFetchingBalance.value).toBe(false)
  })

  it('creates independent instances per call', () => {
    const a = createAuthStoreMock()
    const b = createAuthStoreMock()
    a.controls.currentUser.value = { uid: 'a' }
    expect(b.mock.isAuthenticated).toBe(false)
  })

  it('mockAuthStoreModule wraps mock correctly', () => {
    const { mock } = createAuthStoreMock()
    const module = mockAuthStoreModule(mock)
    expect(module.useAuthStore()).toBe(mock)
    expect(new module.AuthStoreError('test').name).toBe('AuthStoreError')
  })
})
