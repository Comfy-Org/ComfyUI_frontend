import { describe, expect, it, vi } from 'vitest'

import { entries } from '@website/scripts/export-cms-seed'
import { cmsEnabled, loadSiteCatalog } from '@/lib/cms/catalog'
import { fieldsForDefinition } from '@/config/workshop-form-definition'
import { workshopWorkflowDefinitionSchema } from '@/config/workshop-workflow-definition'

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

  it('keeps the static Hub in production even when the CMS is configured', () => {
    vi.stubEnv('SITE_CATALOG_API_URL', 'http://localhost:8099')
    vi.stubEnv('VERCEL_ENV', 'production')
    expect(cmsEnabled()).toBe(false)
  })

  it('drops an unreadable item and keeps the rest of the catalog', async () => {
    vi.stubEnv('SITE_CATALOG_API_URL', 'http://localhost:8099')
    const [broken, ...valid] = entries.filter((item) => item.kind === 'MODEL')
    vi.stubGlobal(
      'fetch',
      vi.fn<typeof fetch>().mockResolvedValue(
        Response.json({
          revision_id: 1,
          generation: 0,
          items: [
            { ...broken, data: { slug: broken.data.slug } },
            ...valid
          ].map((item) => ({
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
    expect(result.models).toHaveLength(valid.length)
    expect(result.models.some((model) => model.slug === broken.data.slug)).toBe(
      false
    )
  })

  it('drops a workflow whose inputs do not match its schema and keeps the rest', async () => {
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
    vi.stubGlobal(
      'fetch',
      vi.fn<typeof fetch>().mockResolvedValue(
        Response.json({
          revision_id: 1,
          generation: 0,
          items: entries
            .map((item) => (item === broken ? mismatched : item))
            .map((item) => ({
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
    const isBroken = (model: { slug: string }) =>
      model.slug === broken.data.slug
    expect(result.projection.items.map((item) => item.uid)).toEqual(
      entries.filter((item) => item !== broken).map((item) => item.uid)
    )
    expect(result.models.some(isBroken)).toBe(false)
    expect(result.details.some(isBroken)).toBe(false)
    expect(result.models).toHaveLength(entries.length - 1)
    expect(result.details).toHaveLength(
      entries.filter((item) => item.kind !== 'APP').length - 1
    )
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
