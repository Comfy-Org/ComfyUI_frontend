import { describe, expect, it, vi } from 'vitest'

import { entries } from '@website/scripts/export-cms-seed'
import { cmsEnabled, loadSiteCatalog } from '@/lib/cms/catalog'
import { fieldsForDefinition } from '@/config/workshop-form-definition'

describe('website CMS boundary', () => {
  it('retains the legacy source unless opted in', () => {
    vi.stubEnv('SITE_CATALOG_API_URL', '')
    expect(cmsEnabled()).toBe(false)
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
