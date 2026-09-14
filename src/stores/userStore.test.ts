import { beforeEach, describe, expect, it, vi } from 'vitest'

import { useUserStore } from './userStore'

const { api, fetchApi, getUserConfig } = vi.hoisted(() => {
  const getUserConfig = vi.fn()
  const fetchApi = vi.fn()
  return {
    getUserConfig,
    fetchApi,
    api: {
      getUserConfig: (...args: unknown[]) => getUserConfig(...args),
      fetchApi: (...args: unknown[]) => fetchApi(...args),
      apiURL: (route: string) => `/api${route}`,
      user: ''
    }
  }
})

vi.mock<unknown>(import('@/scripts/api'), () => ({
  api
}))

describe('userStore', () => {
  beforeEach(() => {
    api.user = ''
    fetchApi.mockResolvedValue(new Response(null, { status: 404 }))
    document.querySelector('#user-stylesheet')?.remove()
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

    it('retries on a subsequent call when the first fetch failed', async () => {
      getUserConfig.mockRejectedValueOnce(new Error('network down'))
      getUserConfig.mockResolvedValueOnce({})
      const store = useUserStore()

      await expect(store.initialize()).rejects.toThrow('network down')
      expect(store.initialized).toBe(false)
      await expect(store.initialize()).resolves.toBeUndefined()

      expect(getUserConfig).toHaveBeenCalledTimes(2)
      expect(store.initialized).toBe(true)
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

    it('loads CSS with the selected multi-user identity', async () => {
      localStorage['Comfy.userId'] = 'alice-id'
      getUserConfig.mockResolvedValue({ users: { 'alice-id': 'Alice' } })
      fetchApi.mockImplementation(async () => {
        expect(api.user).toBe('alice-id')
        return new Response(
          '@import "theme.css"; body { background: url("background.png"), url("images/image (1).png"); }',
          {
            status: 200
          }
        )
      })
      const store = useUserStore()

      await store.initialize()

      expect(fetchApi).toHaveBeenCalledWith('/userdata/user.css')
      expect(document.querySelector('#user-stylesheet')?.textContent).toBe(
        '@import "theme.css"; body { background: url("background.png"), url("images/image (1).png"); }'
      )
    })

    it('loads CSS for a single-user server without a selected identity', async () => {
      getUserConfig.mockResolvedValue({})
      fetchApi.mockResolvedValue(new Response('body { color: red; }'))
      const store = useUserStore()

      await store.initialize()

      expect(api.user).toBe('')
      expect(fetchApi).toHaveBeenCalledWith('/userdata/user.css')
      expect(document.querySelector('#user-stylesheet')?.textContent).toBe(
        'body { color: red; }'
      )
    })
  })

  it('waits to load CSS until a multi-user identity is selected', async () => {
    getUserConfig.mockResolvedValue({ users: { 'alice-id': 'Alice' } })
    fetchApi.mockImplementation(async () => {
      expect(api.user).toBe('alice-id')
      return new Response('body { color: red; }')
    })
    const store = useUserStore()
    await store.initialize()

    expect(store.needsLogin).toBe(true)
    expect(fetchApi).not.toHaveBeenCalled()

    await store.login({ userId: 'alice-id', username: 'Alice' })

    expect(fetchApi).toHaveBeenCalledOnce()
    expect(document.querySelector('#user-stylesheet')?.textContent).toBe(
      'body { color: red; }'
    )
  })
})
