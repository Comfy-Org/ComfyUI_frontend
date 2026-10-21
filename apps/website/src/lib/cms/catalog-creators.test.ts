import { assert, describe, expect, it, vi } from 'vitest'

import { loadCatalogCreators } from './catalog-creators'

const origin = 'http://localhost:8099'

function serve(routes: Partial<Record<string, () => Response>>) {
  vi.stubEnv('SITE_CATALOG_API_URL', origin)
  vi.stubEnv('VERCEL_ENV', 'development')
  const upstream = vi.fn<typeof fetch>().mockImplementation(async (input) => {
    const url = new URL(String(input))
    const route = routes[`${url.pathname}${url.search}`] ?? routes[url.pathname]
    return route ? route() : new Response(null, { status: 404 })
  })
  vi.mocked(fetch).mockImplementation(upstream)
  return (index: number) => new URL(String(upstream.mock.calls[index][0]))
}

const summary = (
  username: string,
  workflowCount: number,
  extra: Record<string, unknown> = {}
) => ({ username, workflow_count: workflowCount, ...extra })

describe('loadCatalogCreators', () => {
  it('reads every directory page and lists the busiest creators first', async () => {
    const call = serve({
      '/api/v1/catalog/creators?limit=100': () =>
        Response.json({
          items: [
            summary('sirolim', 1, { display_name: 'Sirolim' }),
            summary('purz', 2)
          ],
          next_cursor: 'page-2'
        }),
      '/api/v1/catalog/creators?limit=100&cursor=page-2': () =>
        Response.json({
          items: [summary('hellorob', 1, { display_name: 'Rob' })]
        })
    })

    const result = await loadCatalogCreators()

    assert.isTrue(result.ok)
    expect(
      result.creators.map(({ username, displayName, workflowCount }) => [
        username,
        displayName,
        workflowCount
      ])
    ).toEqual([
      ['purz', 'purz', 2],
      ['hellorob', 'Rob', 1],
      ['sirolim', 'Sirolim', 1]
    ])
    expect(call(1).searchParams.get('cursor')).toBe('page-2')
  })

  it('merges usernames that differ only in case into one lowercase creator', async () => {
    serve({
      '/api/v1/catalog/creators': () =>
        Response.json({
          items: [
            summary('PurZ', 2, { display_name: 'PurZ' }),
            summary('purz', 1)
          ]
        })
    })

    const result = await loadCatalogCreators()

    assert.isTrue(result.ok)
    expect(result.creators).toEqual([
      { username: 'purz', displayName: 'PurZ', workflowCount: 3 }
    ])
  })

  it.for([
    {
      case: 'resizes an avatar on the Hub assets host',
      avatar: 'https://comfy-hub-assets.comfy.org/uploads/purz.png',
      expected:
        'https://comfy-hub-assets.comfy.org/cdn-cgi/image/width=400,format=auto,quality=82/uploads/purz.png'
    },
    {
      case: 'drops an avatar served over plain http',
      avatar: 'http://comfy-hub-assets.comfy.org/uploads/purz.png',
      expected: undefined
    },
    {
      case: 'drops an avatar on another host',
      avatar: 'https://tracker.example/purz.png',
      expected: undefined
    },
    { case: 'drops an empty avatar', avatar: '', expected: undefined },
    {
      case: 'drops an avatar with credentials',
      avatar: 'https://user:pass@comfy-hub-assets.comfy.org/uploads/purz.png',
      expected: undefined
    }
  ])('$case', async ({ avatar, expected }) => {
    serve({
      '/api/v1/catalog/creators': () =>
        Response.json({ items: [summary('purz', 1, { avatar_url: avatar })] })
    })

    const result = await loadCatalogCreators()

    assert.isTrue(result.ok)
    expect(result.creators[0].avatarUrl).toBe(expected)
  })

  it.for([
    {
      case: 'a server error',
      response: () => new Response(null, { status: 502 })
    },
    {
      case: 'a body that is not the directory',
      response: () => Response.json({ items: [{ username: 'purz' }] })
    }
  ])('reports the directory unavailable on $case', async ({ response }) => {
    serve({ '/api/v1/catalog/creators': response })

    expect(await loadCatalogCreators()).toEqual({ ok: false, status: 503 })
  })

  it('stops on a cursor it has already read', async () => {
    serve({
      '/api/v1/catalog/creators': () =>
        Response.json({ items: [summary('purz', 1)], next_cursor: 'again' })
    })

    expect(await loadCatalogCreators()).toEqual({ ok: false, status: 503 })
    expect(fetch).toHaveBeenCalledTimes(2)
  })

  it('stops at the page cap even when the catalog has another page', async () => {
    let page = 0
    serve({
      '/api/v1/catalog/creators': () =>
        Response.json({
          items: [summary(`creator${page}`, 1)],
          next_cursor: `page-${++page}`
        })
    })

    expect(await loadCatalogCreators()).toEqual({ ok: false, status: 503 })
    expect(fetch).toHaveBeenCalledTimes(20)
  })

  it('leaves out creators with no workflows and names a creator by username when the display name is empty', async () => {
    serve({
      '/api/v1/catalog/creators': () =>
        Response.json({
          items: [
            summary('idle', 0, { display_name: 'Idle' }),
            summary('purz', 1, { display_name: '' })
          ]
        })
    })

    const result = await loadCatalogCreators()

    assert.isTrue(result.ok)
    expect(result.creators).toEqual([
      { username: 'purz', displayName: 'purz', workflowCount: 1 }
    ])
  })

  it('reports the directory unavailable on an error status with a JSON body', async () => {
    serve({
      '/api/v1/catalog/creators': () =>
        Response.json({ items: [summary('purz', 1)] }, { status: 500 })
    })

    expect(await loadCatalogCreators()).toEqual({ ok: false, status: 503 })
  })

  it('reads nothing when the CMS is off', async () => {
    serve({
      '/api/v1/catalog/creators': () =>
        Response.json({ items: [summary('purz', 1)] })
    })
    vi.stubEnv('VERCEL_ENV', 'production')

    expect(await loadCatalogCreators()).toEqual({ ok: false, status: 503 })
    expect(fetch).not.toHaveBeenCalled()
  })
})
