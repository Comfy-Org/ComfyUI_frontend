import { createPinia, setActivePinia } from 'pinia'
import { beforeEach, describe, expect, it, vi } from 'vitest'

import { useUserStore } from './userStore'

const getUserConfig = vi.fn()

vi.mock('@/scripts/api', () => ({
  api: {
    getUserConfig: (...args: unknown[]) => getUserConfig(...args)
  }
}))

describe('userStore', () => {
  beforeEach(() => {
    setActivePinia(createPinia())
    getUserConfig.mockReset()
    localStorage.clear()
  })

  describe('initialize', () => {
    it('fetches user config on first call', async () => {
      getUserConfig.mockResolvedValue({})
      const store = useUserStore()

      await store.initialize()

      expect(getUserConfig).toHaveBeenCalledTimes(1)
      expect(store.initialized).toBe(true)
    })

    it('is a no-op once already initialized', async () => {
      getUserConfig.mockResolvedValue({})
      const store = useUserStore()
      await store.initialize()
      getUserConfig.mockClear()

      await store.initialize()

      expect(getUserConfig).not.toHaveBeenCalled()
    })

    it('deduplicates concurrent calls before the first fetch resolves', async () => {
      let resolveConfig: (value: unknown) => void = () => {}
      getUserConfig.mockImplementation(
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

      expect(getUserConfig).toHaveBeenCalledTimes(1)
    })
  })
})
