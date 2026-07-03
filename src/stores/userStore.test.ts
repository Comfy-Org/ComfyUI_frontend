import { createTestingPinia } from '@pinia/testing'
import { setActivePinia } from 'pinia'
import { beforeEach, describe, expect, it, vi } from 'vitest'

import { useUserStore } from './userStore'

const apiMock = vi.hoisted(() => ({
  createUser: vi.fn(),
  getUserConfig: vi.fn(),
  user: undefined as string | undefined
}))

vi.mock('@/scripts/api', () => ({
  api: apiMock
}))

describe('userStore', () => {
  beforeEach(() => {
    setActivePinia(createTestingPinia({ stubActions: false }))
    apiMock.createUser.mockReset()
    apiMock.getUserConfig.mockReset()
    apiMock.user = undefined
    localStorage.clear()
  })

  describe('initialize', () => {
    it('returns an empty user list before initialization', () => {
      const store = useUserStore()

      expect(store.users).toEqual([])
    })

    it('fetches user config on first call', async () => {
      apiMock.getUserConfig.mockResolvedValue({})
      const store = useUserStore()

      await store.initialize()

      expect(apiMock.getUserConfig).toHaveBeenCalledTimes(1)
      expect(store.initialized).toBe(true)
    })

    it('is a no-op once already initialized', async () => {
      apiMock.getUserConfig.mockResolvedValue({})
      const store = useUserStore()
      await store.initialize()
      apiMock.getUserConfig.mockClear()

      await store.initialize()

      expect(apiMock.getUserConfig).not.toHaveBeenCalled()
    })

    it('retries on a subsequent call when the first fetch failed', async () => {
      apiMock.getUserConfig.mockRejectedValueOnce(new Error('network down'))
      apiMock.getUserConfig.mockResolvedValueOnce({})
      const store = useUserStore()

      await expect(store.initialize()).rejects.toThrow('network down')
      expect(store.initialized).toBe(false)
      await expect(store.initialize()).resolves.toBeUndefined()

      expect(apiMock.getUserConfig).toHaveBeenCalledTimes(2)
      expect(store.initialized).toBe(true)
    })

    it('deduplicates concurrent calls before the first fetch resolves', async () => {
      let resolveConfig: (value: unknown) => void = () => {}
      apiMock.getUserConfig.mockImplementation(
        () =>
          new Promise((resolve) => {
            resolveConfig = resolve
          })
      )
      const store = useUserStore()

      const a = store.initialize()
      const b = store.initialize()
      resolveConfig({})
      await Promise.all([a, b])

      expect(apiMock.getUserConfig).toHaveBeenCalledTimes(1)
    })

    it('derives multi-user state and restores the current user from storage', async () => {
      localStorage['Comfy.userId'] = 'user-2'
      apiMock.getUserConfig.mockResolvedValue({
        users: { 'user-1': 'Ada', 'user-2': 'Grace' }
      })
      const store = useUserStore()

      await store.initialize()

      expect(store.isMultiUserServer).toBe(true)
      expect(store.needsLogin).toBe(false)
      expect(store.users).toEqual([
        { userId: 'user-1', username: 'Ada' },
        { userId: 'user-2', username: 'Grace' }
      ])
      expect(store.currentUser).toEqual({ userId: 'user-2', username: 'Grace' })
      await vi.waitFor(() => expect(apiMock.user).toBe('user-2'))
    })

    it('requires login on multi-user servers without a stored user', async () => {
      apiMock.getUserConfig.mockResolvedValue({
        users: { 'user-1': 'Ada' }
      })
      const store = useUserStore()

      await store.initialize()

      expect(store.needsLogin).toBe(true)
      expect(store.currentUser).toBeNull()
      expect(apiMock.user).toBeUndefined()
    })
  })

  describe('createUser', () => {
    it('returns the created user id with the requested username', async () => {
      apiMock.createUser.mockResolvedValue({
        json: () => Promise.resolve('user-1'),
        status: 201
      })
      const store = useUserStore()

      await expect(store.createUser('Ada')).resolves.toEqual({
        userId: 'user-1',
        username: 'Ada'
      })
    })

    it('throws API errors returned by user creation', async () => {
      apiMock.createUser.mockResolvedValue({
        json: () => Promise.resolve({ error: 'name taken' }),
        status: 409,
        statusText: 'Conflict'
      })
      const store = useUserStore()

      await expect(store.createUser('Ada')).rejects.toThrow('name taken')
    })

    it('throws a fallback error when user creation has no error body', async () => {
      apiMock.createUser.mockResolvedValue({
        json: () => Promise.resolve({}),
        status: 500,
        statusText: 'Server Error'
      })
      const store = useUserStore()

      await expect(store.createUser('Ada')).rejects.toThrow(
        'Error creating user: 500 Server Error'
      )
    })
  })

  describe('login/logout', () => {
    it('persists login identity and clears it on logout', async () => {
      const store = useUserStore()

      await store.login({ userId: 'user-1', username: 'Ada' })
      expect(localStorage['Comfy.userId']).toBe('user-1')
      expect(localStorage['Comfy.userName']).toBe('Ada')

      await store.logout()
      expect(localStorage['Comfy.userId']).toBeUndefined()
      expect(localStorage['Comfy.userName']).toBeUndefined()
    })

    it('does not set api.user until user config finishes loading', async () => {
      let resolveConfig: (value: unknown) => void = () => {}
      apiMock.getUserConfig.mockImplementation(
        () =>
          new Promise((resolve) => {
            resolveConfig = resolve
          })
      )
      const store = useUserStore()
      const pendingInitialize = store.initialize()

      await store.login({ userId: 'user-1', username: 'Ada' })

      expect(apiMock.user).toBeUndefined()

      resolveConfig({ users: { 'user-1': 'Ada' } })
      await pendingInitialize
      await vi.waitFor(() => expect(apiMock.user).toBe('user-1'))
    })
  })
})
