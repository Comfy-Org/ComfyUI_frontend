import { describe, expect, it, vi } from 'vitest'

import { entries } from '@website/scripts/export-cms-seed'
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

function setup() {
  vi.stubEnv('SITE_CATALOG_API_URL', 'http://localhost:8099')
  vi.stubEnv('VERCEL_ENV', 'development')
  const item = entries.find((entry) => entry.kind === 'MODEL')
  if (!item) throw new Error('Expected an existing card fixture')
  const rows = Array.from({ length: 60 }, (_, i) => ({
    ...item,
    uid: `00000000-0000-4000-8000-${String(i + 1).padStart(12, '0')}`,
    revision: 1,
    deleted: false,
    edit_version: '00000000-0000-4000-8000-000000000100',
    data: {
      ...item.data,
      name: `Card ${String(i).padStart(2, '0')}`,
      slug: `card-${i}`,
      provider: i >= 30 ? 'wanted' : 'other',
      unknownLargeDocument: 'large'.repeat(1000),
      examples: [{ invalidDetail: true }]
    }
  }))
  const upstream = vi
    .fn<typeof fetch>()
    .mockResolvedValue(
      Response.json({ revision_id: 1, generation: 0, items: rows })
    )
  vi.stubGlobal('fetch', upstream)
  return upstream
}

