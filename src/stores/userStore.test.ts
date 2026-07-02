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
  })
})
