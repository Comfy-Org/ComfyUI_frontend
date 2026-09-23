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
        return new Response('body { color: red; }', { status: 200 })
      })
      const store = useUserStore()

      await store.initialize()

      expect(fetchApi).toHaveBeenCalledWith('/userdata/user.css')
      expect(document.querySelector('#user-stylesheet')?.textContent).toBe(
        'body { color: red; }'
      )
    })

    it.for([
      { config: {}, tagName: 'LINK' },
      { config: { users: { 'alice-id': 'Alice' } }, tagName: 'STYLE' }
    ])(
      'inserts the $tagName before app styles to preserve cascade order',
      async ({ config, tagName }) => {
        localStorage['Comfy.userId'] = 'users' in config ? 'alice-id' : ''
        getUserConfig.mockResolvedValue(config)
        fetchApi.mockResolvedValue(
          new Response('body { color: red; }', { status: 200 })
        )
        const appStyle = document.createElement('style')
        appStyle.id = 'app-stylesheet'
        document.head.prepend(appStyle)
        const store = useUserStore()

        await store.initialize()

        const userStyle = document.querySelector('#user-stylesheet')
        expect(userStyle?.tagName).toBe(tagName)
        expect(userStyle?.nextElementSibling).toBe(appStyle)
        appStyle.remove()
      }
    )

    it('loads CSS for a single-user server without a selected identity', async () => {
      getUserConfig.mockResolvedValue({})
      const store = useUserStore()

      await store.initialize()

      expect(api.user).toBe('')
      expect(fetchApi).not.toHaveBeenCalled()
      expect(document.querySelector('#user-stylesheet')).toEqual(
        expect.objectContaining({
          tagName: 'LINK',
          rel: 'stylesheet',
          href: 'http://localhost:3000/api/userdata/user.css'
        })
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

  it(
    'clears the previous stylesheet when the selected user CSS is unavailable',
    async () => {
      getUserConfig.mockResolvedValue({
        users: { 'alice-id': 'Alice', 'bob-id': 'Bob' }
      })
      const store = useUserStore()
      await store.initialize()
      const previousStyle = document.createElement('style')
      previousStyle.id = 'user-stylesheet'
      previousStyle.textContent = 'body { color: red; }'
      document.head.prepend(previousStyle)

      await store.login({ userId: 'bob-id', username: 'Bob' })

      expect(document.querySelector('#user-stylesheet')).toBeNull()
    }
  )

  it('ignores stylesheet responses for a previously selected user', async () => {
    getUserConfig.mockResolvedValue({
      users: { 'alice-id': 'Alice', 'bob-id': 'Bob' }
    })
    const responses = new Map<string, (response: Response) => void>()
    fetchApi.mockImplementation(
      () =>
        new Promise<Response>((resolve) => {
          responses.set(api.user, resolve)
        })
    )
    const store = useUserStore()
    await store.initialize()

    const aliceLogin = store.login({ userId: 'alice-id', username: 'Alice' })
    const bobLogin = store.login({ userId: 'bob-id', username: 'Bob' })
    const resolveBob = responses.get('bob-id')
    expect(resolveBob).toBeDefined()
    resolveBob!(new Response('body { color: blue; }', { status: 200 }))
    await bobLogin
    const resolveAlice = responses.get('alice-id')
    expect(resolveAlice).toBeDefined()
    resolveAlice!(new Response('body { color: red; }', { status: 200 }))
    await aliceLogin

    expect(document.querySelector('#user-stylesheet')?.textContent).toBe(
      'body { color: blue; }'
    )
  })
})
