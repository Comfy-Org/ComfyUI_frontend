// @vitest-environment node
import { createContext } from 'astro/middleware'
import { describe, expect, it, vi } from 'vitest'
import {
  AUTHORING_COOKIE,
  AUTHORING_CSRF_COOKIE,
  loadAuthoringSession,
  verifyAuthoringCredential
} from './authoring-session'
import { loadEditorData } from './editor-server'

const uid = '00000000-0000-4000-8000-000000000001'
const authority = {
  actor_uid: uid,
  owner_uid: uid,
  can_edit: true,
  can_apply: false,
  state: {
    live_rev: 1,
    draft_rev: 7,
    previous_live_rev: null,
    next_rev: 8,
    draft_generation: 4
  }
}
function backend(status = 200, body: unknown = authority) {
  vi.stubEnv('SITE_CATALOG_API_URL', 'http://catalog.example')
  vi.stubEnv('VERCEL_ENV', 'preview')
  const fetcher = vi
    .fn()
    .mockImplementation(() => Promise.resolve(Response.json(body, { status })))
  vi.stubGlobal('fetch', fetcher)
  return fetcher
}
function context() {
  const ctx = createContext({
    request: new Request('https://website.example/admin/content/new'),
    defaultLocale: 'en',
    clientAddress: '127.0.0.1'
  })
  ctx.cookies.set(AUTHORING_COOKIE, 'private-fixture')
  ctx.cookies.set(AUTHORING_CSRF_COOKIE, 'a'.repeat(64))
  return ctx
}
describe('fresh CCC authorization', () => {
  it('does not cache grants from an earlier request', async () => {
    const fetcher = backend()
    const ctx = context()
    expect((await loadAuthoringSession(ctx)).ok).toBe(true)
    fetcher.mockResolvedValueOnce(
      Response.json({ message: 'revoked' }, { status: 403 })
    )
    const denied = await loadAuthoringSession(ctx)
    expect(denied.ok).toBe(false)
    if (!denied.ok) expect(denied.response.status).toBe(403)
    expect(fetcher).toHaveBeenCalledTimes(2)
  })
  it('does not grant authoring from an expired cookie or missing CSRF', async () => {
    const fetcher = backend(401)
    const denied = await loadAuthoringSession(context())
    if (denied.ok) throw new Error('Expired identity accepted')
    expect(denied.response.status).toBe(403)
    const ctx = context()
    ctx.cookies.delete(AUTHORING_CSRF_COOKIE)
    expect((await loadAuthoringSession(ctx)).ok).toBe(false)
    expect(fetcher).toHaveBeenCalledOnce()
  })
  it('narrows safe integer state without assuming adjacent Draft/Live numbers', async () => {
    backend()
    const result = await verifyAuthoringCredential('fixture')
    if (!result.ok) throw new Error('Valid identity rejected')
    expect(result.context.state.draft_rev).toBe(7)
    expect(result.context.state.live_rev).toBe(1)
  })
  it.each(['NaN', '9223372036854775807'])(
    'fails closed for nonrepresentable state: %s',
    async (draft) => {
      backend(200, {
        ...authority,
        state: { ...authority.state, draft_rev: draft }
      })
      const result = await verifyAuthoringCredential('fixture')
      expect(result.ok).toBe(false)
      if (!result.ok) expect(result.response.status).toBe(503)
    }
  )
  it('an apply-only role is not an editing grant', async () => {
    backend(200, { ...authority, can_edit: false, can_apply: true })
    const result = await loadAuthoringSession(context())
    if (!result.ok) throw new Error('Review identity rejected')
    const editor = await loadEditorData(result.session, undefined, 'model')
    expect(editor.ok).toBe(false)
    if (!editor.ok) expect(editor.response.status).toBe(404)
  })
  it('makes no upstream request with an invalid credential', async () => {
    const fetcher = backend()
    expect((await verifyAuthoringCredential('bad\r\nheader')).ok).toBe(false)
    expect(fetcher).not.toHaveBeenCalled()
  })
})
