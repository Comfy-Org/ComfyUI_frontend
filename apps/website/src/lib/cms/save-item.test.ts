import type {
  ContentCatalogRecord,
  ContentCatalogReview
} from '@comfyorg/ingest-types'
import { describe, expect, it, vi } from 'vitest'

import { undoDraftItem } from './save-item'

const record = (changes: Partial<ContentCatalogRecord>) => ({
  uid: '11111111-1111-4111-8111-111111111111',
  revision: 1,
  edit_version: 'live',
  kind: 'MODEL' as const,
  slug: '/hub/models/item',
  enabled: true,
  deleted: false,
  visibility: 'PUBLIC' as const,
  data: { name: 'Item' },
  ...changes
})

function session(draft: ContentCatalogRecord, live?: ContentCatalogRecord) {
  const review: ContentCatalogReview = {
    draft: { revision_id: 2, generation: 1, items: [draft] },
    live: { revision_id: 1, generation: 1, items: live ? [live] : [] },
    can_edit: true,
    can_apply: false,
    history: []
  }
  return { credential: 'test-only', review, csrf: 'x' }
}

function sentBody() {
  vi.stubEnv('SITE_CATALOG_API_URL', 'http://localhost:8099')
  const upstream = vi
    .fn<typeof fetch>()
    .mockResolvedValue(new Response(null, { status: 200 }))
  vi.stubGlobal('fetch', upstream)
  return () => JSON.parse(String(upstream.mock.calls[0][1]?.body))
}

describe('undoDraftItem', () => {
  it('saves the live value over the draft edit', async () => {
    const body = sentBody()
    const live = record({})
    const draft = record({ edit_version: 'draft', data: { name: 'Changed' } })
    await expect(
      undoDraftItem(session(draft, live), draft.uid)
    ).resolves.toEqual({ ok: true })
    expect(body()).toMatchObject({
      draft_id: 2,
      edit_version: 'draft',
      deleted: false,
      data: { name: 'Item' }
    })
  })

  it('takes a never-published item out of the draft', async () => {
    const body = sentBody()
    const draft = record({ edit_version: 'draft' })
    await undoDraftItem(session(draft), draft.uid)
    expect(body()).toMatchObject({ deleted: true })
  })

  it('needs edit permission and an item in the draft', async () => {
    const draft = record({})
    const readOnly = session(draft)
    readOnly.review.can_edit = false
    expect(await undoDraftItem(readOnly, draft.uid)).toEqual({
      ok: false,
      error: 'denied'
    })
    expect(await undoDraftItem(session(draft), 'other')).toEqual({
      ok: false,
      error: 'invalid'
    })
  })
})
