import { describe, expect, it, vi } from 'vitest'

import { entries } from '@website/scripts/export-cms-seed'
import { cmsEnabled, loadSiteCatalog } from '@/lib/cms/catalog'
import { fieldsForDefinition } from '@/config/workshop-form-definition'
import type { AuthoringSession } from './authoring-session'

describe('website CMS boundary', () => {
  it('reads the verified authoring session Draft and timewarp through the private projection', async () => {
    vi.stubEnv('SITE_CATALOG_API_URL', 'http://localhost:8099')
    const upstream = vi.fn<typeof fetch>().mockResolvedValue(new Response('', { status: 503 }))
    vi.stubGlobal('fetch', upstream)
    const session: AuthoringSession = {
      actor_uid: '00000000-0000-4000-8000-000000000003',
      owner_uid: '00000000-0000-4000-8000-000000000001',
      can_edit: true,
      can_apply: true,
      credential: 'local-test-credential',
      csrf: 'a'.repeat(64),
      state: { live_rev: 4, draft_rev: 5, next_rev: 6, draft_generation: 0, previous_live_rev: null },
      preview: { view: 'DRAFT', now: '2026-10-15T09:00:00Z' }
    }
    await loadSiteCatalog(session)
    const [url, options] = upstream.mock.calls[0]
    expect(String(url)).toBe('http://localhost:8099/admin/api/site/catalog?view=DRAFT&eligible=true&now=2026-10-15T09%3A00%3A00Z')
    expect(options?.headers).toEqual({ Authorization: 'Bearer local-test-credential' })
    expect(options?.cache).toBe('no-store')
  })
  it('retains the legacy source unless opted in', () => {
    vi.stubEnv('SITE_CATALOG_API_URL', '')
    expect(cmsEnabled()).toBe(false)
  })

  it('expands a single workflow only for explicit detail loads', async () => {
    vi.stubEnv('SITE_CATALOG_API_URL', 'http://localhost:8099')
    const upstream = vi.fn<typeof fetch>().mockResolvedValue(new Response('', { status: 503 }))
    vi.stubGlobal('fetch', upstream)
    await loadSiteCatalog(undefined, 'en', 'workflows/one-detail')
    expect(String(upstream.mock.calls[0][0])).toBe('http://localhost:8099/api/v1/catalog/items?workflow_slug=workflows%2Fone-detail')
    await loadSiteCatalog()
    expect(String(upstream.mock.calls[1][0])).toBe('http://localhost:8099/api/v1/catalog/items')
  })

  it('parses every existing public card and input definition from the CMS', async () => {
    vi.stubEnv('SITE_CATALOG_API_URL', 'http://localhost:8099')
    vi.stubGlobal(
      'fetch',
      vi.fn<typeof fetch>().mockResolvedValue(
        Response.json({
          revision_id: 1,
          generation: 0,
          items: entries.map((item) => ({
            ...item,
            revision: 1,
            deleted: false,
            edit_version: item.uid
          }))
        })
      )
    )
    const result = await loadSiteCatalog()
    expect(result.ok).toBe(true)
    if (!result.ok) return
    expect(result.models).toHaveLength(entries.length)
    expect(result.details.length).toBe(
      entries.filter((item) => item.kind !== 'APP').length
    )
    expect(
      result.details.some((model) =>
        model.form ? fieldsForDefinition(model.form).length > 0 : false
      )
    ).toBe(true)
  })

  it('fails closed on upstream outage instead of silently using JSONL', async () => {
    vi.stubEnv('SITE_CATALOG_API_URL', 'http://localhost:8099')
    vi.stubGlobal(
      'fetch',
      vi.fn<typeof fetch>().mockResolvedValue(new Response('', { status: 503 }))
    )
    expect(await loadSiteCatalog()).toEqual({ ok: false, status: 503 })
  })

  it('rejects production before making an upstream request', async () => {
    vi.stubEnv('SITE_CATALOG_API_URL', 'http://localhost:8099')
    vi.stubEnv('VERCEL_ENV', 'production')
    const upstream = vi.fn<typeof fetch>()
    vi.stubGlobal('fetch', upstream)
    expect((await loadSiteCatalog()).ok).toBe(false)
    expect(upstream).not.toHaveBeenCalled()
  })
})
