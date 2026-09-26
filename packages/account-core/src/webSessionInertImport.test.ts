import { beforeEach, expect, it, vi } from 'vitest'

beforeEach(() => {
  vi.resetModules()
})

it.for([
  '@comfyorg/account-core/webSession',
  '@comfyorg/account-core/requestAuth',
  '@comfyorg/account-core/sessionTokenMint',
  '@comfyorg/account-core/webSessionIdentity',
  '@comfyorg/account-core/web',
  '@comfyorg/account-core/requestAuth',
  '@comfyorg/account-core/testing'
])(
  'importing %s starts no timer, listener, channel, or request',
  async (specifier) => {
    const fetchSpy = vi.fn<typeof fetch>()
    vi.stubGlobal('fetch', fetchSpy)
    const channelSpy = vi.fn()
    vi.stubGlobal('BroadcastChannel', channelSpy)
    const setTimeoutSpy = vi.spyOn(globalThis, 'setTimeout')
    const setIntervalSpy = vi.spyOn(globalThis, 'setInterval')
    const listenerSpy = vi.spyOn(EventTarget.prototype, 'addEventListener')

    await import(/* @vite-ignore */ specifier)

    expect({
      fetch: fetchSpy.mock.calls.length,
      broadcastChannel: channelSpy.mock.calls.length,
      setTimeout: setTimeoutSpy.mock.calls.length,
      setInterval: setIntervalSpy.mock.calls.length,
      addEventListener: listenerSpy.mock.calls.length
    }).toEqual({
      fetch: 0,
      broadcastChannel: 0,
      setTimeout: 0,
      setInterval: 0,
      addEventListener: 0
    })
  }
)
