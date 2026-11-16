import { reportError } from '@comfyorg/telemetry/reportError'
import { describe, expect, it, onTestFinished, vi } from 'vitest'

import { createComfyApi } from '@/platform/nodeApi/v4/comfyApi'
import { api } from '@/scripts/api'

function backendApi() {
  return createComfyApi({ getGraph: () => null }).comfy.backend
}

function servedFromBase(base: string) {
  const previous = api.api_base
  api.api_base = base
  onTestFinished(() => {
    api.api_base = previous
  })
}

function send(event: string, detail: unknown) {
  Reflect.apply(EventTarget.prototype.dispatchEvent, api, [
    new CustomEvent(event, { detail })
  ])
}

const notSameOrigin = [
  'view',
  '',
  '//evil.example/x',
  '/\\evil.example/x',
  '/\t/evil.example/x',
  '/\n/evil.example/x',
  '/\r/evil.example/x',
  5
]

describe('backend URLs', () => {
  it('gives the URL of an API route under the host base path', () => {
    servedFromBase('/comfy')

    expect(backendApi().url('/view?filename=a.png')).toBe(
      '/comfy/api/view?filename=a.png'
    )
  })

  it('gives the URL of a file served outside the API', () => {
    servedFromBase('/comfy')

    expect(backendApi().assetUrl('/extensions/MyPack/icon.png')).toBe(
      '/comfy/extensions/MyPack/icon.png'
    )
  })

  it.for(['url', 'assetUrl', 'fetch'] as const)(
    '%s refuses a route that could leave the host',
    (member) => {
      const backend = backendApi()

      for (const route of notSameOrigin) {
        expect(() => Reflect.apply(backend[member], backend, [route])).toThrow(
          new TypeError(
            `backend.${member} needs a route that starts with one / and holds no tab or line break, not ${typeof route === 'string' ? `'${route}'` : route}.`
          )
        )
      }
      expect(fetch).not.toHaveBeenCalled()
    }
  )
})

describe('calling the backend', () => {
  it('calls the route with the host credentials and the pack options', async () => {
    vi.mocked(fetch).mockResolvedValue(new Response('done'))
    const headers = { 'X-Pack': 'yes' }

    const response = await backendApi().fetch('/my-pack/items', {
      method: 'POST',
      body: 'payload',
      headers
    })

    expect(await response.text()).toBe('done')
    const [url, init] = vi.mocked(fetch).mock.calls[0]
    expect(String(url)).toBe('/api/my-pack/items')
    expect(init).toMatchObject({ method: 'POST', body: 'payload' })
    expect(new Headers(init?.headers).get('X-Pack')).toBe('yes')
    expect(new Headers(init?.headers).has('Comfy-User')).toBe(true)
    expect(headers).toEqual({ 'X-Pack': 'yes' })
  })

  it('resolves with a response whatever its status', async () => {
    vi.mocked(fetch).mockResolvedValue(new Response('no', { status: 500 }))

    expect((await backendApi().fetch('/my-pack/items')).status).toBe(500)
  })

  it('rejects as fetch does when the server cannot be reached', async () => {
    const unreachable = new TypeError('Failed to fetch')
    vi.mocked(fetch).mockRejectedValue(unreachable)

    await expect(backendApi().fetch('/my-pack/items')).rejects.toBe(unreachable)
  })

  it.for(['POST', null, 3])('refuses %j as request options', (init) => {
    const backend = backendApi()

    expect(() =>
      Reflect.apply(backend.fetch, backend, ['/my-pack/items', init])
    ).toThrow(TypeError)
    expect(fetch).not.toHaveBeenCalled()
  })
})

