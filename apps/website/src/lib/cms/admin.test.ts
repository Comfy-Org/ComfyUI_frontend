import { describe, expect, it, vi } from 'vitest'
import type { ContentCatalogReview } from '@comfyorg/ingest-types'
import { draftChanges, parsePreview, verifySiteSession } from './admin'

const empty: ContentCatalogReview = {
  draft: { revision_id: 2, generation: 3, items: [] },
  live: { revision_id: 1, generation: 1, items: [] },
  can_edit: true,
  can_apply: false,
  history: []
}

describe('staff site administration boundary', () => {
  it('does not accept permission claims without backend verification', async () => {
    vi.stubEnv('SITE_CATALOG_API_URL', 'http://localhost:8099')
    const upstream = vi
      .fn<typeof fetch>()
      .mockResolvedValue(new Response(null, { status: 403 }))
    vi.stubGlobal('fetch', upstream)
    expect(await verifySiteSession('ordinary-account-token')).toBeUndefined()
    expect(upstream).toHaveBeenCalledOnce()
  })

  it('rejects malformed credentials before an upstream request', async () => {
    const upstream = vi.fn<typeof fetch>()
    vi.stubGlobal('fetch', upstream)
    expect(await verifySiteSession('token\r\nInjected: yes')).toBeUndefined()
    expect(await verifySiteSession('')).toBeUndefined()
    expect(upstream).not.toHaveBeenCalled()
  })

  it('allows an applier to review without granting edit', async () => {
    vi.stubEnv('SITE_CATALOG_API_URL', 'http://localhost:8099')
    vi.stubGlobal(
      'fetch',
      vi
        .fn<typeof fetch>()
        .mockResolvedValue(
          Response.json({ ...empty, can_edit: false, can_apply: true })
        )
    )
    expect(await verifySiteSession('verified-applier')).toMatchObject({
      can_edit: false,
      can_apply: true,
      draft: { generation: 3 }
    })
  })

  it('does not authorize an ordinary account even on a successful response', async () => {
    vi.stubEnv('SITE_CATALOG_API_URL', 'http://localhost:8099')
    vi.stubGlobal(
      'fetch',
      vi
        .fn<typeof fetch>()
        .mockResolvedValue(
          Response.json({ ...empty, can_edit: false, can_apply: false })
        )
    )
    expect(await verifySiteSession('ordinary-account-token')).toBeUndefined()
  })

  it('normalizes integer revisions for rendering and enforces Draft = Live + 1', async () => {
    vi.stubEnv('SITE_CATALOG_API_URL', 'http://localhost:8099')
    const upstream = vi.fn<typeof fetch>()
    vi.stubGlobal('fetch', upstream)
    upstream.mockResolvedValueOnce(
      Response.json({ ...empty, previous_live_id: 1 })
    )
    const review = await verifySiteSession('verified-editor')
    expect(review?.draft.revision_id).toBe(2)
    expect(review?.live.revision_id).toBe(1)
    expect(review?.previous_live_id).toBe(1)
    expect(() => JSON.stringify(review)).not.toThrow()
    upstream.mockResolvedValueOnce(
      Response.json({ ...empty, draft: { ...empty.draft, revision_id: 4 } })
    )
    expect(await verifySiteSession('verified-editor')).toBeUndefined()
    upstream.mockResolvedValueOnce(
      Response.json({
        ...empty,
        draft: { ...empty.draft, revision_id: Number.MAX_SAFE_INTEGER + 1 }
      })
    )
    expect(await verifySiteSession('verified-editor')).toBeUndefined()
  })

  it('validates view and normalizes timewarp to UTC', () => {
    expect(
      parsePreview('{"view":"DRAFT","now":"2026-10-15T09:00:00-07:00"}')
    ).toEqual({ view: 'DRAFT', now: '2026-10-15T16:00:00.000Z' })
    expect(parsePreview('{"view":"ADMIN"}')).toBeUndefined()
    expect(parsePreview('{"view":"LIVE","now":"not-a-date"}')).toBeUndefined()
    expect(parsePreview('not-json')).toBeUndefined()
    expect(parsePreview('{"view":"DRAFT","now":"2026-10-15"}')).toBeUndefined()
  })

  it('compares exact entity edit versions, not catalog IDs or generations', () => {
    const record = {
      uid: 'item',
      revision: 1,
      edit_version: 'a',
      kind: 'MODEL' as const,
      slug: '/hub/models/item',
      enabled: true,
      deleted: false,
      visibility: 'PUBLIC' as const,
      data: { name: 'Item' }
    }
    const review = {
      ...empty,
      live: { ...empty.live, items: [record] },
      draft: { ...empty.draft, items: [record] }
    }
    expect(draftChanges(review)).toEqual([])
    review.draft.items = [
      { ...record, edit_version: 'b', data: { name: 'Changed' } }
    ]
    expect(draftChanges(review)).toHaveLength(1)
    expect(draftChanges(review)[0].before?.data.name).toBe('Item')
    expect(draftChanges(review)[0].after?.data.name).toBe('Changed')
    review.draft.items = [{ ...record, edit_version: 'c' }]
    expect(draftChanges(review)).toEqual([])
  })
})
