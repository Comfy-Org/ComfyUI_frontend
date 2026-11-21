import { describe, expect, it, onTestFinished, vi } from 'vitest'

import { coreRoutePath } from '@/platform/cloud/coreRouteFetch'

const distribution = vi.hoisted(() => ({ isCloud: true }))

vi.mock(import('@/platform/distribution/types'), () => ({
  get isCloud() {
    return distribution.isCloud
  }
}))

vi.mock(import('@/scripts/api'))

const origin = 'https://cloud.example'

async function loadOnDistribution(isCloud: boolean) {
  distribution.isCloud = isCloud
  vi.resetModules()
  const { coreRouteFetch, installCoreRouteFetch } =
    await import('@/platform/cloud/coreRouteFetch')
  const { api } = await import('@/scripts/api')
  return { coreRouteFetch, installCoreRouteFetch, api }
}

describe('coreRoutePath', () => {
  it.for([
    { name: 'an upload', input: '/upload/image', route: '/upload/image' },
    {
      name: 'a history query',
      input: '/history?max_items=1',
      route: '/history?max_items=1'
    },
    {
      name: 'a URL object',
      input: new URL('/prompt', origin),
      route: '/prompt'
    },
    {
      name: 'an absolute URL on this origin',
      input: `${origin}/object_info`,
      route: '/object_info'
    }
  ])(
    'names a ComfyUI route called at the site root: $name',
    ({ input, route }) => {
      expect(coreRoutePath(input, origin)).toBe(route)
    }
  )

  it.for([
    { name: 'the API path', input: '/api/upload/image' },
    { name: 'a custom node route', input: '/example_pack/preview' },
    {
      name: 'the view route Cloud serves at the root',
      input: '/view?filename=a.png&type=temp'
    },
    {
      name: 'a route that only starts like one',
      input: '/viewvideo?filename=a.gif'
    },
    { name: 'a longer first segment', input: '/uploads/a' },
    { name: 'another site', input: 'https://other.example/upload/image' },
    { name: 'a Request object', input: new Request(`${origin}/upload/image`) }
  ])('leaves $name alone', ({ input }) => {
    expect(coreRoutePath(input, origin)).toBeNull()
  })
})

describe('coreRouteFetch', () => {
  it('sends a root ComfyUI route through the API', async () => {
    const { coreRouteFetch, api } = await loadOnDistribution(true)
    const pageFetch = vi.fn<typeof fetch>(async () => new Response('page'))
    const apiResponse = new Response('api')
    vi.mocked(api.fetchApi).mockResolvedValue(apiResponse)
    const init = { method: 'POST', body: 'image' }

    const routed = coreRouteFetch(pageFetch)

    await expect(routed('/upload/image', init)).resolves.toBe(apiResponse)
    expect(api.fetchApi).toHaveBeenCalledWith(
      '/upload/image',
      expect.objectContaining(init)
    )
    expect(pageFetch).not.toHaveBeenCalled()
  })

  it('sends a root view request to the page', async () => {
    const { coreRouteFetch, api } = await loadOnDistribution(true)
    const pageFetch = vi.fn<typeof fetch>(async () => new Response('page'))

    await coreRouteFetch(pageFetch)('/view?filename=a.png&type=output')

    expect(pageFetch).toHaveBeenCalledWith(
      '/view?filename=a.png&type=output',
      undefined
    )
    expect(api.fetchApi).not.toHaveBeenCalled()
  })

  it('sends a request that omits credentials to the page', async () => {
    const { coreRouteFetch, api } = await loadOnDistribution(true)
    const pageFetch = vi.fn<typeof fetch>(async () => new Response('page'))
    const init: RequestInit = { credentials: 'omit' }

    await coreRouteFetch(pageFetch)('/upload/image', init)

    expect(pageFetch).toHaveBeenCalledWith('/upload/image', init)
    expect(api.fetchApi).not.toHaveBeenCalled()
  })

  it('keeps the caller headers free of the API credential', async () => {
    const { coreRouteFetch, api } = await loadOnDistribution(true)
    const pageFetch = vi.fn<typeof fetch>(async () => new Response('page'))
    vi.mocked(api.fetchApi).mockImplementation(async (_route, options) => {
      const headers = options?.headers ?? {}
      if (headers instanceof Headers) {
        headers.set('Authorization', 'Bearer cloud-token')
      } else if (Array.isArray(headers)) {
        headers.push(['Authorization', 'Bearer cloud-token'])
      } else {
        headers['Authorization'] = 'Bearer cloud-token'
      }
      return new Response('api')
    })
    const callerHeaders: Record<string, string> = { 'X-Pack': 'preview' }

    await coreRouteFetch(pageFetch)('/upload/image', {
      method: 'POST',
      headers: callerHeaders
    })

    expect(callerHeaders).toEqual({ 'X-Pack': 'preview' })
    const forwarded = vi.mocked(api.fetchApi).mock.calls[0][1]?.headers
    expect(new Headers(forwarded).get('X-Pack')).toBe('preview')
  })

  it('sends a custom node route to the page', async () => {
    const { coreRouteFetch, api } = await loadOnDistribution(true)
    const pageFetch = vi.fn<typeof fetch>(async () => new Response('page'))

    await coreRouteFetch(pageFetch)('/example_pack/preview')

    expect(pageFetch).toHaveBeenCalledWith('/example_pack/preview', undefined)
    expect(api.fetchApi).not.toHaveBeenCalled()
  })
})

describe('installCoreRouteFetch', () => {
  it('sends window.fetch calls to a root ComfyUI route through the API on Cloud', async () => {
    const { installCoreRouteFetch, api } = await loadOnDistribution(true)
    const networkGuard = window.fetch
    onTestFinished(() => {
      Object.assign(window, { fetch: networkGuard })
    })
    const apiResponse = new Response('api')
    vi.mocked(api.fetchApi).mockResolvedValue(apiResponse)
    const init = { method: 'POST', body: 'image' }

    installCoreRouteFetch()

    await expect(window.fetch('/upload/image', init)).resolves.toBe(apiResponse)
    expect(api.fetchApi).toHaveBeenCalledWith(
      '/upload/image',
      expect.objectContaining(init)
    )
    expect(networkGuard).not.toHaveBeenCalled()
  })

  it('leaves fetch unchanged off Cloud', async () => {
    const { installCoreRouteFetch } = await loadOnDistribution(false)
    const pageFetch = window.fetch

    installCoreRouteFetch()

    expect(window.fetch).toBe(pageFetch)
  })
})