describe('bounded website catalog summaries', () => {
  it('keeps workflow body, FAQ and detailed facts out of card summaries', async () => {
    const upstream = setup()
    const workflow = entries.find((entry) => entry.kind === 'WORKFLOW')
    if (!workflow) throw new Error('Expected a workflow fixture')
    upstream.mockResolvedValueOnce(
      Response.json({
        revision_id: 1,
        generation: 0,
        items: [
          {
            ...workflow,
            revision: 1,
            deleted: false,
            edit_version: workflow.uid,
            data: {
              type: 'workflow',
              title: 'Workflow card',
              slug: 'card-only',
              long_description: 'Detail only body '.repeat(100),
              faq: [
                {
                  question: 'Detail only question',
                  answer: 'Detail only answer'
                }
              ],
              works_on_cloud: false,
              runs: 0,
              downloads: 123
            }
          }
        ]
      })
    )
    const result = await loadSiteCatalogList(undefined, 'en', 'workflows')
    expect(result.ok).toBe(true)
    if (!result.ok) return
    expect(result.models).toHaveLength(1)
    expect(result.models[0].name).toBe('Workflow card')
    expect(result.models[0]).not.toHaveProperty('catalogDetails')
    expect(JSON.stringify(result.models)).not.toContain('Detail only')
  })

  it('bounds every tab independently while retaining global facet counts', async () => {
    const upstream = setup()
    const workflow = entries.find((entry) => entry.kind === 'WORKFLOW')
    const app = entries.find((entry) => entry.kind === 'APP')
    if (!workflow || !app) throw new Error('Expected workflow and app fixtures')
    upstream.mockResolvedValueOnce(
      Response.json({
        revision_id: 1,
        generation: 0,
        items: [workflow, app].flatMap((entry, kind) =>
          Array.from({ length: 50 }, (_, i) => ({
            ...entry,
            uid: `00000000-0000-4000-8000-${String(kind * 100 + i + 1).padStart(12, '0')}`,
            revision: 1,
            deleted: false,
            edit_version: '00000000-0000-4000-8000-000000000200',
            data: {
              ...entry.data,
              category: 'test',
              categoryLabel: { en: 'Test', 'zh-CN': '测试' },
              models: ['Model X']
            }
          }))
        )
      })
    )
    const result = await loadSiteCatalogList(
      undefined,
      'zh-CN',
      'workflows',
      new URLSearchParams('category=test&model=Model+X&p=2')
    )
    expect(result.ok).toBe(true)
    if (!result.ok) return
    expect(result.models).toHaveLength(48)
    expect(result.pages.workflows).toMatchObject({ total: 50, page: 2 })
    expect(result.pages.apps).toMatchObject({ total: 50, page: 1 })
    expect(result.facets.workflows.categories).toEqual([
      { value: 'test', label: '测试', count: 50 }
    ])
    expect(result.facets.workflows.models).toEqual([
      { value: 'Model X', count: 50 }
    ])
  })

  it('uses unreviewed localized titles only for selected Draft', async () => {
    const upstream = setup()
    const fixture = entries.find((entry) => entry.kind === 'MODEL')
    if (!fixture) throw new Error('Expected model fixture')
    const native = {
      ...fixture,
      revision: 1,
      deleted: false,
      edit_version: fixture.uid,
      data: {
        type: 'model',
        title: 'Source',
        slug: 'native',
        translations: { 'zh-CN': { title: '草稿', review_state: 'machine' } }
      }
    }
    const respond = () =>
      Response.json({ revision_id: 1, generation: 0, items: [native] })
    upstream.mockImplementation(async () => respond())
    const live = await loadSiteCatalogList(undefined, 'zh-CN')
    const draft = await loadSiteCatalogList(session, 'zh-CN')
    expect(live.ok && live.models[0].name).toBe('Source')
    expect(draft.ok && draft.models[0].name).toBe('草稿')
  })

  it('caps cards and excludes authored detail and arbitrary fields', async () => {
    setup()
    const result = await loadSiteCatalogList(undefined)
    expect(result.ok).toBe(true)
    if (!result.ok) return
    expect(result.models).toHaveLength(24)
    expect(result.pages.models).toMatchObject({
      total: 60,
      totalPages: 3,
      page: 1,
      hasNext: true
    })
    expect(result.models[0]).not.toHaveProperty('unknownLargeDocument')
    expect(result.models[0]).not.toHaveProperty('examples')
    expect(result.models[0]).not.toHaveProperty('execution')
    expect(result).not.toHaveProperty('projection')
    expect(result).not.toHaveProperty('details')
  })

  it('filters and sorts the complete selected list before taking page two', async () => {
    setup()
    const result = await loadSiteCatalogList(
      undefined,
      'en',
      'models',
      new URLSearchParams('provider=wanted&sort=name&p=2')
    )
    expect(result.ok).toBe(true)
    if (!result.ok) return
    expect(result.pages.models).toMatchObject({
      total: 30,
      page: 2,
      hasPrevious: true,
      hasNext: false
    })
    expect(result.models.map((m) => m.name)).toEqual([
      'Card 54',
      'Card 55',
      'Card 56',
      'Card 57',
      'Card 58',
      'Card 59'
    ])
  })

  it.for(['0', '-1', '1.5', 'Infinity', '9007199254740992', 'bad'])(
    'defaults invalid page %s to page one',
    async (p) => {
      setup()
      const result = await loadSiteCatalogList(
        undefined,
        'en',
        'models',
        new URLSearchParams({ p })
      )
      expect(result.ok && result.pages.models.page).toBe(1)
    }
  )

  it('clamps a valid beyond-last page', async () => {
    setup()
    const result = await loadSiteCatalogList(
      undefined,
      'en',
      'models',
      new URLSearchParams('p=999')
    )
    expect(result.ok && result.pages.models.page).toBe(3)
    expect(result.ok && result.models.length).toBe(12)
  })

  it('retains selected staff view, time and no-store authorization', async () => {
    const upstream = setup()
    await loadSiteCatalogList(session, 'zh-CN')
    expect(String(upstream.mock.calls[0][0])).toBe(
      'http://localhost:8099/admin/api/site/catalog?view=DRAFT&eligible=true&now=2026-10-15T09%3A00%3A00Z'
    )
    expect(upstream.mock.calls[0][1]).toMatchObject({
      headers: { Authorization: 'Bearer test-credential' },
      cache: 'no-store'
    })
  })

  it('rejects malformed projection and request failures without fallback', async () => {
    const upstream = setup()
    upstream.mockResolvedValueOnce(Response.json({ items: [] }))
    expect(await loadSiteCatalogList(undefined)).toEqual({
      ok: false,
      status: 503
    })
    upstream.mockRejectedValueOnce(new Error('offline'))
    expect(await loadSiteCatalogList(undefined)).toEqual({
      ok: false,
      status: 503
    })
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
