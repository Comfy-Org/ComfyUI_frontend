// @vitest-environment node
import { assert, describe, expect, it, vi } from 'vitest'
import type { AuthoringSession } from './authoring-session'
import { fixtureReview } from './staging-fixture'
import { loadRecordView } from './record-view'

const uid = '00000000-0000-4000-8000-000000000010'
const version = '00000000-0000-4000-8000-000000000011'
const owner = '00000000-0000-4000-8000-000000000001'
function staff(): AuthoringSession {
  return {
    credential: 'server-only-fixture',
    csrf: 'a'.repeat(64),
    actor_uid: owner,
    owner_uid: owner,
    can_edit: true,
    can_apply: false,
    state: {
      live_rev: 1,
      draft_rev: 7,
      draft_generation: 5,
      next_rev: 8,
      previous_live_rev: null
    }
  }
}
function record() {
  return {
    uid,
    revision_uid: version,
    owner_uid: owner,
    author_uid: owner,
    type: 'workflow',
    is_deleted: false,
    title: 'Record view',
    slug: 'record-view',
    enabled: false,
    visibility: 'staff',
    schema_version: 2,
    available_surfaces: ['hub']
  }
}
describe('private read-only record view', () => {
  it('resolves canonical account authors and enforces exact case-sensitive organization ownership', async () => {
    vi.stubEnv('SITE_CATALOG_API_URL', 'http://127.0.0.1:8109')
    const org = 'ComfyOrganizationAccount'
    const author = 'fPc7irbKt2VLbuIkRrWuC5TH5lX2'
    const session = { ...staff(), owner_uid: org }
    const fetch = vi
      .fn<typeof globalThis.fetch>()
      .mockResolvedValueOnce(
        Response.json({ ...record(), author_uid: author, owner_uid: org })
      )
      .mockResolvedValueOnce(Response.json(fixtureReview()))
      .mockResolvedValueOnce(
        Response.json({
          ...record(),
          author_uid: author,
          owner_uid: org.toLowerCase()
        })
      )
    vi.mocked(globalThis.fetch).mockImplementation(fetch)
    const result = await loadRecordView(session, uid, new URLSearchParams())
    assert.isTrue(result.ok)
    expect(result.document.author_uid).toBe(author)
    expect(result.document).not.toHaveProperty('owner_uid')
    const other = await loadRecordView(session, uid, new URLSearchParams())
    assert.isFalse(other.ok)
    expect(other.response.status).toBe(404)
  })
  it('loads the exact reviewed version, preserves authored literal keys and does not save', async () => {
    vi.stubEnv('SITE_CATALOG_API_URL', 'http://127.0.0.1:8109')
    const raw = {
      ...record(),
      ...JSON.parse('{"labels":{"__proto__":"literal"}}')
    }
    const fetch = vi
      .fn<typeof globalThis.fetch>()
      .mockResolvedValueOnce(Response.json(raw))
      .mockResolvedValueOnce(Response.json(fixtureReview()))
    vi.mocked(globalThis.fetch).mockImplementation(fetch)
    const result = await loadRecordView(
      staff(),
      uid,
      new URLSearchParams(`rev=7&version=${version}`)
    )
    expect(result.ok).toBe(true)
    assert.isTrue(result.ok)
    expect(result.title).toBe('Record view')
    expect(result.document.labels).toEqual(
      JSON.parse('{"__proto__":"literal"}')
    )
    expect(String(fetch.mock.calls[0]?.[0])).toBe(
      `http://127.0.0.1:8109/api/v1/catalog/revisions/7/items/${uid}`
    )
    expect(fetch.mock.calls.map((call) => call[1]?.method ?? 'GET')).toEqual([
      'GET',
      'GET'
    ])
    expect(JSON.stringify(result)).not.toContain('server-only-fixture')
  })
  it.for([
    { query: 'rev=0', status: 400 },
    { query: 'rev=9007199254740992', status: 400 },
    { query: 'rev=7&rev=8', status: 400 },
    { query: 'now=tomorrow', status: 400 },
    { query: `version=${version}`, status: 400 }
  ])(
    'refuses unsupported version selectors before a read: $query',
    async ({ query, status }) => {
      const fetch = vi.fn<typeof globalThis.fetch>()
      vi.mocked(globalThis.fetch).mockImplementation(fetch)
      const result = await loadRecordView(
        staff(),
        uid,
        new URLSearchParams(query)
      )
      assert.isFalse(result.ok)
      expect(result.response.status).toBe(status)
      expect(fetch).not.toHaveBeenCalled()
    }
  )
  it('does not silently substitute a changed record for a frozen review', async () => {
    vi.stubEnv('SITE_CATALOG_API_URL', 'http://127.0.0.1:8109')
    const fetch = vi
      .fn<typeof globalThis.fetch>()
      .mockResolvedValue(Response.json({ ...record(), revision_uid: owner }))
    vi.mocked(globalThis.fetch).mockImplementation(fetch)
    const result = await loadRecordView(
      staff(),
      uid,
      new URLSearchParams(`rev=7&version=${version}`)
    )
    assert.isFalse(result.ok)
    expect(result.response.status).toBe(409)
    expect(fetch).toHaveBeenCalledTimes(1)
  })
  it('refuses another owner even when an upstream response claims success', async () => {
    vi.stubEnv('SITE_CATALOG_API_URL', 'http://127.0.0.1:8109')
    vi.mocked(globalThis.fetch).mockImplementation(
      vi
        .fn<typeof globalThis.fetch>()
        .mockResolvedValue(Response.json({ ...record(), owner_uid: version }))
    )
    const result = await loadRecordView(staff(), uid, new URLSearchParams())
    assert.isFalse(result.ok)
    expect(result.response.status).toBe(404)
  })
  it('does not read records for anonymous requests', async () => {
    const fetch = vi.fn<typeof globalThis.fetch>()
    vi.mocked(globalThis.fetch).mockImplementation(fetch)
    const result = await loadRecordView(undefined, uid, new URLSearchParams())
    assert.isFalse(result.ok)
    expect(result.response.status).toBe(404)
    expect(fetch).not.toHaveBeenCalled()
  })
  it('supports media inspection without enabling a media edit or exposing origin URLs', async () => {
    vi.stubEnv('SITE_CATALOG_API_URL', 'http://127.0.0.1:8109')
    vi.mocked(globalThis.fetch).mockImplementation(
      vi
        .fn<typeof globalThis.fetch>()
        .mockResolvedValueOnce(
          Response.json({
            ...record(),
            type: 'media',
            name: 'local/photo.png',
            mime_type: 'image/png'
          })
        )
        .mockResolvedValueOnce(new Response(null, { status: 503 }))
    )
    const result = await loadRecordView(staff(), uid, new URLSearchParams())
    assert.isTrue(result.ok)
    expect(result.preview).toEqual({
      kind: 'image',
      src: `/preview-media/7/${uid}/${version}`
    })
    expect(result.presentation).toBeUndefined()
  })
})
