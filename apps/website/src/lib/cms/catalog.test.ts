import { describe, expect, it, vi } from 'vitest'
import { createContext } from 'astro/middleware'

import { entries } from '@website/scripts/export-cms-seed'
import { cmsEnabled, loadSiteCatalog } from '@/lib/cms/catalog'
import { fieldsForDefinition } from '@/config/workshop-form-definition'
import type { AuthoringSession } from './authoring-session'
import { workshopWorkflowDefinitionSchema } from '@/config/workshop-workflow-definition'
import { GET } from '@/routes/models/page.json'

describe('website CMS boundary', () => {
  it('reads the verified authoring session Draft and timewarp through the private projection', async () => {
    vi.stubEnv('SITE_CATALOG_API_URL', 'http://localhost:8099')
    const upstream = vi
      .fn<typeof fetch>()
      .mockResolvedValue(new Response('', { status: 503 }))
    vi.mocked(fetch).mockImplementation(upstream)
    const session: AuthoringSession = {
      actor_uid: '00000000-0000-4000-8000-000000000003',
      owner_uid: '00000000-0000-4000-8000-000000000001',
      can_edit: true,
      can_apply: true,
      credential: 'local-test-credential',
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
    await loadSiteCatalog(session, 'en', 'workflows/one-detail', false)
    const [url, options] = upstream.mock.calls[0]
    expect(String(url)).toBe(
      'http://localhost:8099/admin/api/site/catalog?view=DRAFT&eligible=true&now=2026-10-15T09%3A00%3A00Z&workflow_slug=workflows%2Fone-detail'
    )
    expect(options?.headers).toEqual({
      Authorization: 'Bearer local-test-credential'
    })
    expect(options?.cache).toBe('no-store')
  })
  it('retains the legacy source unless opted in', () => {
    vi.stubEnv('SITE_CATALOG_API_URL', '')
    expect(cmsEnabled()).toBe(false)
  })

  it('expands a single workflow only for explicit detail loads', async () => {
    vi.stubEnv('SITE_CATALOG_API_URL', 'http://localhost:8099')
    const upstream = vi
      .fn<typeof fetch>()
      .mockResolvedValue(new Response('', { status: 503 }))
    vi.mocked(fetch).mockImplementation(upstream)
    await loadSiteCatalog(undefined, 'en', 'workflows/one-detail')
    expect(String(upstream.mock.calls[0][0])).toBe(
      'http://localhost:8099/api/v1/catalog/items?workflow_slug=workflows%2Fone-detail'
    )
    expect(await loadSiteCatalog()).toEqual({ ok: false, status: 503 })
    expect(upstream).toHaveBeenCalledTimes(1)
  })

  it('parses every existing public card and input definition with bounded detail requests', async () => {
    vi.stubEnv('SITE_CATALOG_API_URL', 'http://localhost:8099')
    vi.mocked(fetch).mockImplementation((input) => {
      const slug = new URL(String(input)).searchParams.get('workflow_slug')
      const item = entries.find((entry) => entry.slug === slug)
      return Promise.resolve(
        Response.json({
          revision_id: 1,
          generation: 0,
          items: item
            ? [{ ...item, revision: 1, deleted: false, edit_version: item.uid }]
            : []
        })
      )
    })
    const results = await Promise.all(
      entries.map((item) => loadSiteCatalog(undefined, 'en', item.slug, false))
    )
    expect(results.every((result) => result.ok)).toBe(true)
    const models = results.flatMap((result) => (result.ok ? result.models : []))
    const details = results.flatMap((result) =>
      result.ok ? result.details : []
    )
    expect(models).toHaveLength(entries.length)
    expect(details).toHaveLength(
      entries.filter((item) => item.kind !== 'APP').length
    )
    expect(
      details.some((model) =>
        'form' in model && model.form
          ? fieldsForDefinition(model.form).length > 0
          : false
      )
    ).toBe(true)
  })

  it('fails closed on upstream outage instead of silently using JSONL', async () => {
    vi.stubEnv('SITE_CATALOG_API_URL', 'http://localhost:8099')
    vi.mocked(fetch).mockImplementation(
      vi.fn<typeof fetch>().mockResolvedValue(new Response('', { status: 503 }))
    )
    expect(await loadSiteCatalog()).toEqual({ ok: false, status: 503 })
  })

  it('rejects production before making an upstream request', async () => {
    vi.stubEnv('SITE_CATALOG_API_URL', 'http://localhost:8099')
    vi.stubEnv('VERCEL_ENV', 'production')
    expect(cmsEnabled()).toBe(false)
    const upstream = vi.fn<typeof fetch>()
    vi.mocked(fetch).mockImplementation(upstream)
    expect((await loadSiteCatalog()).ok).toBe(false)
    expect(upstream).not.toHaveBeenCalled()
  })

  it('drops a mismatched workflow without throwing or hiding a healthy detail', async () => {
    vi.stubEnv('SITE_CATALOG_API_URL', 'http://localhost:8099')
    const broken = entries.find((item) => 'workflow' in item.data)
    if (!broken || !('workflow' in broken.data))
      throw new Error('The seed has no workflow entry')
    const workflow = workshopWorkflowDefinitionSchema.parse(
      broken.data.workflow
    )
    const mismatched = {
      ...broken,
      data: {
        ...broken.data,
        workflow: {
          ...workflow,
          inputSchema: {
            ...workflow.inputSchema,
            properties: {
              ...workflow.inputSchema.properties,
              undeclared: { type: 'string' }
            }
          }
        }
      }
    }
    vi.mocked(fetch).mockImplementation((input) => {
      const slug = new URL(String(input)).searchParams.get('workflow_slug')
      const item =
        slug === broken.slug
          ? mismatched
          : entries.find((entry) => entry.slug === slug)
      return Promise.resolve(
        Response.json({
          revision_id: 1,
          generation: 0,
          items: item
            ? [{ ...item, revision: 1, deleted: false, edit_version: item.uid }]
            : []
        })
      )
    })
    const result = await loadSiteCatalog(undefined, 'en', broken.slug, false)
    expect(result).toMatchObject({
      ok: true,
      projection: { items: [] },
      models: [],
      details: []
    })
    const response = await GET(
      createContext({
        request: new Request(
          `https://comfy.org/models/${broken.slug}/page.json`
        ),
        params: { slug: broken.slug },
        defaultLocale: 'en'
      })
    )
    expect(response.status).toBe(404)
    const healthy = entries.find((entry) => entry.kind === 'MODEL')
    if (!healthy) throw new Error('The seed has no model entry')
    const other = await loadSiteCatalog(undefined, 'en', healthy.slug, false)
    expect(other.ok).toBe(true)
    if (other.ok) expect(other.details).toHaveLength(1)
  })
})
