// @vitest-environment node
import { createContext } from 'astro/middleware'
import { describe, expect, it, vi } from 'vitest'
import { GET, HEAD } from './media'

const uid = '00000000-0000-4000-8000-000000000021'
const version = '00000000-0000-4000-8000-000000000022'
function context(preview = true, staff = true, suffix = '', range = false) {
  const ctx = createContext({
    request: new Request(
      `https://website.example/${preview ? `preview-media/2` : 'catalog-media'}/${uid}/${version}${suffix}`,
      {
        headers: range ? { Range: 'bytes=0-10' } : {}
      }
    ),
    defaultLocale: 'en',
    clientAddress: '127.0.0.1'
  })
  ctx.params = { uid, version, ...(preview ? { rev: '2' } : {}) }
  if (staff)
    ctx.locals.catalogAuthoring = {
      credential: 'verified-server-only-fixture',
      csrf: 'a'.repeat(64),
      actor_uid: '00000000-0000-4000-8000-000000000003',
      owner_uid: '00000000-0000-4000-8000-000000000001',
      can_edit: true,
      can_apply: false,
      state: {
        live_rev: 1,
        draft_rev: 2,
        next_rev: 3,
        draft_generation: 0,
        previous_live_rev: null
      }
    }
  return ctx
}
describe('same-origin catalog byte proxy', () => {
  it('serves a verified Preview video as a full authorized GET, not an unchecked partial response', async () => {
    vi.stubEnv('SITE_CATALOG_API_URL', 'http://127.0.0.1:8109')
    const fetch = vi
      .fn<typeof globalThis.fetch>()
      .mockResolvedValue(
        new Response('verified private video', {
          headers: { 'Content-Type': 'video/mp4' }
        })
      )
    vi.stubGlobal('fetch', fetch)
    const ctx = context()
    ctx.request.headers.set('Range', 'bytes=0-')
    const response = await GET(ctx)
    expect(response.status).toBe(200)
    expect(await response.text()).toBe('verified private video')
    expect(response.headers.get('Cache-Control')).toBe('private, no-store')
    expect(response.headers.get('Content-Range')).toBeNull()
    expect(fetch.mock.calls[0]?.[1]?.headers).toEqual({
      Authorization: 'Bearer verified-server-only-fixture'
    })
  })
  it.each([
    { preview: true, staff: false },
    { preview: false, staff: true }
  ])(
    'refuses a video browser range without verified Preview authority: %j',
    async ({ preview, staff }) => {
      const fetch = vi.fn<typeof globalThis.fetch>()
      vi.stubGlobal('fetch', fetch)
      const ctx = context(preview, staff)
      ctx.request.headers.set('Range', 'bytes=0-')
      expect((await GET(ctx)).status).toBe(404)
      expect(fetch).not.toHaveBeenCalled()
    }
  )
  it('never enables public video delivery by adding Preview support', async () => {
    vi.stubEnv('SITE_CATALOG_API_URL', 'http://127.0.0.1:8109')
    vi.stubGlobal(
      'fetch',
      vi
        .fn<typeof globalThis.fetch>()
        .mockResolvedValue(
          new Response('video', { headers: { 'Content-Type': 'video/mp4' } })
        )
    )
    expect((await GET(context(false))).status).toBe(404)
  })
  it('streams authorized exact Preview bytes without redirect or public caching', async () => {
    vi.stubEnv('SITE_CATALOG_API_URL', 'http://127.0.0.1:8109')
    const fetch = vi.fn<typeof globalThis.fetch>().mockResolvedValue(
      new Response('private bytes', {
        headers: { 'Content-Type': 'image/png' }
      })
    )
    vi.stubGlobal('fetch', fetch)
    const response = await GET(context())
    expect(response.status).toBe(200)
    expect(await response.text()).toBe('private bytes')
    expect(response.headers.get('Cache-Control')).toBe('private, no-store')
    expect(response.headers.get('Location')).toBeNull()
    expect(fetch).toHaveBeenCalledWith(
      new URL(
        `http://127.0.0.1:8109/api/v1/catalog/preview-media/2/${uid}/${version}`
      ),
      expect.objectContaining({
        headers: { Authorization: 'Bearer verified-server-only-fixture' },
        redirect: 'error',
        cache: 'no-store'
      })
    )
  })
  it('never forwards staff credentials or Preview selection to the public gate', async () => {
    vi.stubEnv('SITE_CATALOG_API_URL', 'http://127.0.0.1:8109')
    const fetch = vi
      .fn<typeof globalThis.fetch>()
      .mockResolvedValue(
        new Response('bytes', { headers: { 'Content-Type': 'image/png' } })
      )
    vi.stubGlobal('fetch', fetch)
    await GET(context(false))
    expect(fetch.mock.calls[0]?.[1]?.headers).toBeUndefined()
    expect(String(fetch.mock.calls[0]?.[0])).toContain('/api/v1/catalog/media/')
  })
  it.each([
    { staff: false, suffix: '', range: false },
    { staff: true, suffix: '?preview=DRAFT', range: false },
    { staff: true, suffix: '', range: true }
  ])(
    'refuses unverified or alternative byte requests before fetching: %j',
    async ({ staff, suffix, range }) => {
      const fetch = vi.fn<typeof globalThis.fetch>()
      vi.stubGlobal('fetch', fetch)
      expect((await GET(context(true, staff, suffix, range))).status).toBe(404)
      expect(fetch).not.toHaveBeenCalled()
    }
  )
  it.each(['text/html', 'image/svg+xml'])(
    'refuses executable origin types: %s',
    async (type) => {
      vi.stubEnv('SITE_CATALOG_API_URL', 'http://127.0.0.1:8109')
      vi.stubGlobal(
        'fetch',
        vi.fn<typeof globalThis.fetch>().mockResolvedValue(
          new Response('<script>untrusted</script>', {
            headers: { 'Content-Type': type }
          })
        )
      )
      const response = await GET(context())
      expect(response.status).toBe(404)
      expect(await response.text()).toBe('')
    }
  )
  it('refuses HEAD without origin access', async () => {
    const fetch = vi.fn<typeof globalThis.fetch>()
    vi.stubGlobal('fetch', fetch)
    expect((await HEAD(context())).status).toBe(404)
    expect(fetch).not.toHaveBeenCalled()
  })
  it('fails closed on unavailable current authority', async () => {
    vi.stubEnv('SITE_CATALOG_API_URL', 'http://127.0.0.1:8109')
    vi.stubGlobal(
      'fetch',
      vi
        .fn<typeof globalThis.fetch>()
        .mockRejectedValue(new Error('unavailable'))
    )
    const response = await GET(context())
    expect(response.status).toBe(404)
    expect(response.headers.get('Cache-Control')).toBe('private, no-store')
  })
})
