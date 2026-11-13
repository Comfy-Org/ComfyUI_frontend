import { describe, expect, it, vi } from 'vitest'

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
  const { installCoreRouteFetch } =
    await import('@/platform/cloud/coreRouteFetch')
  const { api } = await import('@/scripts/api')
  const pageFetch = vi.fn<typeof fetch>(async () => new Response('page'))
  vi.stubGlobal('fetch', pageFetch)
  return { installCoreRouteFetch, api, pageFetch }
}

describe('coreRoutePath', () => {
  it.for([
    { name: 'an upload', input: '/upload/image', route: '/upload/image' },
    {
      name: 'a view with its query',
      input: '/view?filename=a.png&type=temp',
      route: '/view?filename=a.png&type=temp'
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

describe('installCoreRouteFetch', () => {
  it('sends a root ComfyUI route through the API on Cloud', async () => {
    const { installCoreRouteFetch, api, pageFetch } =
      await loadOnDistribution(true)
    const apiResponse = new Response('api')
    vi.mocked(api.fetchApi).mockResolvedValue(apiResponse)
    const init = { method: 'POST', body: 'image' }

    installCoreRouteFetch()

    await expect(window.fetch('/upload/image', init)).resolves.toBe(apiResponse)
    expect(api.fetchApi).toHaveBeenCalledWith('/upload/image', init)
    expect(pageFetch).not.toHaveBeenCalled()
  })

  it('sends a custom node route to the page on Cloud', async () => {
    const { installCoreRouteFetch, api, pageFetch } =
      await loadOnDistribution(true)

    installCoreRouteFetch()
    await window.fetch('/example_pack/preview')

    expect(pageFetch).toHaveBeenCalledWith('/example_pack/preview', undefined)
    expect(api.fetchApi).not.toHaveBeenCalled()
  })

  it('leaves fetch unchanged off Cloud', async () => {
    const { installCoreRouteFetch, pageFetch } = await loadOnDistribution(false)

    installCoreRouteFetch()

    expect(window.fetch).toBe(pageFetch)
  })
})
