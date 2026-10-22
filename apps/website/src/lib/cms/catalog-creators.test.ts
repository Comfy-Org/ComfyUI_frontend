import type { CccWebsiteCardsPage } from '@comfyorg/ingest-types'
import { assert, describe, expect, it, vi } from 'vitest'

import {
  loadCatalogCreator,
  loadCatalogCreators,
  loadCreatorPage
} from './catalog-creators'

const origin = 'http://localhost:8099'

function cardsPage(): CccWebsiteCardsPage {
  return {
    revision_id: 4,
    items: [
      {
        uid: '00000000-0000-4000-8000-000000000010',
        edit_version: '00000000-0000-4000-8000-000000000011',
        revision: 1,
        deleted: false,
        enabled: true,
        visibility: 'PUBLIC',
        kind: 'WORKFLOW',
        slug: '/hub/workflows/purz-flow',
        data: { type: 'workflow', title: 'Purz flow', slug: 'purz-flow' }
      }
    ],
    page_size: 24,
    has_more: true,
    next_cursor: 'signed-next',
    available_kinds: ['WORKFLOW'],
    sort_orders: ['popular'],
    facets: { categories: [], models: [], use_cases: [] }
  }
}

function serve(routes: Partial<Record<string, () => Response>>) {
  vi.stubEnv('SITE_CATALOG_API_URL', origin)
  vi.stubEnv('VERCEL_ENV', 'development')
  const upstream = vi
    .fn<typeof fetch>()
    .mockImplementation(async (input, init) => {
      init?.signal?.throwIfAborted()
      const url = new URL(String(input))
      const route =
        routes[`${url.pathname}${url.search}`] ?? routes[url.pathname]
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

  it('lists the creators read so far when the catalog has more pages than the cap', async () => {
    let page = 0
    serve({
      '/api/v1/catalog/creators': () =>
        Response.json({
          items: [summary(`creator${page}`, 1)],
          next_cursor: `page-${++page}`
        })
    })

    const result = await loadCatalogCreators()

    assert.isTrue(result.ok)
    expect(result.creators).toHaveLength(20)
    expect(fetch).toHaveBeenCalledTimes(20)
  })

  it('aborts the next page read when the walk deadline ends', async () => {
    const deadline = new AbortController()
    const call = serve({
      '/api/v1/catalog/creators': () => {
        deadline.abort()
        return Response.json({
          items: [summary('purz', 1)],
          next_cursor: 'page-2'
        })
      }
    })

    expect(await loadCatalogCreators(deadline.signal)).toEqual({
      ok: false,
      status: 503
    })
    expect(vi.mocked(fetch).mock.calls[1]?.[1]?.signal?.aborted).toBe(true)
    expect(call(1).searchParams.get('cursor')).toBe('page-2')
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

describe('loadCatalogCreator', () => {
  const profile = {
    username: 'purz',
    display_name: 'Purz',
    bio: 'Live stream host',
    avatar_url: 'https://comfy-hub-assets.comfy.org/uploads/purz.png',
    links: [
      { label: 'Site', url: 'https://purz.xyz' },
      { label: 'Plain', url: 'http://purz.xyz' },
      { label: 'Bad', url: 'javascript:alert(1)' },
      { label: 'Bare', url: 'purz.xyz' }
    ]
  }

  it('reads the profile and the first page of its public workflow cards', async () => {
    const call = serve({
      '/api/v1/catalog/creators/purz': () => Response.json(profile),
      '/api/v1/catalog/cards': () => Response.json(cardsPage())
    })

    const result = await loadCatalogCreator(undefined, 'en', 'purz')

    assert(result.status === 'ok')
    expect(result.creator).toEqual({
      username: 'purz',
      displayName: 'Purz',
      description: 'Live stream host',
      avatarUrl:
        'https://comfy-hub-assets.comfy.org/cdn-cgi/image/width=400,format=auto,quality=82/uploads/purz.png',
      websiteUrls: ['https://purz.xyz']
    })
    expect(result.workflows.map(({ name }) => name)).toEqual(['Purz flow'])
    expect(result.nextCursor).toBe('signed-next')
    const cards = call(1)
    expect(cards.pathname).toBe('/api/v1/catalog/cards')
    expect(cards.searchParams.get('author')).toBe('purz')
    expect(cards.searchParams.get('kind')).toBe('WORKFLOW')
  })

  it.for([
    {
      case: 'served over plain http',
      avatar: 'http://comfy-hub-assets.comfy.org/uploads/purz.png'
    },
    { case: 'on another host', avatar: 'https://tracker.example/purz.png' },
    { case: 'not a web URL', avatar: 'javascript:alert(1)' }
  ])('drops an avatar $case', async ({ avatar }) => {
    serve({
      '/api/v1/catalog/creators/purz': () =>
        Response.json({ ...profile, avatar_url: avatar }),
      '/api/v1/catalog/cards': () => Response.json(cardsPage())
    })

    const result = await loadCatalogCreator(undefined, 'en', 'purz')

    assert(result.status === 'ok')
    expect(result.creator.avatarUrl).toBeUndefined()
  })

  it.for([
    { status: 404, expected: 'missing' },
    { status: 500, expected: 'unavailable' }
  ])(
    'reports a profile answered with $status as $expected',
    async ({ status, expected }) => {
      serve({
        '/api/v1/catalog/creators/ghost': () => new Response(null, { status })
      })

      expect(await loadCatalogCreator(undefined, 'en', 'ghost')).toEqual({
        status: expected
      })
    }
  )

  it('reports the page unavailable when the workflow cards cannot be read', async () => {
    serve({
      '/api/v1/catalog/creators/purz': () => Response.json(profile),
      '/api/v1/catalog/cards': () => new Response(null, { status: 502 })
    })

    expect(await loadCatalogCreator(undefined, 'en', 'purz')).toEqual({
      status: 'unavailable'
    })
  })

  it('reads a bio of 5000 characters and lowercases a mixed-case username', async () => {
    serve({
      '/api/v1/catalog/creators/purz': () =>
        Response.json({ ...profile, username: 'PurZ', bio: 'b'.repeat(5000) }),
      '/api/v1/catalog/cards': () => Response.json(cardsPage())
    })

    const result = await loadCatalogCreator(undefined, 'en', 'purz')

    assert(result.status === 'ok')
    expect(result.creator.username).toBe('purz')
    expect(result.creator.description).toHaveLength(5000)
  })

  it.for(['..', '../admin', 'a'.repeat(31)])(
    'answers %s as missing without a catalog read',
    async (username) => {
      serve({})

      expect(await loadCatalogCreator(undefined, 'en', username)).toEqual({
        status: 'missing'
      })
      expect(fetch).not.toHaveBeenCalled()
    }
  )
})

describe('loadCreatorPage', () => {
  it.for([
    { locale: 'en', location: '/hub/creators/purz/' },
    { locale: 'zh-CN', location: '/zh-CN/hub/creators/purz/' }
  ])(
    'redirects a mixed-case username to the lowercase $locale URL',
    async ({ locale, location }) => {
      serve({})

      expect(await loadCreatorPage(undefined, locale, 'PurZ')).toEqual({
        status: 'redirect',
        location
      })
      expect(fetch).not.toHaveBeenCalled()
    }
  )
})
