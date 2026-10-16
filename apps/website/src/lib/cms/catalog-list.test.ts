import type {
  CccWebsiteCardsPage,
  ContentCatalogRecord
} from '@comfyorg/ingest-types'
import { assert, describe, expect, it, vi } from 'vitest'

import { loadSiteCatalogList } from './catalog-list'
import type { AuthoringSession } from './authoring-session'

const session: AuthoringSession = {
  actor_uid: '00000000-0000-4000-8000-000000000003',
  owner_uid: '00000000-0000-4000-8000-000000000001',
  can_edit: true,
  can_apply: true,
  credential: 'test-credential',
  csrf: 'a'.repeat(64),
  state: {
    live_rev: 4,
    draft_rev: 5,
    next_rev: 6,
    draft_generation: 0,
    previous_live_rev: null
  },
  preview: { view: 'DRAFT', now: '2026-10-15T09:00:00Z' }
}

function card(): ContentCatalogRecord {
  return {
    uid: '00000000-0000-4000-8000-000000000010',
    edit_version: '00000000-0000-4000-8000-000000000011',
    revision: 1,
    deleted: false,
    enabled: true,
    visibility: 'PUBLIC',
    kind: 'WORKFLOW',
    slug: '/hub/workflows/card-only',
    data: { type: 'workflow', title: 'Workflow card', slug: 'card-only' }
  }
}

function page(): CccWebsiteCardsPage {
  return {
    revision_id: 4,
    items: [card()],
    page_size: 24,
    has_more: true,
    next_cursor: 'signed-next',
    available_kinds: ['MODEL', 'WORKFLOW', 'APP'],
    sort_orders: ['popular', 'name'],
    facets: {
      categories: [{ value: '', label: '' }],
      models: [{ value: 'model-uid', label: 'Model name' }],
      use_cases: []
    }
  }
}

function setup(data: unknown = page()) {
  vi.stubEnv('SITE_CATALOG_API_URL', 'http://localhost:8099')
  vi.stubEnv('VERCEL_ENV', 'development')
  const upstream = vi
    .fn<typeof fetch>()
    .mockImplementation(async () => Response.json(data))
  vi.mocked(fetch).mockImplementation(upstream)
  return upstream
}

