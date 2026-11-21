import { describe, expect, it, vi } from 'vitest'

import { useUserStore } from './userStore'
import { api } from '@/scripts/api'

vi.mock(import('@/scripts/api'))

describe('userStore', () => {
  describe('initialize', () => {
    it('fetches user config on first call', async () => {
      vi.mocked(api.getUserConfig).mockResolvedValue({ storage: 'server' })
      const store = useUserStore()

      await store.initialize()

      expect(api.getUserConfig).toHaveBeenCalledTimes(1)
      expect(store.initialized).toBe(true)
    })

    it('is a no-op once already initialized', async () => {
      vi.mocked(api.getUserConfig).mockResolvedValue({ storage: 'server' })
      const store = useUserStore()
      await store.initialize()
      vi.mocked(api.getUserConfig).mockClear()

      await store.initialize()

      expect(api.getUserConfig).not.toHaveBeenCalled()
    })

    it('retries on a subsequent call when the first fetch failed', async () => {
      vi.mocked(api.getUserConfig).mockRejectedValueOnce(
        new Error('network down')
      )
      vi.mocked(api.getUserConfig).mockResolvedValueOnce({ storage: 'server' })
      const store = useUserStore()

      await expect(store.initialize()).rejects.toThrow('network down')
      expect(store.initialized).toBe(false)
      await expect(store.initialize()).resolves.toBeUndefined()

      expect(api.getUserConfig).toHaveBeenCalledTimes(2)
      expect(store.initialized).toBe(true)
    })

    it('deduplicates concurrent calls before the first fetch resolves', async () => {
      let resolveConfig: (
        value: Awaited<ReturnType<typeof api.getUserConfig>>
      ) => void = () => {}
      vi.mocked(api.getUserConfig).mockImplementation(
        () =>
          new Promise((resolve) => {
            resolveConfig = resolve
          })
      )
      const store = useUserStore()

      const a = store.initialize()
      const b = store.initialize()
      resolveConfig({ storage: 'server' })
      await Promise.all([a, b])

      expect(api.getUserConfig).toHaveBeenCalledTimes(1)
    })
  })
})
