import type { ContentCatalogReview } from '@comfyorg/ingest-types'
import { describe, expect, it, vi } from 'vitest'

import { loadVersions, restoreVersion } from './versions'

const uid = '11111111-1111-4111-8111-111111111111'
const save = (version: string, name: string) => ({
  edit_version: version,
  saved_at: '2026-10-09T15:30:00.000Z',
  saved_by: 'staff-sam',
  kind: 'MODEL',
  slug: '/hub/models/item',
  enabled: true,
  visibility: 'PUBLIC',
  deleted: false,
  data: { name }
})

function session(canEdit = true) {
  const review: ContentCatalogReview = {
    draft: {
      revision_id: 2,
      generation: 1,
      items: [
        {
          uid,
          revision: 2,
          edit_version: 'b',
          kind: 'MODEL',
          slug: '/hub/models/item',
          enabled: true,
          deleted: false,
          visibility: 'PUBLIC',
          data: { name: 'Newer' }
        }
      ]
    },
    live: { revision_id: 1, generation: 1, items: [] },
    can_edit: canEdit,
    can_apply: false,
    history: []
  }
  return { credential: 'test-only', review, csrf: 'x' }
}

function upstream() {
  vi.stubEnv('SITE_CATALOG_API_URL', 'http://localhost:8099')
  const fetch = vi
    .fn<typeof globalThis.fetch>()
    .mockImplementation((_, init) =>
      Promise.resolve(
        init?.method === 'PUT'
          ? new Response(null, { status: 200 })
          : Response.json([save('b', 'Newer'), save('a', 'Older')])
      )
    )
  vi.stubGlobal('fetch', fetch)
  return fetch
}

describe('item versions', () => {
  it('lists who saved each version', async () => {
    upstream()
    expect(await loadVersions(session(), uid)).toEqual([
      expect.objectContaining({ editVersion: 'b', name: 'Newer' }),
      expect.objectContaining({ editVersion: 'a', savedBy: 'staff-sam' })
    ])
  })

  it('saves an earlier version over the current draft', async () => {
    const fetch = upstream()
    expect(await restoreVersion(session(), uid, 'a')).toEqual({ ok: true })
    const put = fetch.mock.calls.find(([, init]) => init?.method === 'PUT')
    expect(JSON.parse(String(put?.[1]?.body))).toMatchObject({
      edit_version: 'b',
      data: { name: 'Older' }
    })
  })

  it.for([
    ['an unknown version', true, uid, 'zzz', 'invalid'],
    ['an item outside the draft', true, 'other', 'a', 'invalid'],
    ['no edit permission', false, uid, 'a', 'denied']
  ] as const)('refuses %s', async ([, canEdit, target, version, error]) => {
    upstream()
    expect(await restoreVersion(session(canEdit), target, version)).toEqual({
      ok: false,
      error
    })
  })
})