describe('backend messages', () => {
  it('delivers a frozen copy of each payload sent under the event', () => {
    const payload = { node: '3', images: [{ filename: 'a.png' }] }
    const listener = vi.fn()
    backendApi().on('MyPack.progress', listener)

    send('MyPack.progress', payload)

    const [delivered] = listener.mock.calls[0]
    expect(delivered).toEqual(payload)
    expect(delivered).not.toBe(payload)
    expect(Object.isFrozen(delivered)).toBe(true)
    expect(Object.isFrozen(delivered.images)).toBe(true)
    expect(Object.isFrozen(delivered.images[0])).toBe(true)
  })

  it('passes a preview Blob as it is, which nothing can change', () => {
    const preview = new Blob(['png'], { type: 'image/png' })
    const listener = vi.fn()
    backendApi().on('b_preview_with_metadata', listener)

    send('b_preview_with_metadata', { blob: preview, nodeId: '3' })

    const [delivered] = listener.mock.calls[0]
    expect(delivered).toEqual({ blob: preview, nodeId: '3' })
    expect(delivered.blob).toBe(preview)
    expect(Object.isFrozen(preview)).toBe(false)
  })

  it('copies a payload key named __proto__ as an ordinary key', () => {
    const listener = vi.fn()
    backendApi().on('MyPack.progress', listener)

    send('MyPack.progress', JSON.parse('{"__proto__": {"polluted": true}}'))

    const [delivered] = listener.mock.calls[0]
    expect(Object.hasOwn(delivered, '__proto__')).toBe(true)
    expect(Reflect.get({}, 'polluted')).toBeUndefined()
  })

  it('gives each listener its own copy, so one cannot change what another sees', () => {
    const seen: unknown[] = []
    const backend = backendApi()
    backend.on('executed', (detail) => seen.push(detail))
    backend.on('executed', (detail) => seen.push(detail))

    send('executed', { node: '3' })

    expect(seen).toEqual([{ node: '3' }, { node: '3' }])
    expect(seen[0]).not.toBe(seen[1])
  })

  it('hears only the event it subscribed to', () => {
    const listener = vi.fn()
    backendApi().on('MyPack.progress', listener)

    send('MyPack.other', {})

    expect(listener).not.toHaveBeenCalled()
  })

  it('stops delivering once the disposer runs, and keeps the other registration', () => {
    const listener = vi.fn()
    const backend = backendApi()
    const stop = backend.on('MyPack.progress', listener)
    const stayed = backend.on('MyPack.progress', listener)

    stop()
    stop()
    send('MyPack.progress', 1)

    expect(listener).toHaveBeenCalledExactlyOnceWith(1)
    stayed()
    send('MyPack.progress', 2)
    expect(listener).toHaveBeenCalledOnce()
  })

  it('follows an event on the client once for all its listeners, and stops when the last one leaves', () => {
    const subscribe = vi.spyOn(api, 'addCustomEventListener')
    const unsubscribe = vi.spyOn(api, 'removeCustomEventListener')
    const backend = backendApi()
    const stopFirst = backend.on('MyPack.progress', vi.fn())
    const stopSecond = backend.on('MyPack.progress', vi.fn())
    backend.on('MyPack.other', vi.fn())

    stopFirst()
    const removedWhileOneListens = unsubscribe.mock.calls.length
    stopSecond()

    expect(subscribe.mock.calls.map(([event]) => event)).toEqual([
      'MyPack.progress',
      'MyPack.other'
    ])
    expect(removedWhileOneListens).toBe(0)
    expect(unsubscribe).toHaveBeenCalledExactlyOnceWith(
      'MyPack.progress',
      subscribe.mock.calls[0][1]
    )
  })

  it('subscribes again for an event whose listeners all left', () => {
    const listener = vi.fn()
    const backend = backendApi()
    backend.on('MyPack.progress', vi.fn())()

    backend.on('MyPack.progress', listener)
    send('MyPack.progress', 'again')

    expect(listener).toHaveBeenCalledExactlyOnceWith('again')
  })

  it('reports a listener that throws and still delivers to the next', () => {
    const broken = new Error('pack listener failed')
    const after = vi.fn()
    const backend = backendApi()
    backend.on('MyPack.progress', () => {
      throw broken
    })
    backend.on('MyPack.progress', after)

    send('MyPack.progress', 'x')

    expect(after).toHaveBeenCalledExactlyOnceWith('x')
    expect(reportError).toHaveBeenCalledExactlyOnceWith(
      broken,
      expect.objectContaining({ tags: { event: 'backend.on' } })
    )
  })

  it('delivers undefined for a payload it cannot copy, and reports that once per event', () => {
    const listener = vi.fn()
    const backend = backendApi()
    backend.on('MyPack.odd', listener)
    backend.on('MyPack.plain', listener)

    send('MyPack.odd', { callback: () => 1 })
    send('MyPack.odd', { callback: () => 2 })
    send('MyPack.plain', 'fine')

    expect(listener.mock.calls).toEqual([[undefined], [undefined], ['fine']])
    expect(reportError).toHaveBeenCalledExactlyOnceWith(
      expect.anything(),
      expect.objectContaining({
        errorType: 'node_api_payload_not_copyable',
        tags: { event: 'MyPack.odd' }
      })
    )
  })

  it.for([
    { name: 'an empty event name', event: '', listener: () => {} },
    { name: 'an event name that is not text', event: 7, listener: () => {} },
    {
      name: 'a listener that is not a function',
      event: 'executed',
      listener: 'x'
    }
  ])('refuses $name', ({ event, listener }) => {
    const backend = backendApi()

    expect(() => Reflect.apply(backend.on, backend, [event, listener])).toThrow(
      TypeError
    )
  })
})