describe('bounded website catalog transport', () => {
  it('requests only the active kind and retains server order, cursors and global metadata', async () => {
    const response = page()
    response.previous_cursor = 'signed-back'
    const upstream = setup(response)
    const result = await loadSiteCatalogList(
      undefined,
      'en',
      'workflows',
      new URLSearchParams(
        'p=3&cursor=signed-current&q=semantic+match&model=model-uid&category=&sort=name'
      )
    )
    assert.isTrue(result.ok)
    const url = new URL(String(upstream.mock.calls[0][0]))
    expect(url.pathname).toBe('/api/v1/catalog/cards')
    expect(Object.fromEntries(url.searchParams)).toMatchObject({
      kind: 'WORKFLOW',
      limit: '24',
      cursor: 'signed-current',
      q: 'semantic match',
      model: 'model-uid',
      category: '',
      sort: 'name'
    })
    expect(url.searchParams.has('p')).toBe(false)
    expect(result.models.map((item) => item.name)).toEqual(['Workflow card'])
    expect(result.pages.workflows).toMatchObject({
      page: 3,
      count: 1,
      nextCursor: 'signed-next',
      previousCursor: 'signed-back',
      hasPrevious: true,
      hasNext: true
    })
    expect(result.pages.workflows.total).toBeUndefined()
    expect(result.pages.apps.available).toBe(true)
    expect(result.facets.workflows.models).toEqual([
      { value: 'model-uid', label: 'Model name' }
    ])
    expect(upstream).toHaveBeenCalledTimes(1)
  })

  it.for([
    { locale: 'en', label: 'Uncategorized' },
    { locale: 'zh-CN', label: '未分类' }
  ])(
    'omits an empty category row while retaining the explicit filter in $locale',
    async ({ locale }) => {
      const upstream = setup()
      const result = await loadSiteCatalogList(
        undefined,
        locale,
        'workflows',
        new URLSearchParams('category=')
      )
      assert.isTrue(result.ok)
      expect(result.facets.workflows.categories).toEqual([])
      expect(String(upstream.mock.calls[0][0])).toContain('category=')
    }
  )

  it('keeps authored details out of the serialized card model', async () => {
    const response = page()
    Object.assign(response.items[0].data, {
      long_description: 'Private detail body',
      examples: [{ invalidDetail: true }],
      faq: [{ question: 'Question?', answer: 'Answer' }],
      unknownLargeDocument: 'not a card'
    })
    setup(response)
    const result = await loadSiteCatalogList(undefined, 'en', 'workflows')
    assert.isTrue(result.ok)
    expect(result.models).toHaveLength(1)
    expect(result.models[0]).not.toHaveProperty('examples')
    expect(result.models[0]).not.toHaveProperty('catalogDetails')
    expect(JSON.stringify(result)).not.toContain('Private detail body')
    expect(JSON.stringify(result)).not.toContain('unknownLargeDocument')
  })

  it('uses unreviewed localized titles only in selected Draft', async () => {
    const response = page()
    response.items[0].data.translations = {
      'zh-CN': { title: '草稿', review_state: 'machine' }
    }
    setup(response)
    const live = await loadSiteCatalogList(undefined, 'zh-CN', 'workflows')
    const draft = await loadSiteCatalogList(session, 'zh-CN', 'workflows')
    expect(live.ok && live.models[0].name).toBe('Workflow card')
    expect(draft.ok && draft.models[0].name).toBe('草稿')
  })

  it('retains fresh staff authorization, selected view, clock and no-store', async () => {
    const upstream = setup()
    await loadSiteCatalogList(session, 'zh-CN', 'workflows')
    const url = new URL(String(upstream.mock.calls[0][0]))
    expect(url.pathname).toBe('/admin/api/site/catalog/cards')
    expect(Object.fromEntries(url.searchParams)).toMatchObject({
      view: 'DRAFT',
      now: '2026-10-15T09:00:00Z',
      locale: 'zh-CN'
    })
    expect(upstream.mock.calls[0][1]).toMatchObject({
      headers: { Authorization: 'Bearer test-credential' },
      cache: 'no-store'
    })
  })

  it('restarts an old page-only link explicitly without walking offsets', async () => {
    const upstream = setup()
    const result = await loadSiteCatalogList(
      undefined,
      'en',
      'workflows',
      new URLSearchParams('p=999')
    )
    assert.isTrue(result.ok)
    expect(result.pages.workflows).toMatchObject({ page: 1, reset: true })
    expect(upstream).toHaveBeenCalledTimes(1)
    expect(String(upstream.mock.calls[0][0])).not.toContain('cursor=')
  })

  it('retries a stale cursor once on the first page with unchanged filters', async () => {
    const upstream = setup()
    upstream.mockResolvedValueOnce(new Response(null, { status: 409 }))
    const result = await loadSiteCatalogList(
      undefined,
      'en',
      'workflows',
      new URLSearchParams('p=3&cursor=expired&category=video')
    )
    assert.isTrue(result.ok)
    expect(result.pages.workflows).toMatchObject({ page: 1, reset: true })
    expect(upstream).toHaveBeenCalledTimes(2)
    expect(String(upstream.mock.calls[1][0])).toContain('category=video')
    expect(String(upstream.mock.calls[1][0])).not.toContain('cursor=')
  })

  it.for([
    {
      name: 'more than 24 cards',
      data: { ...page(), items: Array.from({ length: 25 }, card) }
    },
    {
      name: 'unbounded full projection',
      data: { revision_id: 4, generation: 0, items: [card()] }
    },
    {
      name: 'missing next cursor',
      data: { ...page(), next_cursor: undefined }
    },
    {
      name: 'wrong kind',
      data: { ...page(), items: [{ ...card(), kind: 'MODEL' }] }
    },
    {
      name: 'future record revision',
      data: { ...page(), items: [{ ...card(), revision: 5 }] }
    },
    {
      name: 'unsafe revision',
      data: { ...page(), revision_id: 9007199254740992 }
    },
    { name: 'public total count leak', data: { ...page(), total: 50 } },
    { name: 'public generation leak', data: { ...page(), generation: 10 } },
    {
      name: 'public facet count leak',
      data: {
        ...page(),
        facets: {
          ...page().facets,
          models: [{ value: 'uid', label: 'Name', count: 50 }]
        }
      }
    },
    {
      name: 'oversized response',
      data: { ...page(), padding: 'x'.repeat(262144) }
    }
  ])(
    'fails closed for $name without a full-list fallback',
    async ({ data }) => {
      const upstream = setup(data)
      expect(await loadSiteCatalogList(undefined, 'en', 'workflows')).toEqual({
        ok: false,
        status: 503
      })
      expect(upstream).toHaveBeenCalledTimes(1)
    }
  )

  it('fails closed for an unavailable service without another endpoint', async () => {
    const upstream = setup()
    upstream.mockRejectedValueOnce(new Error('offline'))
    expect(await loadSiteCatalogList(undefined, 'en', 'workflows')).toEqual({
      ok: false,
      status: 503
    })
    expect(upstream).toHaveBeenCalledTimes(1)
  })

  it('rejects production before requesting data', async () => {
    const upstream = setup()
    vi.stubEnv('VERCEL_ENV', 'production')
    expect(await loadSiteCatalogList(undefined)).toEqual({
      ok: false,
      status: 503
    })
    expect(upstream).not.toHaveBeenCalled()
  })
})
